import "server-only";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { parseLoginId } from "./identifiers";
import { appUrl, escapeHtml, type Mail } from "./mailer";

// Password reset by email.
//
// The emailed token is 32 random bytes; only its SHA-256 is stored. A token works once and expires after
// 30 minutes; asking again cancels older ones; at most 3 are made per account per hour. Asking always gets
// the same answer, whether or not the email has an account, so the form can't be used to find accounts.
// Results are codes, not sentences, so each page shows them in the reader's language.

export const TOKEN_TTL_MS = 30 * 60 * 1000;
export const MAX_PER_HOUR = 3;
type Lang = "en" | "fil";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export type RequestResult =
  | { ok: true; /** The email to send, when there's an account. Sent after the response so timing doesn't reveal it. */ mail: Mail | null }
  | { ok: false; error: "INVALID_EMAIL" | "PHONE" };

export async function requestReset(rawEmail: unknown, lang: Lang = "en", now = new Date()): Promise<RequestResult> {
  const id = typeof rawEmail === "string" ? parseLoginId(rawEmail) : null;
  if (!id) return { ok: false, error: "INVALID_EMAIL" };
  if (id.kind === "phone") return { ok: false, error: "PHONE" };

  const user = await db.user.findUnique({ where: { email: id.value }, select: { id: true, name: true, email: true, status: true } });
  if (!user || user.status !== "ACTIVE" || !user.email) return { ok: true, mail: null };

  const recent = await db.passwordResetToken.count({ where: { userId: user.id, createdAt: { gt: new Date(now.getTime() - 3_600_000) } } });
  if (recent >= MAX_PER_HOUR) return { ok: true, mail: null }; // quietly: same answer as everyone else

  const token = randomBytes(32).toString("base64url");
  await db.$transaction([
    db.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } }), // cancel older links
    db.passwordResetToken.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(now.getTime() + TOKEN_TTL_MS) } }),
  ]);
  return { ok: true, mail: resetEmail(user.email, user.name, appUrl(`/reset-password?token=${token}`), lang) };
}

export type TokenState = "valid" | "invalid" | "expired";

/** For the reset page: is this link still good? (Doesn't use it up.) */
export async function checkToken(token: unknown, now = new Date()): Promise<TokenState> {
  if (typeof token !== "string" || token.length < 20 || token.length > 100) return "invalid";
  const row = await db.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) }, include: { user: { select: { status: true } } } });
  if (!row || row.usedAt || row.user.status !== "ACTIVE") return "invalid";
  return row.expiresAt <= now ? "expired" : "valid";
}

export type ResetResult =
  | { ok: true }
  | { ok: false; error: TokenState | "FIELDS"; fieldErrors?: { password?: "TOO_SHORT" | "TOO_LONG"; confirm?: "MISMATCH" } };

/** Uses the link once: new password, every session signed out, other links cancelled. */
export async function resetPassword(token: unknown, password: unknown, confirm: unknown, now = new Date()): Promise<ResetResult> {
  const pw = typeof password === "string" ? password : "";
  const fieldErrors: NonNullable<Extract<ResetResult, { ok: false }>["fieldErrors"]> = {};
  if (pw.length < 8) fieldErrors.password = "TOO_SHORT";
  else if (pw.length > 200) fieldErrors.password = "TOO_LONG";
  if (pw !== confirm) fieldErrors.confirm = "MISMATCH";
  if (Object.keys(fieldErrors).length) return { ok: false, error: "FIELDS", fieldErrors };

  const state = await checkToken(token, now);
  if (state !== "valid") return { ok: false, error: state };
  const passwordHash = await bcrypt.hash(pw, 12);
  const hash = sha256(token as string);

  return db.$transaction(async (tx) => {
    // Compare-and-set: of two submissions of the same link, only one gets through.
    const row = await tx.passwordResetToken.findUniqueOrThrow({ where: { tokenHash: hash } });
    const { count } = await tx.passwordResetToken.updateMany({ where: { id: row.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
    if (count === 0) return { ok: false, error: "invalid" } as const;
    await tx.passwordResetToken.updateMany({ where: { userId: row.userId, usedAt: null }, data: { usedAt: now } });
    await tx.user.update({
      where: { id: row.userId },
      data: { passwordHash, mustChangePassword: false, sessionVersion: { increment: 1 } },
    });
    await tx.auditLog.create({ data: { actorId: row.userId, action: "account.password_reset_email", targetType: "User", targetId: row.userId } });
    return { ok: true } as const;
  });
}

// ---------- The email ----------

const COPY = {
  en: {
    subject: "Reset your ScrapScan password",
    hello: (name: string) => `Hi ${name},`,
    body: "Someone (hopefully you) asked to reset the password for your ScrapScan account. Open this link to choose a new one:",
    button: "Choose a new password",
    expiry: "The link works once, for 30 minutes.",
    ignore: "If you didn’t ask for this, you can ignore this email. Your password stays the same.",
  },
  fil: {
    subject: "I-reset ang password mo sa ScrapScan",
    hello: (name: string) => `Hi ${name},`,
    body: "May humiling (sana ikaw) na i-reset ang password ng ScrapScan account mo. Buksan ang link na ito para pumili ng bago:",
    button: "Pumili ng bagong password",
    expiry: "Isang beses lang gagana ang link, sa loob ng 30 minuto.",
    ignore: "Kung hindi ikaw ang humiling nito, balewalain mo na lang ang email na ito. Hindi magbabago ang password mo.",
  },
} as const;

function resetEmail(to: string, name: string, link: string, lang: Lang): Mail {
  const c = COPY[lang];
  const first = name.split(" ")[0] || name;
  return {
    to,
    subject: c.subject,
    text: `${c.hello(first)}\n\n${c.body}\n\n${link}\n\n${c.expiry}\n${c.ignore}\n\nScrapScan`,
    html: `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#252502;max-width:520px">
<p>${escapeHtml(c.hello(first))}</p>
<p>${escapeHtml(c.body)}</p>
<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#245900;color:#ffffff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:bold">${escapeHtml(c.button)}</a></p>
<p style="font-size:14px;color:#2c514c">${escapeHtml(c.expiry)}<br>${escapeHtml(c.ignore)}</p>
<p style="font-size:14px;color:#2c514c">ScrapScan</p>
</div>`,
  };
}
