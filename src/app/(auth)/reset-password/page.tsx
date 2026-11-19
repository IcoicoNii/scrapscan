import type { Metadata } from "next";
import { checkToken } from "@/lib/password-reset";
import { ResetScreen } from "./reset-screen";

export const metadata: Metadata = { title: "Choose a new password", referrer: "no-referrer" };

// The token is in the URL, so this page sends no Referer (see also next.config.ts) and loads nothing external.
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const state = await checkToken(token);
  return <ResetScreen token={state === "valid" ? token! : null} problem={state === "valid" ? null : state} />;
}
