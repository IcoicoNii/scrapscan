"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { sendMail } from "@/lib/mailer";
import { requestReset, resetPassword } from "@/lib/password-reset";
import { getLocale } from "@/lib/i18n/server";

export type ForgotState = { sent?: boolean; error?: "INVALID_EMAIL" | "PHONE"; email?: string } | undefined;

export async function requestResetAction(_prev: ForgotState, fd: FormData): Promise<ForgotState> {
  const email = fd.get("email");
  const r = await requestReset(email, await getLocale()); // the email is written in the reader's language
  if (!r.ok) return { error: r.error, email: typeof email === "string" ? email.slice(0, 200) : "" };
  const mail = r.mail;
  // Sent after the response, so an existing account doesn't answer slower than a missing one.
  if (mail) after(() => sendMail(mail).catch((e) => console.error("[mail] password reset email failed:", e)));
  return { sent: true };
}

export type ResetState =
  | { error?: "invalid" | "expired"; fieldErrors?: { password?: "TOO_SHORT" | "TOO_LONG"; confirm?: "MISMATCH" } }
  | undefined;

export async function resetPasswordAction(_prev: ResetState, fd: FormData): Promise<ResetState> {
  const r = await resetPassword(fd.get("token"), fd.get("password"), fd.get("confirm"));
  if (!r.ok) return r.error === "FIELDS" ? { fieldErrors: r.fieldErrors } : { error: r.error === "valid" ? "invalid" : r.error };
  redirect("/login?reset=1");
}
