"use server";

import { redirect } from "next/navigation";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { claimResident } from "@/lib/households";
import { parseLoginId } from "@/lib/identifiers";
import { getI18n } from "@/lib/i18n/server";
/** Values typed on the claim form (never passwords), put back after an error. */
export type FormState = { error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> } | undefined;

const KEEP_ON_ERROR = ["name", "householdName", "address", "purok", "householdCode"];

/** Finishes sign-up: links the signed-in Clerk user to a resident account (new household or join by code). */
export async function claimAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { userId } = await auth();
  if (!userId) redirect("/register");

  // Already claimed (e.g. the form was submitted twice): nothing to create.
  const existing = await db.user.findUnique({ where: { clerkId: userId }, select: { id: true } });
  if (existing) redirect("/after-sign-in");

  // Email and phone come from Clerk, which verified them with codes at sign-up.
  const client = await clerkClient();
  const clerkUser = await client.users.getUser(userId);
  const email = clerkUser.primaryEmailAddress?.emailAddress?.toLowerCase() ?? null;
  const phoneRaw = clerkUser.primaryPhoneNumber?.phoneNumber ?? null;
  const phone = phoneRaw ? parseLoginId(phoneRaw)?.value ?? null : null;

  const { t } = await getI18n();
  const raw = Object.fromEntries(formData);
  const result = await claimResident({ clerkId: userId, email, phone, raw }, t.errors.register);

  if (!result.ok) {
    const values: Record<string, string> = {};
    for (const k of KEEP_ON_ERROR) {
      const val = formData.get(k);
      if (typeof val === "string") values[k] = val.slice(0, 200);
    }
    return { fieldErrors: result.fieldErrors, values };
  }
  redirect("/citizen");
}
