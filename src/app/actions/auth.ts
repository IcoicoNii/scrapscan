"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession } from "@/lib/session";
import { homeFor } from "@/lib/rbac";
import { parseLoginId } from "@/lib/identifiers";
import { registerResident } from "@/lib/households";

/** values: what was typed (never passwords), put back after React resets the form on an error. */
export type FormState = { error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> } | undefined;

const KEEP_ON_ERROR = ["name", "identifier", "householdName", "address", "purok", "householdCode"];

// Compared against when the account doesn't exist, so response time doesn't reveal who has an account.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your email or mobile number."),
  password: z.string().min(1, "Enter your password."),
});

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details and try again." };
  }
  const id = parseLoginId(parsed.data.identifier);
  const user = id
    ? await db.user.findUnique({
        where: id.kind === "email" ? { email: id.value } : { phone: id.value },
      })
    : null;

  const ok = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) return { error: "Wrong email, mobile number or password." };
  if (user.status !== "ACTIVE") {
    return { error: "This account is turned off. Ask your barangay admin for help." };
  }

  await createSession(user.id, user.role);
  redirect(user.mustChangePassword ? "/change-password" : homeFor(user.role));
}

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const result = await registerResident(Object.fromEntries(formData));
  if (!result.ok) {
    const values: Record<string, string> = {};
    for (const k of KEEP_ON_ERROR) {
      const val = formData.get(k);
      if (typeof val === "string") values[k] = val.slice(0, 200);
    }
    return { fieldErrors: result.fieldErrors, values };
  }
  await createSession(result.userId, "CITIZEN");
  redirect("/citizen");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
