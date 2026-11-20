import "server-only";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "./db";
import { parseLoginId } from "./identifiers";

/**
 * Residents registered before Clerk have an account row with no Clerk link. When one of them signs in with
 * the email or mobile number on that row, Clerk has verified they own it, so the Clerk login is linked to the
 * existing account (its household and points stay). Returns true if a row was linked.
 */
export async function linkLegacyResident(clerkId: string): Promise<boolean> {
  const client = await clerkClient();
  const clerkUser = await client.users.getUser(clerkId);
  const email = clerkUser.primaryEmailAddress?.emailAddress?.toLowerCase() ?? null;
  const phoneRaw = clerkUser.primaryPhoneNumber?.phoneNumber ?? null;
  const phone = phoneRaw ? parseLoginId(phoneRaw)?.value ?? null : null;

  const match = [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])];
  if (match.length === 0) return false;

  const legacy = await db.user.findFirst({
    where: { clerkId: null, role: "CITIZEN", OR: match },
    select: { id: true },
  });
  if (!legacy) return false;

  await db.$transaction([
    db.user.update({ where: { id: legacy.id }, data: { clerkId } }),
    db.auditLog.create({ data: { actorId: legacy.id, action: "account.link_clerk", targetType: "User", targetId: legacy.id } }),
  ]);
  return true;
}
