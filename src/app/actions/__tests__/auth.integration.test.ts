// Who counts as signed in, against a real Postgres (DATABASE_URL). Clerk is replaced by the test fake.
// Skipped when there is no database.
try { process.loadEnvFile(".env"); } catch { /* CI may inject env instead */ }

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(fn: T) => fn }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`REDIRECT:${to}`); } }));
vi.mock("@clerk/nextjs/server", async () => (await import("@/test/clerk-fake")).clerkModule);

const run = process.env.DATABASE_URL ? describe : describe.skip;

run("access checks against the real database", async () => {
  const { db } = await import("@/lib/db");
  const { getCurrentUser, requirePermission, ForbiddenError } = await import("@/lib/auth");
  const { setCurrentClerkUser } = await import("@/test/clerk-fake");

  const tag = Math.random().toString(36).slice(2, 8);
  const created: string[] = [];
  const make = async (role: "ADMIN" | "COLLECTOR" | "CITIZEN", status: "ACTIVE" | "INACTIVE" = "ACTIVE") => {
    const clerkId = `user_acc_${randomUUID()}`;
    const user = await db.user.create({
      data: { name: `Test ${role} ${status}`, role, status, email: `acc-${role}-${status}-${tag}@test.local`.toLowerCase(), clerkId },
    });
    created.push(user.id);
    return { id: user.id, clerkId };
  };

  let admin: { id: string; clerkId: string };
  let collector: { id: string; clerkId: string };
  let resident: { id: string; clerkId: string };
  let inactive: { id: string; clerkId: string };

  beforeAll(async () => {
    admin = await make("ADMIN");
    collector = await make("COLLECTOR");
    resident = await make("CITIZEN");
    inactive = await make("COLLECTOR", "INACTIVE");
  });

  afterAll(async () => {
    setCurrentClerkUser(null);
    if (created.length) await db.user.deleteMany({ where: { id: { in: created } } });
  });

  it("with no Clerk session, nobody is signed in", async () => {
    setCurrentClerkUser(null);
    expect(await getCurrentUser()).toBeNull();
  });

  it("a linked, active account is signed in with its database role", async () => {
    setCurrentClerkUser(collector.clerkId);
    expect(await getCurrentUser()).toMatchObject({ id: collector.id, role: "COLLECTOR" });
  });

  it("a Clerk login with no account row is not signed in", async () => {
    setCurrentClerkUser(`user_nobody_${randomUUID()}`);
    expect(await getCurrentUser()).toBeNull();
  });

  it("an inactive account is not signed in, even with a valid Clerk session", async () => {
    setCurrentClerkUser(inactive.clerkId);
    expect(await getCurrentUser()).toBeNull();
  });

  it("a resident is refused admin-only actions", async () => {
    setCurrentClerkUser(resident.clerkId);
    await expect(requirePermission("user:manage")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("an admin passes the admin-only check", async () => {
    setCurrentClerkUser(admin.clerkId);
    await expect(requirePermission("user:manage")).resolves.toMatchObject({ id: admin.id, role: "ADMIN" });
  });
});
