import type { Metadata } from "next";
import { mailEnabled } from "@/lib/mailer";
import { ForgotScreen } from "./forgot-screen";

export const metadata: Metadata = { title: "Forgot password" };

// Email resets need SMTP (or development's console mail). Without it the page says to ask the admin,
// instead of showing a form that can't deliver anything.
export default function ForgotPasswordPage() {
  return <ForgotScreen enabled={mailEnabled()} />;
}
