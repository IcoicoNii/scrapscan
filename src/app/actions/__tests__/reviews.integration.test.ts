// Admin review of flagged collections, against a real Postgres (DATABASE_URL) with the db constraints
// migration applied. Skipped when there is no database.
try { process.loadEnvFile(".env"); } catch { /* CI may inject env instead */ }

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(fn: T) => fn }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
class Redirect extends Error {
  constructor(public url: string) { super(`redirect ${url}`); }
}
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Redirect(url); } }));

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { name: k, value: jar.get(k)! } : undefined),
    set: (k: string, v: string) => void jar.set(k, v),
    delete: (k: string) => void jar.delete(k),
  }),
  headers: async () => new Headers(),
}));

const run = process.env.DATABASE_URL ? describe : describe.skip;

run("reviewing flagged collections against the real database", async () => {
  const { db } = await import("@/lib/db");
  const { createSession } = await import("@/lib/session");
  const { recordCollection, FLAG_HOLD_REASON } = await import("@/lib/collections");
  const { reviewFlaggedCollection, flaggedForReview, recentDecisions, RELEASE_REASON } = await import("@/lib/reviews");
  const { reviewCollectionAction } = await import("../reviews");

  const tag = Math.random().toString(36).slice(2, 8).toUpperCase();
  const users = {} as Record<"collector" | "admin" | "admin2", string>;
  const hh: { id: string; code: string; token: string }[] = [];

  const ALL_OK = { biodegradable: "CORRECT", recyclable: "CORRECT", residual: "CORRECT" } as const;
  const ONE_BAD = { ...ALL_OK, recyclable: "CONTAMINATED" } as const;
  const ALL_BAD = { biodegradable: "CONTAMINATED", recyclable: "CONTAMINATED", residual: "CONTAMINATED" } as const;

  const signInAs = async (who: keyof typeof users | null) => {
    jar.clear();
    if (who) await createSession(users[who], who === "collector" ? "COLLECTOR" : "ADMIN");
  };
  const balance = async (i: number) =>
    (await db.pointsLedger.aggregate({ where: { householdId: hh[i].id }, _sum: { points: true } }))._sum.points ?? 0;
  const ledger = (i: number) => db.pointsLedger.findMany({ where: { householdId: hh[i].id }, orderBy: { createdAt: "asc" } });

  /** Records a collection for household i, then resends the same id with other bins so it gets flagged. */
  type Bins = Record<keyof typeof ALL_OK, "CORRECT" | "CONTAMINATED">;
  const flagged = async (i: number, bins: Bins = ALL_OK, resentBins: Bins = ONE_BAD) => {
    const input = { id: randomUUID(), household: { qrToken: hh[i].token }, collectedAt: new Date().toISOString(), bins };
    expect((await recordCollection(users.collector, input)).ok).toBe(true);
    const again = await recordCollection(users.collector, { ...input, bins: resentBins });
    expect(again).toMatchObject({ ok: false, error: "ID_CONFLICT", collection: { status: "FLAGGED" } });
    return input;
  };
  const act = async (fields: Record<string, string>) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    try {
      return { state: await reviewCollectionAction(undefined, fd) };
    } catch (e) {
      if (e instanceof Redirect) return { redirect: e.url };
      throw e;
    }
  };

  beforeAll(async () => {
    for (const k of ["collector", "admin", "admin2"] as const) {
      const u = await db.user.create({
        data: { email: `rv-${k}-${tag}@test.local`.toLowerCase(), name: `Test ${k}`, role: k === "collector" ? "COLLECTOR" : "ADMIN", passwordHash: "x" },
      });
      users[k] = u.id;
    }
    for (let i = 0; i < 8; i++) {
      const code = `CT-${tag}-r${i}`;
      const token = `SS1.review-${tag}-${i}`;
      const h = await db.household.create({
        data: {
          code, name: `Review household ${i}`, address: "Test", purok: "Test",
          claimCode: `CR${tag}${i}`, claimedAt: new Date(),
          qrCodes: { create: { token } },
        },
      });
      hh.push({ id: h.id, code, token });
    }
  });

  beforeEach(() => signInAs("admin"));

  afterAll(async () => {
    const ids = hh.map((h) => h.id);
    await db.$transaction([
      db.$executeRawUnsafe(`ALTER TABLE "PointsLedger" DISABLE TRIGGER points_ledger_no_update`),
      db.pointsLedger.deleteMany({ where: { householdId: { in: ids } } }),
      db.$executeRawUnsafe(`ALTER TABLE "PointsLedger" ENABLE TRIGGER points_ledger_no_update`),
    ]);
    await db.auditLog.deleteMany({ where: { actorId: { in: Object.values(users) } } });
    await db.collection.deleteMany({ where: { householdId: { in: ids } } });
    await db.qrCode.deleteMany({ where: { householdId: { in: ids } } });
    await db.household.deleteMany({ where: { id: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: Object.values(users) } } });
    await db.$disconnect();
  });

  it("records what the conflicting resend said (by household code, never the raw QR token) and lists it for review", async () => {
    const c = await flagged(0, ALL_OK, ALL_BAD);
    const flag = await db.auditLog.findFirstOrThrow({ where: { targetId: c.id, action: "collection.flag" } });
    expect(flag.meta).toMatchObject({ received: { householdCode: hh[0].code, via: "qr", bins: ALL_BAD } });
    expect(JSON.stringify(flag.meta)).not.toContain(hh[0].token);

    const item = (await flaggedForReview(500)).find((f) => f.id === c.id);
    expect(item).toMatchObject({
      household: { code: hh[0].code },
      collector: { name: "Test collector" },
      score: 10,
      pointsHeld: 10,
      bins: ALL_OK,
      received: { householdCode: hh[0].code, bins: ALL_BAD, score: 0 },
    });
    expect(item?.flaggedAt).toBeInstanceOf(Date);
  });

  it("release: the collection counts again and the held points come back, through the ledger", async () => {
    const c = await flagged(1);
    expect(await balance(1)).toBe(0);

    const res = await act({ collectionId: c.id, decision: "release", reason: "Phone resent after a crash; first result checked" });
    expect(res.redirect).toBe(`/admin/reviews?reviewed=${c.id}`);

    expect((await db.collection.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("VERIFIED");
    const [award, hold, release] = await ledger(1);
    expect(award).toMatchObject({ type: "AWARD", points: 10 });
    expect(hold).toMatchObject({ type: "REVERSAL", points: -10, reversesId: award.id, reason: FLAG_HOLD_REASON, actorId: null });
    expect(release).toMatchObject({ type: "REVERSAL", points: 10, reversesId: hold.id, reason: RELEASE_REASON, actorId: users.admin });
    expect(await balance(1)).toBe(10);

    const log = await db.auditLog.findFirstOrThrow({ where: { targetId: c.id, action: "collection.release" } });
    expect(log).toMatchObject({ actorId: users.admin, reason: "Phone resent after a crash; first result checked", meta: { pointsReleased: 10 } });
    expect((await flaggedForReview(500)).some((f) => f.id === c.id)).toBe(false);
    expect((await recentDecisions({ collectionId: c.id }))[0]).toMatchObject({
      decision: "release", points: 10, adminName: "Test admin", household: { code: hh[1].code },
    });
  });

  it("don't count: the collection is REJECTED and the hold stays, so the balance stays at 0", async () => {
    const c = await flagged(2, ONE_BAD, ALL_OK);
    const res = await act({ collectionId: c.id, decision: "reject", reason: "Collector can't confirm the bins" });
    expect(res.redirect).toBe(`/admin/reviews?reviewed=${c.id}`);

    const row = await db.collection.findUniqueOrThrow({ where: { id: c.id } });
    expect(row).toMatchObject({ status: "REJECTED", score: 5, recyclable: "CONTAMINATED" }); // stored bins never change
    expect(await ledger(2)).toHaveLength(2);
    expect(await balance(2)).toBe(0);
    expect(await db.auditLog.findFirstOrThrow({ where: { targetId: c.id, action: "collection.reject" } })).toMatchObject({
      meta: { pointsNotCounted: 5 },
    });

    // A later resend changes nothing: same details is a plain replay, different details doesn't re-flag.
    expect(await recordCollection(users.collector, c)).toMatchObject({ ok: true, replay: true, collection: { status: "REJECTED" } });
    expect(await recordCollection(users.collector, { ...c, bins: ALL_BAD })).toMatchObject({ error: "ID_CONFLICT", collection: { status: "REJECTED" } });
    expect(await ledger(2)).toHaveLength(2);
    expect(await db.auditLog.count({ where: { targetId: c.id, action: "collection.flag" } })).toBe(1);
  });

  it("a collection can only be decided once", async () => {
    const c = await flagged(3);
    expect((await reviewFlaggedCollection(users.admin, { collectionId: c.id, decision: "release", reason: "Checked" })).ok).toBe(true);
    const again = await act({ collectionId: c.id, decision: "release", reason: "Checked again" });
    expect(again.state).toMatchObject({ error: expect.stringContaining("already reviewed") });
    expect(await reviewFlaggedCollection(users.admin, { collectionId: c.id, decision: "reject", reason: "Changed my mind" }))
      .toMatchObject({ ok: false, error: "NOT_FLAGGED" });
    expect(await ledger(3)).toHaveLength(3);
    expect(await balance(3)).toBe(10);
  });

  it("two admins deciding at once: exactly one decision wins, and the ledger matches it", async () => {
    const c = await flagged(4);
    const results = await Promise.all([
      reviewFlaggedCollection(users.admin, { collectionId: c.id, decision: "release", reason: "Looks fine" }),
      reviewFlaggedCollection(users.admin2, { collectionId: c.id, decision: "reject", reason: "Not sure" }),
    ]);
    const winners = results.filter((r) => r.ok);
    expect(winners).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toMatchObject({ error: "NOT_FLAGGED" });
    const status = (await db.collection.findUniqueOrThrow({ where: { id: c.id } })).status;
    const won = winners[0] as { decision: string };
    expect(status).toBe(won.decision === "release" ? "VERIFIED" : "REJECTED");
    expect(await balance(4)).toBe(won.decision === "release" ? 10 : 0);
    expect(await db.auditLog.count({ where: { targetId: c.id, action: { in: ["collection.release", "collection.reject"] } } })).toBe(1);
  });

  it("a flagged score-0 collection is verified without any ledger row (nothing was held)", async () => {
    const c = await flagged(5, ALL_BAD, ALL_OK);
    expect((await flaggedForReview(500)).find((f) => f.id === c.id)?.pointsHeld).toBe(0);
    expect(await reviewFlaggedCollection(users.admin, { collectionId: c.id, decision: "release", reason: "Checked" }))
      .toMatchObject({ ok: true, points: 0 });
    expect((await db.collection.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("VERIFIED");
    expect(await ledger(5)).toHaveLength(0);
  });

  it("needs a reason, a known collection and a valid decision; nothing changes otherwise", async () => {
    const c = await flagged(6);
    const noReason = await act({ collectionId: c.id, decision: "release", reason: "  " });
    expect(noReason.state).toMatchObject({ field: "reason", error: expect.stringContaining("reason") });
    const keepsText = await act({ collectionId: c.id, decision: "release", reason: "ok" });
    expect(keepsText.state).toMatchObject({ field: "reason", reason: "ok" }); // typed text survives the form reset
    expect((await act({ collectionId: c.id, decision: "delete", reason: "Checked" })).state?.error).toBeTruthy();
    expect(await reviewFlaggedCollection(users.admin, { collectionId: randomUUID(), decision: "release", reason: "Checked" }))
      .toMatchObject({ ok: false, error: "NOT_FOUND" });
    expect((await db.collection.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("FLAGGED");
    expect(await ledger(6)).toHaveLength(2);
  });

  it("only admins can decide", async () => {
    const c = await flagged(7);
    await signInAs("collector");
    await expect(act({ collectionId: c.id, decision: "release", reason: "My own scan is fine" })).rejects.toThrow("collection:review");
    await signInAs(null);
    await expect(act({ collectionId: c.id, decision: "release", reason: "Checked" })).rejects.toThrow("UNAUTHENTICATED");
    expect((await db.collection.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("FLAGGED");
    expect(await balance(7)).toBe(0);
  });
});
