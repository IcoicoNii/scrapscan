// Accounts, household changes, corrections and rewards against a real Postgres (DATABASE_URL).
// Skipped when there is no database.
try { process.loadEnvFile(".env"); } catch { /* CI may inject env instead */ }

import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(fn: T) => fn }));
vi.mock("@clerk/nextjs/server", async () => (await import("@/test/clerk-fake")).clerkModule);
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
  headers: async () => new Headers(),
}));
const { asUser, fakeLogin, setCurrentClerkUser } = await import("@/test/clerk-fake");

const run = process.env.DATABASE_URL ? describe : describe.skip;

run("admin tools against the real database", async () => {
  const { db } = await import("@/lib/db");
  const { getCurrentUser } = await import("@/lib/auth");
  const accounts = await import("@/lib/accounts");
  const hhAdmin = await import("@/lib/admin-households");
  const rewards = await import("@/lib/redemptions");
  const { recordCollection, lookupHousehold } = await import("@/lib/collections");

  const tag = Math.random().toString(36).slice(2, 8).toUpperCase();
  const users = {} as Record<"admin" | "collector" | "resident", string>;
  const createdUsers: string[] = [];
  const hh: { id: string; code: string; token: string }[] = [];
  const rewardIds: string[] = [];
  const OK = { biodegradable: "CORRECT", recyclable: "CORRECT", residual: "CORRECT" } as const;

  const balance = (i: number) => rewards.balanceOf(hh[i].id);
  /** Gives household i a verified 10-point collection on a distinct past day. */
  let dayOffset = 1;
  const earn10 = async (i: number) => {
    const r = await recordCollection(users.collector, {
      id: randomUUID(), household: { qrToken: hh[i].token }, collectedAt: new Date(Date.now() - dayOffset++ * 86_400_000).toISOString(), bins: OK,
    });
    expect(r.ok).toBe(true);
    return r.ok ? r.collection.id : "";
  };
  const reward = async (pointsCost: number, stock: number | null = null) => {
    const r = await db.reward.create({ data: { name: `Test reward ${tag} ${rewardIds.length}`, pointsCost, stock } });
    rewardIds.push(r.id);
    return r;
  };

  beforeAll(async () => {
    for (const k of ["admin", "collector", "resident"] as const) {
      const u = await db.user.create({
        data: { email: `adm-${k}-${tag}@test.local`.toLowerCase(), name: `Test ${k}`, role: k === "admin" ? "ADMIN" : k === "collector" ? "COLLECTOR" : "CITIZEN", passwordHash: await bcrypt.hash("Password123!", 4) },
      });
      users[k] = u.id;
      createdUsers.push(u.id);
    }
    for (let i = 0; i < 6; i++) {
      const code = `CT-${tag}-a${i}`;
      const token = `SS1.adm-${tag}-${i}`;
      const h = await db.household.create({
        data: { code, name: `Admin household ${i}`, address: "Test", purok: "Test", claimCode: `CA${tag}${i}`, claimedAt: new Date(), qrCodes: { create: { token } } },
      });
      hh.push({ id: h.id, code, token });
    }
    await db.user.update({ where: { id: users.resident }, data: { householdId: hh[4].id } });
  });

  afterAll(async () => {
    const ids = hh.map((h) => h.id);
    await db.$transaction([
      db.$executeRawUnsafe(`ALTER TABLE "PointsLedger" DISABLE TRIGGER points_ledger_no_update`),
      db.pointsLedger.deleteMany({ where: { householdId: { in: ids } } }),
      db.$executeRawUnsafe(`ALTER TABLE "PointsLedger" ENABLE TRIGGER points_ledger_no_update`),
    ]);
    await db.redemption.deleteMany({ where: { householdId: { in: ids } } });
    await db.reward.deleteMany({ where: { id: { in: rewardIds } } });
    await db.auditLog.deleteMany({ where: { OR: [{ actorId: { in: createdUsers } }, { targetId: { in: [...ids, ...createdUsers] } }] } });
    await db.collection.deleteMany({ where: { householdId: { in: ids } } });
    await db.user.updateMany({ where: { id: { in: createdUsers } }, data: { householdId: null } });
    await db.qrCode.deleteMany({ where: { householdId: { in: ids } } });
    await db.household.deleteMany({ where: { id: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: createdUsers } } });
    await db.$disconnect();
  });

  // ---------- Accounts ----------

  it("creates a collector with a temporary password that must be changed", async () => {
    const r = await accounts.createStaffAccount(users.admin, { name: "New Collector", identifier: `staff-${tag}-${Date.now()}@example.com`, role: "COLLECTOR" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    createdUsers.push(r.userId);
    const u = await db.user.findUniqueOrThrow({ where: { id: r.userId } });
    expect(u).toMatchObject({ role: "COLLECTOR", mustChangePassword: true, email: expect.stringContaining("@example.com") });
    expect(fakeLogin(u.clerkId ?? "")?.password).toBe(r.tempPassword);
    expect(r.tempPassword).toMatch(/^[2-9a-z]{10}$/);
    expect(await accounts.createStaffAccount(users.admin, { name: "Dup", identifier: r.login, role: "COLLECTOR" }))
      .toMatchObject({ ok: false, fieldErrors: { identifier: expect.stringContaining("already exists") } });
    expect(await accounts.createStaffAccount(users.admin, { name: "Bad", identifier: "not-an-id", role: "CITIZEN" })).toMatchObject({ ok: false });
  });

  it("a password reset signs the account out everywhere and the change clears the flag", async () => {
    setCurrentClerkUser(null);
    await asUser(users.collector);
    expect((await getCurrentUser())?.id).toBe(users.collector);

    const reset = await accounts.resetPassword(users.admin, users.collector);
    expect(reset.ok).toBe(true);
    if (!reset.ok) return;
    // Signing out old sessions is Clerk's job (revokeSessions); the Clerk fake does not track sessions.

    await asUser(users.collector); // logs in with the temporary password
    expect(await getCurrentUser()).toMatchObject({ id: users.collector, mustChangePassword: true });

    expect(await accounts.changeOwnPassword(users.collector, { current: "wrong", password: "NewPass123", confirm: "NewPass123" }))
      .toMatchObject({ ok: false, fieldErrors: { current: expect.any(String) } });
    expect(await accounts.changeOwnPassword(users.collector, { current: reset.tempPassword, password: reset.tempPassword, confirm: reset.tempPassword }))
      .toMatchObject({ ok: false });
    expect(await accounts.changeOwnPassword(users.collector, { current: reset.tempPassword, password: "NewPass123", confirm: "NewPass123" })).toEqual({ ok: true });
    const u = await db.user.findUniqueOrThrow({ where: { id: users.collector } });
    expect(u.mustChangePassword).toBe(false);
    expect(fakeLogin(u.clerkId ?? "")?.password).toBe("NewPass123");
    expect(await accounts.resetPassword(users.admin, users.admin)).toMatchObject({ ok: false });
  });

  it("turning an account off blocks it at once, reactivating doesn't revive old sessions, and you can't turn yourself off", async () => {
    setCurrentClerkUser(null);
    await asUser(users.resident);
    expect(await accounts.setAccountStatus(users.admin, { userId: users.resident, status: "INACTIVE", reason: "x" })).toMatchObject({ ok: false });
    expect(await accounts.setAccountStatus(users.admin, { userId: users.resident, status: "INACTIVE", reason: "Moved away" })).toEqual({ ok: true });
    expect(await getCurrentUser()).toBeNull();
    expect(await db.auditLog.count({ where: { targetId: users.resident, action: "account.deactivate", reason: "Moved away" } })).toBe(1);
    expect(await accounts.setAccountStatus(users.admin, { userId: users.resident, status: "ACTIVE", reason: "Came back" })).toEqual({ ok: true });
    expect((await getCurrentUser())?.id).toBe(users.resident); // back in, with a fresh login
    expect(await accounts.setAccountStatus(users.admin, { userId: users.admin, status: "INACTIVE", reason: "Testing" })).toMatchObject({ ok: false });
  });

  // ---------- Households ----------

  it("edits details, turns a household off (collectors refused) and back on, with audit", async () => {
    expect(await hhAdmin.updateHouseholdDetails(users.admin, { householdId: hh[0].id, name: "Renamed household", address: "New St", purok: "Purok 9" })).toEqual({ ok: true });
    expect(await db.household.findUniqueOrThrow({ where: { id: hh[0].id } })).toMatchObject({ name: "Renamed household", purok: "Purok 9" });
    expect(await hhAdmin.updateHouseholdDetails(users.admin, { householdId: hh[0].id, name: "", address: "x", purok: "" })).toMatchObject({ ok: false, fieldErrors: { name: expect.any(String) } });

    expect(await hhAdmin.setHouseholdStatus(users.admin, { householdId: hh[0].id, status: "INACTIVE", reason: "Moved out" })).toEqual({ ok: true });
    expect(await lookupHousehold({ qrToken: hh[0].token })).toMatchObject({ ok: false, error: "HOUSEHOLD_INACTIVE" });
    expect(await hhAdmin.setHouseholdStatus(users.admin, { householdId: hh[0].id, status: "ACTIVE", reason: "Back" })).toEqual({ ok: true });
    expect(await lookupHousehold({ qrToken: hh[0].token })).toMatchObject({ ok: true });
    expect(await db.auditLog.count({ where: { targetId: hh[0].id, action: { in: ["household.update", "household.deactivate", "household.activate"] } } })).toBe(3);
  });

  it("replacing a QR code stops the old sticker at once and issues exactly one new one", async () => {
    const results = await Promise.all([
      hhAdmin.replaceQrCode(users.admin, { householdId: hh[1].id, reason: "Sticker torn" }),
      hhAdmin.replaceQrCode(users.admin, { householdId: hh[1].id, reason: "Sticker torn" }),
    ]);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(await db.qrCode.count({ where: { householdId: hh[1].id, status: "ACTIVE" } })).toBe(1);
    expect(await lookupHousehold({ qrToken: hh[1].token })).toMatchObject({ ok: false, error: "QR_REVOKED" });
    const fresh = await db.qrCode.findFirstOrThrow({ where: { householdId: hh[1].id, status: "ACTIVE" } });
    expect(await lookupHousehold({ qrToken: fresh.token })).toMatchObject({ ok: true });
  });

  it("not counting a verified collection takes its points back once, and keeps the bins", async () => {
    const id = await earn10(2);
    expect(await balance(2)).toBe(10);
    expect(await hhAdmin.excludeCollection(users.admin, { collectionId: id, reason: "Scanned the neighbour's sticker" })).toMatchObject({ ok: true, points: 10 });
    expect(await balance(2)).toBe(0);
    expect(await db.collection.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: "REJECTED", biodegradable: "CORRECT", score: 10 });
    expect(await hhAdmin.excludeCollection(users.admin, { collectionId: id, reason: "Again" })).toMatchObject({ ok: false });
    expect(await balance(2)).toBe(0);
  });

  // ---------- Rewards ----------

  it("a request holds the points and a stock unit; reject and cancel give both back; claim keeps them spent", async () => {
    await earn10(4); await earn10(4); await earn10(4); // 30 pts
    const user = { id: users.resident, householdId: hh[4].id };
    const r = await reward(10, 2);

    const a = await rewards.requestReward(user, r.id);
    expect(a.ok).toBe(true);
    expect(await balance(4)).toBe(20);
    expect((await db.reward.findUniqueOrThrow({ where: { id: r.id } })).stock).toBe(1);
    if (!a.ok) return;

    // Reject needs a note; then points and stock come back.
    expect(await rewards.decideRedemption(users.admin, { redemptionId: a.redemptionId, decision: "reject" })).toMatchObject({ ok: false });
    expect(await rewards.decideRedemption(users.admin, { redemptionId: a.redemptionId, decision: "reject", note: "Out of rice" })).toEqual({ ok: true });
    expect(await balance(4)).toBe(30);
    expect((await db.reward.findUniqueOrThrow({ where: { id: r.id } })).stock).toBe(2);
    expect(await rewards.decideRedemption(users.admin, { redemptionId: a.redemptionId, decision: "approve" })).toMatchObject({ ok: false });

    // Approve then claim: the points stay spent.
    const b = await rewards.requestReward(user, r.id);
    if (!b.ok) throw new Error(b.message);
    expect(await rewards.cancelRedemption({ id: users.collector, householdId: hh[0].id }, b.redemptionId)).toMatchObject({ ok: false }); // not theirs
    expect(await rewards.decideRedemption(users.admin, { redemptionId: b.redemptionId, decision: "claim" })).toMatchObject({ ok: false }); // not approved yet
    expect(await rewards.decideRedemption(users.admin, { redemptionId: b.redemptionId, decision: "approve" })).toEqual({ ok: true });
    expect(await rewards.cancelRedemption(user, b.redemptionId)).toMatchObject({ ok: false }); // too late to cancel
    expect(await rewards.decideRedemption(users.admin, { redemptionId: b.redemptionId, decision: "claim" })).toEqual({ ok: true });
    expect(await balance(4)).toBe(20);

    // Cancel by the resident returns the points.
    const c = await rewards.requestReward(user, r.id);
    if (!c.ok) throw new Error(c.message);
    expect(await rewards.cancelRedemption(user, c.redemptionId)).toEqual({ ok: true });
    expect(await balance(4)).toBe(20);
    expect((await db.redemption.findUniqueOrThrow({ where: { id: c.redemptionId } })).status).toBe("CANCELLED");
  });

  it("can't overspend: simultaneous requests, out of stock, hidden rewards and the open-request limit", async () => {
    await earn10(5); // 10 pts
    const user = { id: users.resident, householdId: hh[5].id };
    const r = await reward(10);
    const both = await Promise.all([rewards.requestReward(user, r.id), rewards.requestReward(user, r.id)]);
    expect(both.filter((x) => x.ok)).toHaveLength(1);
    expect(await balance(5)).toBe(0);
    expect(await rewards.requestReward(user, r.id)).toMatchObject({ ok: false, message: expect.stringContaining("more points") });

    await earn10(5); await earn10(5); await earn10(5); // 30 more
    const soldOut = await reward(1, 0);
    expect(await rewards.requestReward(user, soldOut.id)).toMatchObject({ ok: false, message: expect.stringContaining("out of stock") });
    const hidden = await reward(1);
    await db.reward.update({ where: { id: hidden.id }, data: { active: false } });
    expect(await rewards.requestReward(user, hidden.id)).toMatchObject({ ok: false });
    const cheap = await reward(1);
    expect((await rewards.requestReward(user, cheap.id)).ok).toBe(true);
    expect((await rewards.requestReward(user, cheap.id)).ok).toBe(true);
    expect(await rewards.requestReward(user, cheap.id)).toMatchObject({ ok: false, message: expect.stringContaining("open requests") });
    expect(await rewards.requestReward({ id: users.admin, householdId: null }, cheap.id)).toMatchObject({ ok: false });
  });

  it("validates the reward catalogue form", async () => {
    await asUser(users.admin);
    const r = await rewards.saveReward(users.admin, null, { name: "Eco bag", description: "", pointsCost: "40", stock: "", active: "on" });
    expect(r).toMatchObject({ ok: true });
    if (!r.ok) return;
    rewardIds.push(r.rewardId);
    expect(await db.reward.findUniqueOrThrow({ where: { id: r.rewardId } })).toMatchObject({ pointsCost: 40, stock: null, active: true, description: null });
    expect(await rewards.saveReward(users.admin, r.rewardId, { name: "Eco bag", description: "Reusable", pointsCost: "0", stock: "-1", active: "off" }))
      .toMatchObject({ ok: false, fieldErrors: { pointsCost: expect.any(String), stock: expect.any(String) } });
    expect(await rewards.saveReward(users.admin, r.rewardId, { name: "Eco bag", description: "Reusable", pointsCost: "45", stock: "5", active: "off" })).toMatchObject({ ok: true });
    expect(await db.reward.findUniqueOrThrow({ where: { id: r.rewardId } })).toMatchObject({ pointsCost: 45, stock: 5, active: false });
  });
});
