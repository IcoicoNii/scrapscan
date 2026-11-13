import "server-only";
import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "./db";
import { parseLoginId } from "./identifiers";

// Account management for admins, plus changing your own password. Admins never see or choose
// passwords: they hand out a one-time temporary password, and the next page load asks for a new one.

// Lowercase and no look-alikes (0/o, 1/l/i), so it's easy to read aloud and type on a phone.
const TEMP_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
export const generateTempPassword = () => Array.from({ length: 10 }, () => TEMP_ALPHABET[randomInt(TEMP_ALPHABET.length)]).join("");

const hash = (password: string) => bcrypt.hash(password, 12);
const isUniqueViolation = (e: unknown) => typeof e === "object" && e !== null && "code" in e && e.code === "P2002";

export type AccountError = { ok: false; message: string; fieldErrors?: Record<string, string> };

export const staffAccountSchema = z.object({
  name: z.string().trim().min(2, "Enter their full name.").max(80),
  identifier: z.string().trim().min(1, "Enter their email or mobile number."),
  role: z.enum(["COLLECTOR", "ADMIN"], { error: "Choose collector or admin." }),
});

/** Collectors and admins are created by an admin. Residents sign up themselves with a household code. */
export async function createStaffAccount(
  adminId: string,
  raw: unknown,
): Promise<{ ok: true; userId: string; name: string; login: string; tempPassword: string } | AccountError> {
  const parsed = staffAccountSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { name, identifier, role } = parsed.data;
  const id = parseLoginId(identifier);
  if (!id) return { ok: false, message: "Check the highlighted field.", fieldErrors: { identifier: "Enter a valid email or a Philippine mobile number (09XX XXX XXXX)." } };

  const tempPassword = generateTempPassword();
  try {
    const user = await db.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          name, role, passwordHash: await hash(tempPassword), mustChangePassword: true,
          ...(id.kind === "email" ? { email: id.value } : { phone: id.value }),
        },
      });
      await tx.auditLog.create({ data: { actorId: adminId, action: "account.create", targetType: "User", targetId: u.id, meta: { role } } });
      return u;
    });
    return { ok: true, userId: user.id, name: user.name, login: id.value, tempPassword };
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    return { ok: false, message: "Check the highlighted field.", fieldErrors: { identifier: "An account with this email or number already exists." } };
  }
}

/** New temporary password. Signs the account out everywhere; the old password stops working. */
export async function resetPassword(adminId: string, userId: string): Promise<{ ok: true; tempPassword: string } | AccountError> {
  if (adminId === userId) return { ok: false, message: "To change your own password, use Change password on your profile." };
  const tempPassword = generateTempPassword();
  const passwordHash = await hash(tempPassword);
  const done = await db.$transaction(async (tx) => {
    const { count } = await tx.user.updateMany({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: true, sessionVersion: { increment: 1 } },
    });
    if (count) await tx.auditLog.create({ data: { actorId: adminId, action: "account.password_reset", targetType: "User", targetId: userId } });
    return count > 0;
  });
  return done ? { ok: true, tempPassword } : { ok: false, message: "That account doesn’t exist." };
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

  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { role: true, status: true } });
    if (!user) return { ok: false, message: "That account doesn’t exist." } as const;
    if (user.status === status) return { ok: true } as const;
    if (status === "INACTIVE" && user.role === "ADMIN") {
      // Lock the admin rows so two admins can't turn each other off at the same moment.
      await tx.$queryRaw`SELECT id FROM "User" WHERE role = 'ADMIN' AND status = 'ACTIVE' FOR UPDATE`;
      const admins = await tx.user.count({ where: { role: "ADMIN", status: "ACTIVE" } });
      if (admins <= 1) return { ok: false, message: "This is the last active admin account, so it can’t be turned off." } as const;
    }
    await tx.user.update({
      where: { id: userId },
      // Reactivating doesn't revive old sessions: they need to log in again.
      data: { status, sessionVersion: { increment: 1 } },
    });
    await tx.auditLog.create({
      data: { actorId: adminId, action: status === "ACTIVE" ? "account.activate" : "account.deactivate", targetType: "User", targetId: userId, reason },
    });
    return { ok: true } as const;
  });
}

export const changePasswordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password."),
    password: z.string().min(8, "Use at least 8 characters.").max(200),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Passwords don't match." })
  .refine((d) => d.password !== d.current, { path: ["password"], message: "Choose a password that’s different from the current one." });

/** Signs out the account's other sessions; the caller makes a fresh one for this device. */
export async function changeOwnPassword(userId: string, raw: unknown): Promise<{ ok: true } | AccountError> {
  const parsed = changePasswordSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const user = await db.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user || !(await bcrypt.compare(parsed.data.current, user.passwordHash))) {
    return { ok: false, message: "Check the highlighted field.", fieldErrors: { current: "That’s not your current password." } };
  }
  const passwordHash = await hash(parsed.data.password);
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: false, sessionVersion: { increment: 1 } } }),
    db.auditLog.create({ data: { actorId: userId, action: "account.password_change", targetType: "User", targetId: userId } }),
  ]);
  return { ok: true };
}

function invalid(error: z.ZodError): AccountError {
  const fieldErrors: Record<string, string> = {};
  for (const i of error.issues) fieldErrors[String(i.path[0] ?? "form")] ??= i.message;
  return { ok: false, message: error.issues[0]?.message ?? "Check the form and try again.", fieldErrors };
}
