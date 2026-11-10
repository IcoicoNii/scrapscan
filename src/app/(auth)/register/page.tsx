import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { homeFor } from "@/lib/rbac";
import { RegisterScreen } from "./register-screen";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage() {
  // Database-verified, so deactivated accounts with a stale cookie see the form instead of looping.
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));
  return <RegisterScreen />;
}
