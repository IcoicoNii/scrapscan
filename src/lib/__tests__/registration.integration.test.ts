// Resident self-registration, admin approval and family sign-up codes, against a real Postgres (DATABASE_URL).
// Skipped when there is no database.
try { process.loadEnvFile(".env"); } catch { /* CI may inject env instead */ }

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const run = process.env.DATABASE_URL ? describe : describe.skip;

run("household self-registration against the real database", async () => {
  const { db } = await import("@/lib/db");
  const { registerResident, regenerateSignUpCode, linkResident, possibleDuplicates, MAX_MEMBERS } = await import("@/lib/households");
  const { decideRegistration, setHouseholdStatus } = await import("@/lib/admin-households");
  const { lookupHousehold, recordCollection } = await import("@/lib/collections");
  const { collectorDirectory } = await import("@/lib/directory");

  const tag = Math.random().toString(36).slice(2, 8);
  const purok = `Test Purok ${tag}`;
  const users: string[] = [];
  const households: string[] = [];
  let admin = "";
  let collector = "";
  let n = 0;

  const account = (extra: Record<string, string> = {}) => ({
    name: "Test Resident",
    identifier: `self-${tag}-${n++}@test.local`,
    password: "longenough1",
    confirm: "longenough1",
    terms: "on",
    ...extra,
  });
  /** Registers a new household and returns it (plus the registrant's id). */
  const registerNew = async (fields: { householdName?: string; address?: string } = {}) => {
    const r = await registerResident(account({ mode: "new", householdName: fields.householdName ?? `Self ${tag} household`, address: fields.address ?? `Lot ${n}`, purok }));
    if (!r.ok) throw new Error(JSON.stringify(r.fieldErrors));
    users.push(r.userId);
    const h = await db.household.findUniqueOrThrow({ where: { code: r.householdCode }, include: { qrCodes: true } });
    households.push(h.id);
    return { h, userId: r.userId };
  };
  const join = async (code: string) => {
    const r = await registerResident(account({ mode: "join", householdCode: code }));
    if (r.ok) users.push(r.userId);
    return r;
  };
  const collect = (token: string) =>
    recordCollection(collector, { id: randomUUID(), household: { qrToken: token }, collectedAt: new Date().toISOString(), bins: { biodegradable: "CORRECT", recyclable: "CORRECT", residual: "CORRECT" } });

  beforeAll(async () => {
    const a = await db.user.create({ data: { email: `self-admin-${tag}@test.local`, name: "Test admin", role: "ADMIN", passwordHash: "x" } });
    const c = await db.user.create({ data: { email: `self-col-${tag}@test.local`, name: "Test collector", role: "COLLECTOR", passwordHash: "x" } });
    admin = a.id;
    collector = c.id;
  });

  afterAll(async () => {
    const all = [...users, admin, collector];
    await db.$transaction([
      db.$executeRawUnsafe(`ALTER TABLE "PointsLedger" DISABLE TRIGGER points_ledger_no_update`),
      db.pointsLedger.deleteMany({ where: { householdId: { in: households } } }),
      db.$executeRawUnsafe(`ALTER TABLE "PointsLedger" ENABLE TRIGGER points_ledger_no_update`),
    ]);
    await db.auditLog.deleteMany({ where: { OR: [{ actorId: { in: all } }, { targetId: { in: households } }] } });
    await db.collection.deleteMany({ where: { householdId: { in: households } } });
    await db.user.deleteMany({ where: { id: { in: all } } });
    await db.qrCode.deleteMany({ where: { householdId: { in: households } } });
    await db.household.deleteMany({ where: { id: { in: households } } });
    await db.$disconnect();
  });

  it("a resident registers a household: PENDING, with an HH number, a QR code and an audit row", async () => {
    const { h, userId } = await registerNew();
    expect(h).toMatchObject({ status: "PENDING", selfRegistered: true, purok });
    expect(h.code).toMatch(/^HH-\d{5}$/);
    expect(h.claimedAt).toBeInstanceOf(Date);
    expect(h.qrCodes).toHaveLength(1);
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).householdId).toBe(h.id);
    expect(await db.auditLog.count({ where: { targetId: h.id, action: "household.register", actorId: userId } })).toBe(1);
  });

  it("simultaneous registrations each get their own household number", async () => {
    const results = await Promise.all(
      Array.from({ length: 4 }, (_, i) => registerResident(account({ mode: "new", householdName: `Race ${tag} ${i}`, address: `Race lot ${i}`, purok }))),
    );
    expect(results.every((r) => r.ok)).toBe(true);
    const codes = results.map((r) => (r.ok ? r.householdCode : ""));
    expect(new Set(codes).size).toBe(4);
    for (const r of results) if (r.ok) users.push(r.userId);
    households.push(...(await db.household.findMany({ where: { code: { in: codes } }, select: { id: true } })).map((h) => h.id));
  });

  it("collectors can't record a pending household, online or from the stored list", async () => {
    const { h } = await registerNew();
    expect(await lookupHousehold({ qrToken: h.qrCodes[0].token })).toMatchObject({ ok: false, error: "HOUSEHOLD_PENDING" });
    expect(await lookupHousehold({ code: h.code })).toMatchObject({ ok: false, error: "HOUSEHOLD_PENDING" });
    expect(await collect(h.qrCodes[0].token)).toMatchObject({ ok: false, error: "HOUSEHOLD_PENDING" });
    expect((await collectorDirectory()).households.some((d) => d.code === h.code)).toBe(false);
    // The on/off switch can't bypass approval.
    expect(await setHouseholdStatus(admin, { householdId: h.id, status: "ACTIVE", reason: "Trying to skip" })).toMatchObject({ ok: false });
  });

  it("approve: collectors can record it; it can only be decided once", async () => {
    const { h } = await registerNew();
    expect(await decideRegistration(admin, { householdId: h.id, decision: "approve" })).toEqual({ ok: true });
    expect((await db.household.findUniqueOrThrow({ where: { id: h.id } })).status).toBe("ACTIVE");
    expect(await collect(h.qrCodes[0].token)).toMatchObject({ ok: true });
    expect(await decideRegistration(admin, { householdId: h.id, decision: "reject", note: "Too late" })).toMatchObject({ ok: false });
    expect(await db.auditLog.count({ where: { targetId: h.id, action: "household.approve", actorId: admin } })).toBe(1);
  });

  it("don't approve: needs a note; the household is turned off and the note is kept for the resident", async () => {
    const { h } = await registerNew();
    expect(await decideRegistration(admin, { householdId: h.id, decision: "reject" })).toMatchObject({ ok: false, fieldErrors: { note: expect.any(String) } });
    expect(await decideRegistration(admin, { householdId: h.id, decision: "reject", note: "Outside the barangay" })).toEqual({ ok: true });
    expect(await db.household.findUniqueOrThrow({ where: { id: h.id } })).toMatchObject({ status: "INACTIVE", statusNote: "Outside the barangay" });
    expect(await join(h.claimCode)).toMatchObject({ ok: false, fieldErrors: { householdCode: expect.any(String) } });
    // Turning it on later (e.g. a mistake) clears the note.
    expect(await setHouseholdStatus(admin, { householdId: h.id, status: "ACTIVE", reason: "Address confirmed" })).toEqual({ ok: true });
    expect(await db.household.findUniqueOrThrow({ where: { id: h.id } })).toMatchObject({ status: "ACTIVE", statusNote: null });
  });

  it("family members join with the sign-up code (pending or active), up to the limit, even all at once", async () => {
    const { h } = await registerNew();
    expect(await join(h.claimCode.toLowerCase())).toMatchObject({ ok: true, joined: true, householdCode: h.code });
    // 2 members now; three more fill it, and the rest are refused, even when they arrive at the same moment.
    const results = await Promise.all(Array.from({ length: 5 }, () => join(h.claimCode)));
    expect(results.filter((r) => r.ok)).toHaveLength(MAX_MEMBERS - 2);
    expect(results.find((r) => !r.ok)).toMatchObject({ fieldErrors: { householdCode: expect.stringContaining(`${MAX_MEMBERS} accounts`) } });
    expect(await db.user.count({ where: { householdId: h.id } })).toBe(MAX_MEMBERS);
    expect(await db.auditLog.count({ where: { targetId: h.id, action: "household.join" } })).toBe(MAX_MEMBERS - 1);
  });

  it("a new sign-up code stops the old one; members keep their access", async () => {
    const { h, userId } = await registerNew();
    const r = await regenerateSignUpCode(userId, h.id);
    expect(r.ok).toBe(true);
    expect(await join(h.claimCode)).toMatchObject({ ok: false });
    if (r.ok) expect(await join(r.code)).toMatchObject({ ok: true });
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).householdId).toBe(h.id);
  });

  it("validates the registration form for both choices", async () => {
    expect(await registerResident(account({ mode: "new", householdName: "", address: "", purok: "" }))).toMatchObject({
      ok: false, fieldErrors: { householdName: expect.any(String), address: expect.any(String), purok: expect.any(String) },
    });
    expect(await registerResident(account({ mode: "join", householdCode: "" }))).toMatchObject({ ok: false, fieldErrors: { householdCode: expect.any(String) } });
    expect(await registerResident(account({ mode: "join", householdCode: "AAAA-AAAA", confirm: "different" }))).toMatchObject({ ok: false, fieldErrors: { confirm: expect.any(String) } });
    const { userId } = await registerNew();
    const email = (await db.user.findUniqueOrThrow({ where: { id: userId } })).email!;
    expect(await registerResident(account({ mode: "new", identifier: email, householdName: "Dup household", address: "Lot 1", purok }))).toMatchObject({
      ok: false, fieldErrors: { identifier: expect.stringContaining("already exists") },
    });
  });

  it("flags possible duplicates and lets the admin move a resident to the right household", async () => {
    const first = await registerNew({ householdName: "Santos household", address: "Blk 3, Lot 7" });
    const dup = await registerNew({ householdName: "Santos Household", address: "blk 3 lot 7" });
    expect((await possibleDuplicates(dup.h)).map((d) => d.code)).toContain(first.h.code);

    // Move the duplicate's resident into the first household, then decline the duplicate.
    expect(await linkResident(admin, dup.userId, first.h.code.replace("HH-", ""))).toEqual({ ok: true });
    expect((await db.user.findUniqueOrThrow({ where: { id: dup.userId } })).householdId).toBe(first.h.id);
    expect(await linkResident(admin, dup.userId, "HH-99999")).toMatchObject({ ok: false, fieldErrors: { household: expect.any(String) } });
    expect(await linkResident(admin, admin, first.h.code)).toMatchObject({ ok: false });
    expect(await linkResident(admin, dup.userId, null)).toEqual({ ok: true });
    expect((await db.user.findUniqueOrThrow({ where: { id: dup.userId } })).householdId).toBeNull();
    expect(await db.auditLog.count({ where: { targetId: dup.userId, action: "account.household_link" } })).toBe(2);
  });
});
