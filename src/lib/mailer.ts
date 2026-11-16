import "server-only";
import nodemailer from "nodemailer";

// Outgoing email (only password resets for now).
//
// Production: SMTP, configured with SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / MAIL_FROM, and APP_URL for links.
// Development (or MAIL_TRANSPORT=log): nothing is sent; the email is printed to the server console.
// Unconfigured production: email is off, and the app falls back to "ask your barangay admin".

export type Mail = { to: string; subject: string; text: string; html: string };

const env = (k: string) => process.env[k]?.trim() || undefined;
const smtpConfigured = () => Boolean(env("SMTP_HOST") && env("SMTP_USER") && env("SMTP_PASS") && env("MAIL_FROM"));
const logOnly = () => env("MAIL_TRANSPORT") === "log" || (process.env.NODE_ENV !== "production" && !smtpConfigured());

/**
 * Links in emails are built from APP_URL, never from the request's Host header: a forged Host header
 * would otherwise make the app email a reset link pointing at someone else's site.
 */
function appBase(): string | null {
  const url = env("APP_URL");
  if (url) return url.replace(/\/+$/, "");
  return process.env.NODE_ENV !== "production" ? "http://localhost:3000" : null;
}

/** Whether the app can email people right now. */
export const mailEnabled = () => appBase() !== null && (smtpConfigured() || logOnly());

export function appUrl(path: string): string {
  const base = appBase();
  if (!base) throw new Error("APP_URL must be set to send links by email");
  return `${base}${path}`;
}

let transport: nodemailer.Transporter | null = null;
function smtp() {
  transport ??= nodemailer.createTransport({
    host: env("SMTP_HOST"),
    port: Number(env("SMTP_PORT") ?? 587),
    secure: Number(env("SMTP_PORT") ?? 587) === 465,
    auth: { user: env("SMTP_USER"), pass: env("SMTP_PASS") },
  });
  return transport;
}

export async function sendMail(mail: Mail): Promise<void> {
  if (logOnly()) {
    console.info(`\n[mail] To: ${mail.to}\n[mail] Subject: ${mail.subject}\n${mail.text}\n[mail] (not sent: development / MAIL_TRANSPORT=log)\n`);
    return;
  }
  if (!smtpConfigured()) throw new Error("Email isn't configured (SMTP_* and MAIL_FROM)");
  await smtp().sendMail({ from: env("MAIL_FROM"), to: mail.to, subject: mail.subject, text: mail.text, html: mail.html });
}

/** Escapes text for the small HTML emails we build. */
export const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
