import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db } from "./db";
import { can, homeFor, type Permission, type Role } from "./rbac";

// Clerk proves who is signed in; the database decides what they can do. Re-checked on every
// request, so a deactivated account loses access immediately.
// A Clerk session with no matching User row (e.g. mid-sign-up, before the claim code) counts as signed out.
export const getCurrentUser = cache(async () => {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await db.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, name: true, role: true, status: true, householdId: true, mustChangePassword: true },
  });
  if (!user || user.status !== "ACTIVE") return null;
  return { id: user.id, name: user.name, role: user.role, status: user.status, householdId: user.householdId, mustChangePassword: user.mustChangePassword };
});

export const CHANGE_PASSWORD_PATH = "/change-password";

/** For pages/layouts: redirects instead of throwing. */
export async function requireRole(role: Role) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== role) redirect(homeFor(user.role));
  // Temporary password from an admin: choose a new one before using the app.
  if (user.mustChangePassword) redirect(CHANGE_PASSWORD_PATH);
  return user;
}

export class ForbiddenError extends Error {}

/** For server actions and route handlers: always call this, UI hiding is not security. */
export async function requirePermission(permission: Permission) {
  const user = await getCurrentUser();
  if (!user) throw new ForbiddenError("UNAUTHENTICATED");
  if (!can(user.role, permission)) throw new ForbiddenError(permission);
  return user;
}

/** For pages: same check as requirePermission, but redirects instead of throwing (no error noise
 *  when a layout is already redirecting a signed-out or deactivated user). */
export async function requirePagePermission(permission: Permission) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user.role, permission)) redirect(homeFor(user.role));
  return user;
}
