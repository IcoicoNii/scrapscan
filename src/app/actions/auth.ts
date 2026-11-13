"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession } from "@/lib/session";
import { homeFor } from "@/lib/rbac";
import { parseLoginId } from "@/lib/identifiers";
import { normalizeClaimCode } from "@/lib/codes";

export type FormState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

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

const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name.").max(80),
    identifier: z.string().trim().min(1, "Enter your email or mobile number."),
    householdCode: z.string().trim().min(1, "Enter the household code from your barangay."),
    password: z.string().min(8, "Use at least 8 characters."),
    confirm: z.string(),
    terms: z.literal("on", { error: "Agree to the Terms & Privacy to continue." }),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "Passwords don't match.",
  });

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { fieldErrors };
  }
  const { name, identifier, householdCode, password } = parsed.data;

  const id = parseLoginId(identifier);
  if (!id) {
    return { fieldErrors: { identifier: "Enter a valid email or a Philippine mobile number (09XX XXX XXXX)." } };
  }

  const claim = normalizeClaimCode(householdCode);
  const passwordHash = await bcrypt.hash(password, 12);

  let userId: string;
  try {
    userId = await db.$transaction(async (tx) => {
      const household = await tx.household.findUnique({ where: { claimCode: claim } });
      if (!household || household.status !== "ACTIVE") throw new Error("BAD_CODE");

      // Atomic claim: only one signup can flip claimedAt from null.
      const claimed = await tx.household.updateMany({
        where: { id: household.id, claimedAt: null },
        data: { claimedAt: new Date() },
      });
      if (claimed.count !== 1) throw new Error("BAD_CODE");

      const user = await tx.user.create({
        data: {
          name,
          role: "CITIZEN",
          passwordHash,
          householdId: household.id,
          ...(id.kind === "email" ? { email: id.value } : { phone: id.value }),
        },
      });
      return user.id;
    });
  } catch (e) {
    if (e instanceof Error && e.message === "BAD_CODE") {
      return {
        fieldErrors: {
          householdCode: "This code isn't valid or was already used. Check it with your barangay admin.",
        },
      };
    }
    if (typeof e === "object" && e && "code" in e && e.code === "P2002") {
      return { fieldErrors: { identifier: "An account with this email or number already exists." } };
    }
    throw e;
  }

  await createSession(userId, "CITIZEN");
  redirect("/citizen");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
