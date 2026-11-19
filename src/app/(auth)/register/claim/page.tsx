import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { linkLegacyResident } from "@/lib/legacy-link";
import { ClaimScreen } from "./claim-screen";

export const metadata: Metadata = { title: "Finish sign-up" };

export default async function ClaimPage() {
  // Only people who have just signed up with Clerk and have no account yet get this step.
  const { userId } = await auth();
  if (!userId) redirect("/register");
  const existing = await db.user.findUnique({ where: { clerkId: userId }, select: { id: true } });
  if (existing) redirect("/after-sign-in");

  // A resident who registered before Clerk: link their existing account instead of creating a new one.
  if (await linkLegacyResident(userId)) redirect("/after-sign-in");

  // Suggestions for the purok field, so the same purok isn't typed five different ways.
  const puroks = await db.household.findMany({ where: { status: "ACTIVE" }, distinct: ["purok"], select: { purok: true }, orderBy: { purok: "asc" } });
  return <ClaimScreen puroks={puroks.map((p) => p.purok)} />;
}
