import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { homeFor } from "@/lib/rbac";
import { LoginScreen } from "./login-screen";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  // Database-verified, so deactivated accounts with a stale cookie see the form instead of looping.
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));
  return <LoginScreen passwordReset={(await searchParams).reset === "1"} />;
}
