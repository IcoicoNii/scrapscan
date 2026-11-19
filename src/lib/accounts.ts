import "server-only";
import { randomInt } from "node:crypto";
import { clerkClient } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "./db";
import { parseLoginId } from "./identifiers";
import { en } from "./i18n/en";

// Account management for admins, plus changing your own password. Passwords live in Clerk now.
// Admins never see or choose them: they hand out a one-time temporary password, and the next page
// load asks for a new one.

// Lowercase and no look-alikes (0/o, 1/l/i), so it's easy to read aloud and type on a phone.
const TEMP_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
export const generateTempPassword = () => Array.from({ length: 10 }, () => TEMP_ALPHABET[randomInt(TEMP_ALPHABET.length)]).join("");

const isUniqueViolation = (e: unknown) => typeof e === "object" && e !== null && "code" in e && e.code === "P2002";

/** A unique Clerk username from the person's name, e.g. "club_sandwich_k7qm". Letters, digits and underscores only. */
export const generateUsername = (name: string) => {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 20) || "user";
  const suffix = Array.from({ length: 4 }, () => TEMP_ALPHABET[randomInt(TEMP_ALPHABET.length)]).join("");
  return `${slug}_${suffix}`;
};

export type AccountError = { ok: false; message: string; fieldErrors?: Record<string, string> };

type Clerk = Awaited<ReturnType<typeof clerkClient>>;

/** Clerk's own wording when it has one, so the admin sees why a login couldn't be made. */
function clerkErrorMessage(e: unknown): string {
  const first = (e as { errors?: { longMessage?: string; message?: string }[] })?.errors?.[0];
  return first?.longMessage ?? first?.message ?? "Clerk couldn’t complete that. Try again.";
}

/** Ends every active session of a Clerk user, on every device. */
async function revokeSessions(client: Clerk, clerkId: string) {
  const sessions = await client.sessions.getSessionList({ userId: clerkId, status: "active" });
  for (const s of sessions.data) await client.sessions.revokeSession(s.id);
}

export const staffAccountSchema = z.object({
  name: z.string().trim().min(2, "Enter their full name.").max(80),
  identifier: z.string().trim().min(1, "Enter their email address."),
  role: z.enum(["COLLECTOR", "ADMIN"], { error: "Choose collector or admin." }),
});

/** Collectors and admins are created by an admin, with an email address (they sign in with a code sent there). Residents sign up themselves with a household code. */
export async function createStaffAccount(
  adminId: string,
  raw: unknown,
): Promise<{ ok: true; userId: string; name: string; login: string; tempPassword: string } | AccountError> {
  const parsed = staffAccountSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { name, identifier, role } = parsed.data;
  const id = parseLoginId(identifier);
  if (!id || id.kind !== "email") {
    return { ok: false, message: "Check the highlighted field.", fieldErrors: { identifier: "Enter a valid email address." } };
  }
  const email = id.value;
  const taken = { ok: false as const, message: "Check the highlighted field.", fieldErrors: { identifier: "An account with this email already exists." } };
  if (await db.user.findUnique({ where: { email }, select: { id: true } })) return taken;

  const tempPassword = generateTempPassword();
  const client = await clerkClient();
  let clerkId: string;
  try {
    const clerkUser = await client.users.createUser({
      emailAddress: [email],
      emailAddressIdentificationStatus: ["verified"],
      // This Clerk instance requires a username. Staff sign in by email, so it only needs to be unique.
      username: generateUsername(name),
      firstName: name,
      password: tempPassword,
      skipPasswordChecks: true,
    });
    clerkId = clerkUser.id;
  } catch (e) {
    return { ok: false, message: clerkErrorMessage(e) };
  }

  try {
    const user = await db.$transaction(async (tx) => {
      const u = await tx.user.create({ data: { name, role, email, clerkId, mustChangePassword: true } });
      await tx.auditLog.create({ data: { actorId: adminId, action: "account.create", targetType: "User", targetId: u.id, meta: { role } } });
      return u;
    });
    return { ok: true, userId: user.id, name: user.name, login: email, tempPassword };
  } catch (e) {
    // Don't leave a login behind that has no account row.
    await client.users.deleteUser(clerkId).catch(() => undefined);
    if (!isUniqueViolation(e)) throw e;
    return taken;
  }
}

/** New temporary password. Signs the account out everywhere; the old password stops working. */
export async function resetPassword(adminId: string, userId: string): Promise<{ ok: true; tempPassword: string } | AccountError> {
  if (adminId === userId) return { ok: false, message: "To change your own password, use Change password on your profile." };
  const target = await db.user.findUnique({ where: { id: userId }, select: { clerkId: true } });
  if (!target) return { ok: false, message: "That account doesn’t exist." };
  if (!target.clerkId) return { ok: false, message: "This account isn’t linked to a login yet." };

  const tempPassword = generateTempPassword();
  const client = await clerkClient();
  try {
    await client.users.updateUser(target.clerkId, { password: tempPassword, skipPasswordChecks: true });
  } catch (e) {
    return { ok: false, message: clerkErrorMessage(e) };
  }
  await revokeSessions(client, target.clerkId);
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { mustChangePassword: true } });
    await tx.auditLog.create({ data: { actorId: adminId, action: "account.password_reset", targetType: "User", targetId: userId } });
  });
  return { ok: true, tempPassword };
}

const statusSchema = z.object({
  userId: z.string().min(1),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  reason: z.string({ error: "Write a reason." }).trim().min(3, "Write a reason (at least a few words).").max(300),
});

/** Turn an account off (it loses access on its next request) or back on. */
export async function setAccountStatus(adminId: string, raw: unknown): Promise<{ ok: true } | AccountError> {
  const parsed = statusSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { userId, status, reason } = parsed.data;
  if (userId === adminId) return { ok: false, message: "You can’t turn off your own account." };

  // The database decides first (the last-admin rule), then Clerk is updated to match.
  const result = await db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { role: true, status: true, clerkId: true } });
    if (!user) return { ok: false, message: "That account doesn’t exist." } as const;
    if (user.status === status) return { ok: true, clerkId: user.clerkId } as const;
    if (status === "INACTIVE" && user.role === "ADMIN") {
      // Lock the admin rows so two admins can't turn each other off at the same moment.
      await tx.$queryRaw`SELECT id FROM "User" WHERE role = 'ADMIN' AND status = 'ACTIVE' FOR UPDATE`;
      const admins = await tx.user.count({ where: { role: "ADMIN", status: "ACTIVE" } });
      if (admins <= 1) return { ok: false, message: "This is the last active admin account, so it can’t be turned off." } as const;
    }
    await tx.user.update({ where: { id: userId }, data: { status } });
    await tx.auditLog.create({
      data: { actorId: adminId, action: status === "ACTIVE" ? "account.activate" : "account.deactivate", targetType: "User", targetId: userId, reason },
    });
    return { ok: true, clerkId: user.clerkId } as const;
  });
  if (!result.ok) return result;

  // Even if this Clerk call failed, the database check already refuses the account on its next request.
  if (result.clerkId) {
    const client = await clerkClient();
    if (status === "INACTIVE") {
      await client.users.banUser(result.clerkId);
      await revokeSessions(client, result.clerkId);
    } else {
      await client.users.unbanUser(result.clerkId);
    }
  }
  return { ok: true };
}

/** Change-password messages in one language (the page passes the reader's). */
export type PasswordMessages = Pick<
  { [K in keyof typeof en.changePassword]: string },
  "errorCurrent" | "errorMissingCurrent" | "errorTooShort" | "errorMismatch" | "errorSame"
>;
const EN_PASSWORD: PasswordMessages = en.changePassword;

const changePasswordSchema = (m: PasswordMessages) =>
  z
    .object({
      current: z.string().min(1, m.errorMissingCurrent),
      password: z.string().min(8, m.errorTooShort).max(200),
      confirm: z.string(),
    })
    .refine((d) => d.password === d.confirm, { path: ["confirm"], message: m.errorMismatch })
    .refine((d) => d.password !== d.current, { path: ["password"], message: m.errorSame });

/** Checks the current password with Clerk, then sets the new one. */
export async function changeOwnPassword(userId: string, raw: unknown, m: PasswordMessages = EN_PASSWORD): Promise<{ ok: true } | AccountError> {
  const parsed = changePasswordSchema(m).safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const user = await db.user.findUnique({ where: { id: userId }, select: { clerkId: true } });
  if (!user?.clerkId) return { ok: false, message: m.errorCurrent, fieldErrors: { current: m.errorCurrent } };

  const client = await clerkClient();
  try {
    await client.users.verifyPassword({ userId: user.clerkId, password: parsed.data.current });
  } catch {
    return { ok: false, message: m.errorCurrent, fieldErrors: { current: m.errorCurrent } };
  }
  try {
    await client.users.updateUser(user.clerkId, { password: parsed.data.password });
  } catch (e) {
    return { ok: false, message: clerkErrorMessage(e), fieldErrors: { password: clerkErrorMessage(e) } };
  }
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { mustChangePassword: false } }),
    db.auditLog.create({ data: { actorId: userId, action: "account.password_change", targetType: "User", targetId: userId } }),
  ]);
  return { ok: true };
}

function invalid(error: z.ZodError): AccountError {
  const fieldErrors: Record<string, string> = {};
  for (const i of error.issues) fieldErrors[String(i.path[0] ?? "form")] ??= i.message;
  return { ok: false, message: error.issues[0]?.message ?? "Check the form and try again.", fieldErrors };
}
