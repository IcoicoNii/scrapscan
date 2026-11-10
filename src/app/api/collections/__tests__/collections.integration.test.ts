// Runs POST /api/collections against a real Postgres (DATABASE_URL), with the db constraints
// migration applied. Skipped when there is no database.
try { process.loadEnvFile(".env"); } catch { /* CI may inject env instead */ }

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(fn: T) => fn }));

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { name: k, value: jar.get(k)! } : undefined),
    set: (k: string, v: string) => void jar.set(k, v),
    delete: (k: string) => void jar.delete(k),
  }),
}));

const run = process.env.DATABASE_URL ? describe : describe.skip;

run("POST /api/collections against the real database", async () => {
  const { db } = await import("@/lib/db");
  const { createSession } = await import("@/lib/session");
  const { POST } = await import("../route");
  const { POST: LOOKUP } = await import("../../households/lookup/route");
  const { GET: DIRECTORY } = await import("../../collector/directory/route");
  const { qrTokenHash } = await import("@/lib/directory");

  const tag = Math.random().toString(36).slice(2, 8).toUpperCase();
  const users: Record<"collector" | "otherCollector" | "citizen" | "admin", string> = {} as never;
  // One household per scenario so the one-per-day rule doesn't couple tests.
  const hh: { id: string; code: string; token: string }[] = [];

  const ALL_OK = { biodegradable: "CORRECT", recyclable: "CORRECT", residual: "CORRECT" } as const;
  const ONE_BAD = { ...ALL_OK, recyclable: "CONTAMINATED" } as const;
  const ALL_BAD = { biodegradable: "CONTAMINATED", recyclable: "CONTAMINATED", residual: "CONTAMINATED" } as const;

  const signInAs = async (who: keyof typeof users) => {
    jar.clear();
    const role = who === "citizen" ? "CITIZEN" : who === "admin" ? "ADMIN" : "COLLECTOR";
    await createSession(users[who], role);
  };
  const post = async (body: unknown, contentType = "application/json") => {
    const res = await POST(
      new Request("http://localhost/api/collections", {
        method: "POST",
        headers: { "content-type": contentType },
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
    );
    return { status: res.status, json: await res.json() };
  };
  const lookup = async (body: unknown) => {
    const res = await LOOKUP(
      new Request("http://localhost/api/households/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    return { status: res.status, json: await res.json() };
  };
  const collection = (i: number, extra: Record<string, unknown> = {}) => ({
    id: randomUUID(),
    household: { qrToken: hh[i].token },
    collectedAt: new Date().toISOString(),
    bins: ALL_OK,
    ...extra,
  });
  const ledgerFor = (i: number) => db.pointsLedger.findMany({ where: { householdId: hh[i].id } });

  beforeAll(async () => {
    for (const k of ["collector", "otherCollector", "citizen", "admin"] as const) {
      const role = k === "citizen" ? "CITIZEN" : k === "admin" ? "ADMIN" : "COLLECTOR";
      const u = await db.user.create({
        data: { email: `${k}-${tag}@test.local`.toLowerCase(), name: `Test ${k}`, role, passwordHash: "x" },
      });
      users[k] = u.id;
    }
    // "CT-" sorts before "HH-", so these never become the "last code" the admin form counts up from.
    for (let i = 0; i < 10; i++) {
      const code = `CT-${tag}-${i}`;
      const token = `SS1.test-${tag}-${i}`;
      const h = await db.household.create({
        data: {
          code, name: `Test household ${i}`, address: "Test", purok: "Test",
          claimCode: `CT${tag}${i}`, claimedAt: new Date(), // claimed, so signup tests never pick them
          qrCodes: { create: { token } },
        },
      });
      hh.push({ id: h.id, code, token });
    }
  });

  beforeEach(() => signInAs("collector"));

  afterAll(async () => {
    const ids = hh.map((h) => h.id);
    // The ledger is append-only for everyone; tests are the one place allowed to lift that, briefly.
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

  it("records a scanned collection, scores it on the server and awards the points", async () => {
    const c = collection(0);
    const { status, json } = await post(c);
    expect(status).toBe(201);
    expect(json).toMatchObject({ ok: true, replay: false, collection: { id: c.id, householdCode: hh[0].code, score: 10, status: "VERIFIED" } });
    const ledger = await ledgerFor(0);
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ type: "AWARD", points: 10, collectionId: c.id, actorId: null });
    const row = await db.collection.findUniqueOrThrow({ where: { id: c.id } });
    expect(row.collectorId).toBe(users.collector);
  });

  it("answers a retry with the stored result and never awards twice", async () => {
    const c = collection(1, { bins: ONE_BAD });
    expect((await post(c)).status).toBe(201);
    const again = await post(c);
    expect(again.status).toBe(200);
    expect(again.json).toMatchObject({ ok: true, replay: true, collection: { id: c.id, score: 5 } });
    expect(await ledgerFor(1)).toHaveLength(1);
  });

  it("handles two copies of the same collection arriving at once", async () => {
    const c = collection(2);
    const results = await Promise.all([post(c), post(c)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 201]);
    expect(await ledgerFor(2)).toHaveLength(1);
  });

  it("flags the stored collection when the same id comes back with different bins", async () => {
    const c = collection(3);
    await post(c);
    const tampered = await post({ ...c, bins: ALL_BAD });
    expect(tampered.status).toBe(409);
    expect(tampered.json).toMatchObject({ ok: false, error: "ID_CONFLICT", collection: { score: 10, status: "FLAGGED" } });
    const row = await db.collection.findUniqueOrThrow({ where: { id: c.id } });
    expect(row).toMatchObject({ status: "FLAGGED", biodegradable: "CORRECT", score: 10 });
    expect(await db.auditLog.count({ where: { targetId: c.id, action: "collection.flag" } })).toBe(1);
  });

  it("holds a flagged collection's points: the award is reversed once, so the balance drops to 0", async () => {
    // Household 3 was flagged in the previous test. Tamper again: no second hold, no second audit row.
    const c = await db.collection.findFirstOrThrow({ where: { householdId: hh[3].id } });
    const { FLAG_HOLD_REASON } = await import("@/lib/collections");
    const again = await post({
      id: c.id, household: { qrToken: hh[3].token }, collectedAt: c.collectedAt.toISOString(), bins: ONE_BAD,
    });
    expect(again.json).toMatchObject({ error: "ID_CONFLICT", collection: { status: "FLAGGED" } });

    const ledger = await db.pointsLedger.findMany({ where: { householdId: hh[3].id }, orderBy: { createdAt: "asc" } });
    expect(ledger).toHaveLength(2);
    const [award, hold] = ledger;
    expect(award).toMatchObject({ type: "AWARD", points: 10, collectionId: c.id });
    expect(hold).toMatchObject({ type: "REVERSAL", points: -10, reversesId: award.id, reason: FLAG_HOLD_REASON, actorId: null });
    const balance = await db.pointsLedger.aggregate({ where: { householdId: hh[3].id }, _sum: { points: true } });
    expect(balance._sum.points).toBe(0);
    expect(await db.auditLog.count({ where: { targetId: c.id, action: "collection.flag" } })).toBe(1);
  });

  it("flagging a score-0 collection holds nothing (there was no award)", async () => {
    const c = collection(6, { household: { code: hh[6].code }, bins: ALL_BAD, collectedAt: new Date(Date.now() - 86_400_000).toISOString() });
    expect((await post(c)).status).toBe(201);
    const res = await post({ ...c, bins: ALL_OK });
    expect(res.json).toMatchObject({ error: "ID_CONFLICT", collection: { status: "FLAGGED", score: 0 } });
    expect(await ledgerFor(6)).toHaveLength(0);
  });

  it("doesn't reveal or flag another collector's collection that reuses the id", async () => {
    const c = collection(4);
    await post(c);
    await signInAs("otherCollector");
    const res = await post({ ...c, bins: ALL_BAD });
    expect(res.status).toBe(409);
    expect(res.json).toEqual({ ok: false, error: "ID_CONFLICT", message: expect.any(String) });
    expect((await db.collection.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("VERIFIED");
  });

  it("allows one collection per household per Manila day", async () => {
    // Two consecutive Manila dates a few days back (Manila has no DST, so 24h apart is the next day).
    const { manilaDateString } = await import("@/lib/dates");
    const day1 = manilaDateString(new Date(Date.now() - 3 * 86_400_000));
    const day2 = manilaDateString(new Date(Date.now() - 2 * 86_400_000));
    // 23:30 and 00:30 Manila time are different days...
    const late = await post(collection(5, { collectedAt: `${day1}T23:30:00+08:00` }));
    const early = await post(collection(5, { collectedAt: `${day2}T00:30:00+08:00` }));
    expect([late.status, early.status]).toEqual([201, 201]);
    // ...but 08:00 on the same Manila day as the second one is a double scan.
    const dup = await post(collection(5, { collectedAt: `${day2}T08:00:00+08:00` }));
    expect(dup.status).toBe(409);
    expect(dup.json).toMatchObject({ ok: false, error: "ALREADY_COLLECTED", collection: { collectionDay: day2 } });
    expect(await ledgerFor(5)).toHaveLength(2);
  });

  it("accepts a typed household code and writes no ledger row for a score of 0", async () => {
    const res = await post(collection(6, { household: { code: hh[6].code.toLowerCase() }, bins: ALL_BAD }));
    expect(res.status).toBe(201);
    expect(res.json.collection).toMatchObject({ householdCode: hh[6].code, score: 0 });
    expect(await ledgerFor(6)).toHaveLength(0);
  });

  it("rejects revoked QR codes, unknown households and inactive households", async () => {
    await db.qrCode.update({ where: { token: hh[7].token }, data: { status: "REVOKED", revokedAt: new Date() } });
    expect((await post(collection(7))).json.error).toBe("QR_REVOKED");
    expect((await post(collection(0, { household: { qrToken: "SS1.nope" } }))).status).toBe(404);
    expect((await post(collection(0, { household: { code: "NOPE-1" } }))).status).toBe(404);
    await db.household.update({ where: { id: hh[8].id }, data: { status: "INACTIVE" } });
    expect((await post(collection(8))).json.error).toBe("HOUSEHOLD_INACTIVE");
    expect(await db.collection.count({ where: { householdId: { in: [hh[7].id, hh[8].id] } } })).toBe(0);
  });

  it("rejects bad input, wrong times and a client-sent score", async () => {
    expect((await post("{not json")).status).toBe(400);
    expect((await post(collection(9), "text/plain")).status).toBe(415);
    expect((await post({ ...collection(9), score: 10 })).status).toBe(400);
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    expect((await post(collection(9, { collectedAt: future }))).json.error).toBe("OUT_OF_RANGE");
    expect((await post(collection(9, { collectedAt: "2020-01-01T08:00:00+08:00" }))).json.error).toBe("OUT_OF_RANGE");
    expect(await db.collection.count({ where: { householdId: hh[9].id } })).toBe(0);
  });

  it("only lets signed-in collectors record", async () => {
    jar.clear();
    expect((await post(collection(9))).status).toBe(401);
    await signInAs("citizen");
    expect((await post(collection(9))).status).toBe(403);
    await signInAs("admin"); // admins correct with reversals, they never record collections
    expect((await post(collection(9))).status).toBe(403);
    await db.user.update({ where: { id: users.otherCollector }, data: { status: "INACTIVE" } });
    await signInAs("otherCollector"); // deactivated: the cookie is valid, the account isn't
    expect((await post(collection(9))).status).toBe(401);
    expect(await db.collection.count({ where: { householdId: hh[9].id } })).toBe(0);
  });

  it("looks up a household by QR or typed code, and says if it was already collected today", async () => {
    // Household 0 was collected "now" in the first test.
    const byQr = await lookup({ qrToken: hh[0].token });
    expect(byQr.status).toBe(200);
    expect(byQr.json).toMatchObject({
      ok: true,
      household: { code: hh[0].code, name: "Test household 0", address: "Test", purok: "Test" },
      collectedToday: { householdCode: hh[0].code, score: 10 },
    });
    expect(byQr.json.household).not.toHaveProperty("claimCode");
    expect(byQr.json.household).not.toHaveProperty("id");

    const byCode = await lookup({ code: hh[9].code.toLowerCase() });
    expect(byCode.json).toMatchObject({ ok: true, household: { code: hh[9].code }, collectedToday: null });

    expect((await lookup({ qrToken: hh[7].token })).json.error).toBe("QR_REVOKED"); // revoked earlier
    expect((await lookup({ qrToken: hh[8].token })).json.error).toBe("HOUSEHOLD_INACTIVE");
    expect((await lookup({ code: "NOPE-1" })).status).toBe(404);
    expect((await lookup({ qrToken: "x", code: "y" })).status).toBe(400);
  });

  it("only collectors can look households up", async () => {
    await signInAs("citizen");
    expect((await lookup({ qrToken: hh[0].token })).status).toBe(403);
    jar.clear();
    expect((await lookup({ qrToken: hh[0].token })).status).toBe(401);
  });

  it("gives collectors a minimal household list for offline scanning", async () => {
    const res = await DIRECTORY();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    const mine = new Map<string, Record<string, unknown>>(
      body.households.filter((h: { code: string }) => h.code.startsWith(`CT-${tag}-`)).map((h: { code: string }) => [h.code, h]),
    );
    // Only these fields, nothing else (no address, claim code, ids or raw tokens).
    for (const h of mine.values()) expect(Object.keys(h).sort()).toEqual(["code", "lastCollectionDay", "name", "purok", "qrHashes"]);
    expect(JSON.stringify(body)).not.toContain(hh[0].token);

    expect(mine.get(hh[0].code)).toMatchObject({ qrHashes: [qrTokenHash(hh[0].token)], lastCollectionDay: expect.any(String) });
    expect(mine.get(hh[9].code)).toMatchObject({ lastCollectionDay: null });
    expect(mine.get(hh[7].code)).toMatchObject({ qrHashes: [] }); // its QR was revoked
    expect(mine.has(hh[8].code)).toBe(false); // inactive households are left out
  });

  it("only collectors get the household list", async () => {
    await signInAs("citizen");
    expect((await DIRECTORY()).status).toBe(403);
    await signInAs("admin");
    expect((await DIRECTORY()).status).toBe(403);
    jar.clear();
    expect((await DIRECTORY()).status).toBe(401);
  });

  it("the database refuses to edit or delete ledger rows", async () => {
    const [row] = await ledgerFor(0);
    await expect(db.pointsLedger.update({ where: { id: row.id }, data: { points: 999 } })).rejects.toThrow(/append-only/);
    await expect(db.pointsLedger.delete({ where: { id: row.id } })).rejects.toThrow(/append-only/);
  });
});
