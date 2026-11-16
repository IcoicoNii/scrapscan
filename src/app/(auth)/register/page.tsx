import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { homeFor } from "@/lib/rbac";
import { RegisterScreen } from "./register-screen";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage() {
  // Database-verified, so deactivated accounts with a stale cookie see the form instead of looping.
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));
  // Suggestions for the purok field, so the same purok isn't typed five different ways.
  const puroks = await db.household.findMany({ where: { status: "ACTIVE" }, distinct: ["purok"], select: { purok: true }, orderBy: { purok: "asc" } });
  return <RegisterScreen puroks={puroks.map((p) => p.purok)} />;
}
