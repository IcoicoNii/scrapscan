import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { homeFor } from "@/lib/rbac";
import { LoginScreen } from "../login-screen";
import { PendingSetupScreen } from "../pending-setup-screen";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage() {
  // Database-verified, so deactivated accounts see the form instead of looping.
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));

  // Signed in to Clerk without an active account: show the choice instead of Clerk's sign-in form,
  // which would send them straight back to the claim page. No account is created here.
  const { userId } = await auth();
  if (userId) {
    const row = await db.user.findUnique({ where: { clerkId: userId }, select: { id: true } });
    return <PendingSetupScreen inactive={Boolean(row)} />;
  }
  return <LoginScreen />;
}
