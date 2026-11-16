// Runs the real server actions against a real Postgres (DATABASE_URL). Skipped when there is none.
try { process.loadEnvFile(".env"); } catch { /* CI may inject env instead */ }

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(fn: T) => fn }));

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { name: k, value: jar.get(k)! } : undefined),
    set: (k: string, v: string) => void jar.set(k, v),
    delete: (k: string) => void jar.delete(k),
  }),
  headers: async () => new Headers(),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { redirectTo: to });
  },
}));

const run = process.env.DATABASE_URL ? describe : describe.skip;

run("auth + RBAC against the real database", async () => {
  const { db } = await import("@/lib/db");
  const { loginAction, registerAction } = await import("../auth");
  const { createHouseholdAction } = await import("../households");
  const { ForbiddenError } = await import("@/lib/auth");

  const tag = Math.random().toString(36).slice(2, 8);
  const createdEmails: string[] = [];
  const claimedIds: string[] = [];
  const createdHouseholdIds: string[] = [];
  const phoneUsers: string[] = [];

  const form = (o: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(o)) f.set(k, v);
    return f;
  };
  const redirectOf = async (p: Promise<unknown>) => {
    try { await p; } catch (e) { return (e as { redirectTo?: string }).redirectTo; }
    return undefined;
  };
  const unclaimed = async (n: number) =>
    db.household.findMany({ where: { claimedAt: null, status: "ACTIVE" }, orderBy: { code: "desc" }, take: n });
  const signup = (code: string, email: string, extra: Record<string, string> = {}) =>
    registerAction(undefined, form({ mode: "join", name: "Test Resident", identifier: email, householdCode: code, password: "longenough1", confirm: "longenough1", terms: "on", ...extra }));

  beforeEach(() => jar.clear());

  afterAll(async () => {
    // Joining a household is audited with the new account as the actor.
    await db.auditLog.deleteMany({ where: { actor: { OR: [{ email: { in: createdEmails } }, { id: { in: phoneUsers } }] } } });
    await db.user.deleteMany({ where: { OR: [{ email: { in: createdEmails } }, { id: { in: phoneUsers } }] } });
    await db.household.updateMany({ where: { id: { in: claimedIds } }, data: { claimedAt: null } });
    await db.auditLog.deleteMany({ where: { targetId: { in: createdHouseholdIds } } });
    await db.qrCode.deleteMany({ where: { householdId: { in: createdHouseholdIds } } });
    await db.household.deleteMany({ where: { id: { in: createdHouseholdIds } } });
    await db.$disconnect();
  });

  it("registers a resident with a valid household code and signs them in", async () => {
    const [h] = await unclaimed(1);
    claimedIds.push(h.id);
    const email = `reg-${tag}@test.local`;
    createdEmails.push(email);
    const to = await redirectOf(signup(h.claimCode.toLowerCase(), email));
    expect(to).toBe("/citizen");
    expect(jar.get("ss_session")).toBeTruthy();
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    expect(user).toMatchObject({ role: "CITIZEN", householdId: h.id });
    expect(user.passwordHash).not.toContain("longenough1");
  });

  it("lets family members join the same household with its sign-up code", async () => {
    const [h] = await unclaimed(1);
    claimedIds.push(h.id);
    const a = `a-${tag}@test.local`, b = `b-${tag}@test.local`;
    createdEmails.push(a, b);
    expect(await redirectOf(signup(h.claimCode, a))).toBe("/citizen");
    jar.clear();
    expect(await redirectOf(signup(h.claimCode, b))).toBe("/citizen");
    expect(await db.user.count({ where: { householdId: h.id } })).toBe(2);
    expect(await signup("ZZZZ-ZZZZ", `c-${tag}@test.local`)).toMatchObject({ fieldErrors: { householdCode: expect.stringMatching(/isn’t valid/) } });
  });

  it("validates passwords, terms and identifiers", async () => {
    const [h] = await unclaimed(1);
    const mismatch = await signup(h.claimCode, `x-${tag}@test.local`, { confirm: "different" });
    expect(mismatch?.fieldErrors?.confirm).toBeTruthy();
    const noTerms = await registerAction(undefined, form({ name: "T R", identifier: "x@y.zz", householdCode: h.claimCode, password: "longenough1", confirm: "longenough1" }));
    expect(noTerms?.fieldErrors?.terms).toBeTruthy();
    const badId = await signup(h.claimCode, "not-an-id");
    expect(badId?.fieldErrors?.identifier).toBeTruthy();
  });

  it("routes admins and collectors to their own areas after login", async () => {
    expect(await redirectOf(loginAction(undefined, form({ identifier: "ADMIN@scrapscan.test", password: "Password123!" })))).toBe("/admin");
    jar.clear();
    expect(await redirectOf(loginAction(undefined, form({ identifier: "collector@scrapscan.test", password: "Password123!" })))).toBe("/collector");
  });

  it("signs up with a PH mobile number and logs in with any common format of it", async () => {
    const digits = String(Math.floor(Math.random() * 1e9)).padStart(9, "0");
    const local = `09${digits}`;
    const [h] = await unclaimed(1);
    claimedIds.push(h.id);
    expect(await redirectOf(signup(h.claimCode, local))).toBe("/citizen");
    const user = await db.user.findFirstOrThrow({ where: { householdId: h.id } });
    phoneUsers.push(user.id);
    expect(user.phone).toBe(`+639${digits}`);
    expect(user.email).toBeNull();
    for (const variant of [local, `+639${digits}`, `639${digits}`, `0 9${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`]) {
      jar.clear();
      expect(await redirectOf(loginAction(undefined, form({ identifier: variant, password: "longenough1" })))).toBe("/citizen");
    }
  });

  it("gives one generic error for wrong password and unknown account", async () => {
    const wrong = await loginAction(undefined, form({ identifier: "admin@scrapscan.test", password: "nope" }));
    const unknown = await loginAction(undefined, form({ identifier: "ghost@nowhere.test", password: "nope" }));
    expect(wrong?.error).toBeTruthy();
    expect(wrong?.error).toBe(unknown?.error);
    expect(jar.has("ss_session")).toBe(false);
  });

  it("blocks deactivated accounts even with the right password", async () => {
    const [h] = await unclaimed(1);
    claimedIds.push(h.id);
    const email = `off-${tag}@test.local`;
    createdEmails.push(email);
    await redirectOf(signup(h.claimCode, email));
    await db.user.update({ where: { email }, data: { status: "INACTIVE" } });
    jar.clear();
    const res = await loginAction(undefined, form({ identifier: email, password: "longenough1" }));
    expect(res?.error).toMatch(/turned off/);
    expect(jar.has("ss_session")).toBe(false);
  });

  it("only admins can create households, and creation is audited", async () => {
    // not signed in
    await expect(createHouseholdAction(undefined, form({ name: "X Household", address: "Blk 1", purok: "Purok 9" }))).rejects.toBeInstanceOf(ForbiddenError);
    // collector
    await redirectOf(loginAction(undefined, form({ identifier: "collector@scrapscan.test", password: "Password123!" })));
    await expect(createHouseholdAction(undefined, form({ name: "X Household", address: "Blk 1", purok: "Purok 9" }))).rejects.toBeInstanceOf(ForbiddenError);
    // admin
    jar.clear();
    await redirectOf(loginAction(undefined, form({ identifier: "admin@scrapscan.test", password: "Password123!" })));
    const res = await createHouseholdAction(undefined, form({ name: `Test ${tag} household`, address: "Blk 1", purok: "Purok 9" }));
    expect(res?.created?.code).toMatch(/^HH-\d{5}$/);
    expect(res?.created?.claimCode).toMatch(/^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
    const h = await db.household.findUniqueOrThrow({ where: { code: res!.created!.code }, include: { qrCodes: true } });
    createdHouseholdIds.push(h.id);
    expect(h.qrCodes).toHaveLength(1);
    expect(h.qrCodes[0].token.startsWith("SS1.")).toBe(true);
    expect(await db.auditLog.count({ where: { targetId: h.id, action: "household.create" } })).toBe(1);
  });
});
