// Password reset by email, against a real Postgres (DATABASE_URL). Skipped when there is no database.
try { process.loadEnvFile(".env"); } catch { /* CI may inject env instead */ }

import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

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

const run = process.env.DATABASE_URL ? describe : describe.skip;

run("password reset by email against the real database", async () => {
  const { db } = await import("@/lib/db");
  const { requestReset, resetPassword, checkToken, MAX_PER_HOUR, TOKEN_TTL_MS } = await import("@/lib/password-reset");
  const { createSession } = await import("@/lib/session");
  const { getCurrentUser } = await import("@/lib/auth");
  const { lookupHousehold } = await import("@/lib/collections");
  const { fil } = await import("@/lib/i18n/fil");

  const tag = Math.random().toString(36).slice(2, 8);
  const ids: string[] = [];
  const make = async (k: string, extra: { email?: string | null; phone?: string; status?: "ACTIVE" | "INACTIVE"; mustChangePassword?: boolean } = {}) => {
    const u = await db.user.create({
      data: {
        name: `Reset ${k}`, role: "CITIZEN", passwordHash: await bcrypt.hash("OldPass123", 4),
        email: extra.email === undefined ? `reset-${k}-${tag}@test.local` : extra.email,
        phone: extra.phone, status: extra.status ?? "ACTIVE", mustChangePassword: extra.mustChangePassword ?? false,
      },
    });
    ids.push(u.id);
    return u;
  };
  /** The token is only in the emailed link; read it back out of the email text. */
  const tokenFrom = (text: string) => new URL(text.match(/https?:\/\/\S+/)![0]).searchParams.get("token")!;

  beforeAll(() => { process.env.APP_URL = "http://localhost:3000"; });
  afterAll(async () => {
    await db.auditLog.deleteMany({ where: { actorId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } }); // tokens cascade
    await db.$disconnect();
  });

  it("answers the same way whether or not the email has an account, and only emails real, active accounts", async () => {
    const u = await make("a");
    const off = await make("off", { status: "INACTIVE" });
    const known = await requestReset(u.email!);
    const unknown = await requestReset(`nobody-${tag}@test.local`);
    const inactive = await requestReset(off.email!);
    expect(known).toMatchObject({ ok: true, mail: { to: u.email } });
    expect(unknown).toEqual({ ok: true, mail: null });
    expect(inactive).toEqual({ ok: true, mail: null });
    expect(await requestReset("not an email")).toEqual({ ok: false, error: "INVALID_EMAIL" });
    expect(await requestReset("09171234567")).toEqual({ ok: false, error: "PHONE" });
  });

  it("stores only a hash of the token; the email links to APP_URL, not the request's host", async () => {
    const u = await make("b");
    const r = await requestReset(u.email!.toUpperCase());
    if (!r.ok || !r.mail) throw new Error("no mail");
    expect(r.mail.text).toContain("http://localhost:3000/reset-password?token=");
    const token = tokenFrom(r.mail.text);
    const row = await db.passwordResetToken.findFirstOrThrow({ where: { userId: u.id } });
    expect(row.tokenHash).toBe(createHash("sha256").update(token).digest("hex"));
    expect(row.tokenHash).not.toContain(token);
    expect(row.expiresAt.getTime() - row.createdAt.getTime()).toBeCloseTo(TOKEN_TTL_MS, -3);
  });

  it("a reset works once, signs out old sessions and clears a temporary password", async () => {
    const u = await make("c", { mustChangePassword: true });
    jar.clear();
    await createSession(u.id, "CITIZEN");
    expect((await getCurrentUser())?.id).toBe(u.id);

    const r = await requestReset(u.email!);
    const token = tokenFrom(r.ok && r.mail ? r.mail.text : "");
    expect(await checkToken(token)).toBe("valid");
    expect(await resetPassword(token, "short", "short")).toMatchObject({ ok: false, error: "FIELDS", fieldErrors: { password: "TOO_SHORT" } });
    expect(await resetPassword(token, "NewPass123", "Different1")).toMatchObject({ ok: false, fieldErrors: { confirm: "MISMATCH" } });
    expect(await resetPassword(token, "NewPass123", "NewPass123")).toEqual({ ok: true });

    const after = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(await bcrypt.compare("NewPass123", after.passwordHash)).toBe(true);
    expect(after.mustChangePassword).toBe(false);
    expect(await getCurrentUser()).toBeNull(); // the old session no longer works
    expect(await resetPassword(token, "Another123", "Another123")).toMatchObject({ ok: false, error: "invalid" });
    expect(await checkToken(token)).toBe("invalid");
    expect(await db.auditLog.count({ where: { actorId: u.id, action: "account.password_reset_email" } })).toBe(1);
  });

  it("a newer link cancels the older one; links expire after 30 minutes", async () => {
    const u = await make("d");
    const first = await requestReset(u.email!);
    const second = await requestReset(u.email!);
    const t1 = tokenFrom(first.ok && first.mail ? first.mail.text : "");
    const t2 = tokenFrom(second.ok && second.mail ? second.mail.text : "");
    expect(await checkToken(t1)).toBe("invalid");
    expect(await checkToken(t2)).toBe("valid");
    const later = new Date(Date.now() + TOKEN_TTL_MS + 1000);
    expect(await checkToken(t2, later)).toBe("expired");
    expect(await resetPassword(t2, "NewPass123", "NewPass123", later)).toMatchObject({ ok: false, error: "expired" });
    expect(await checkToken("nonsense")).toBe("invalid");
  });

  it(`makes at most ${MAX_PER_HOUR} links per account per hour, without saying so`, async () => {
    const u = await make("e");
    const results = [];
    for (let i = 0; i < MAX_PER_HOUR + 2; i++) results.push(await requestReset(u.email!));
    expect(results.filter((r) => r.ok && r.mail)).toHaveLength(MAX_PER_HOUR);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(await db.passwordResetToken.count({ where: { userId: u.id } })).toBe(MAX_PER_HOUR);
  });

  it("writes the email in Filipino when asked", async () => {
    const u = await make("f");
    const r = await requestReset(u.email!, "fil");
    expect(r.ok && r.mail?.subject).toBe("I-reset ang password mo sa ScrapScan");
    // Collector messages come back in the language the caller passes.
    expect(await lookupHousehold({ code: "HH-99999" }, new Date(), fil.errors.collection)).toMatchObject({
      ok: false, error: "HOUSEHOLD_NOT_FOUND", message: fil.errors.collection.numberUnknown,
    });
  });
});
