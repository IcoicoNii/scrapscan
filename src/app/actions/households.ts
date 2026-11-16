"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { formatClaimCode } from "@/lib/codes";
import { createHousehold, householdFieldsSchema, regenerateSignUpCode, withNumberRetry } from "@/lib/households";
import { decideRegistration, excludeCollection, replaceQrCode, setHouseholdStatus, updateHouseholdDetails } from "@/lib/admin-households";
import { failed, typedValues, type ActionState } from "@/lib/form-state";
import { getI18n } from "@/lib/i18n/server";

export type CreateHouseholdState =
  | { error?: string; fieldErrors?: Record<string, string>; created?: { code: string; name: string; claimCode: string } }
  | undefined;

export async function createHouseholdAction(
  _prev: CreateHouseholdState,
  formData: FormData,
): Promise<CreateHouseholdState> {
  const admin = await requirePermission("household:create");

  const parsed = householdFieldsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { fieldErrors };
  }

  try {
    // Admin-created households are active right away (the admin is the check).
    const h = await withNumberRetry(() =>
      db.$transaction(async (tx) => {
        const household = await createHousehold(tx, parsed.data, { status: "ACTIVE", selfRegistered: false });
        await tx.auditLog.create({
          data: { actorId: admin.id, action: "household.create", targetType: "Household", targetId: household.id, meta: { code: household.code } },
        });
        return household;
      }),
    );
    revalidatePath("/admin/households");
    revalidatePath("/admin");
    return { created: { code: h.code, name: h.name, claimCode: formatClaimCode(h.claimCode) } };
  } catch {
    return { error: "Couldn't create the household. Try again." };
  }
}

// ---------- Changes after creation (household detail page) ----------

const refreshHousehold = () => {
  revalidatePath("/admin/households", "layout");
  revalidatePath("/admin");
};

export async function updateHouseholdAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requirePermission("household:update");
  const r = await updateHouseholdDetails(admin.id, Object.fromEntries(fd));
  if (!r.ok) return failed(r, typedValues(fd, ["name", "address", "purok"]));
  refreshHousehold();
  return { done: "Household details saved." };
}

export async function setHouseholdStatusAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requirePermission("household:update");
  const r = await setHouseholdStatus(admin.id, Object.fromEntries(fd));
  if (!r.ok) return failed(r, typedValues(fd, ["reason"]));
  refreshHousehold();
  return { done: fd.get("status") === "ACTIVE" ? "Household turned back on. Collectors can record it again." : "Household turned off. Collectors can’t record it any more." };
}

export async function replaceQrAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requirePermission("qr:reissue");
  await requirePermission("qr:revoke");
  const r = await replaceQrCode(admin.id, Object.fromEntries(fd));
  if (!r.ok) return failed(r, typedValues(fd, ["reason"]));
  refreshHousehold();
  return { done: "New QR code issued. The old sticker no longer works. Print the new one and replace it." };
}

export async function excludeCollectionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requirePermission("points:reverse");
  const r = await excludeCollection(admin.id, Object.fromEntries(fd));
  if (!r.ok) return failed(r, typedValues(fd, ["reason"]));
  refreshHousehold();
  revalidatePath("/admin/collections");
  return { done: r.points ? `Collection no longer counts. ${r.points} points were taken back.` : "Collection no longer counts." };
}

export async function decideRegistrationAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requirePermission("household:update");
  const r = await decideRegistration(admin.id, {
    householdId: fd.get("householdId"), decision: fd.get("decision"), note: fd.get("note") ?? undefined,
  });
  refreshHousehold();
  if (!r.ok) return failed(r, typedValues(fd, ["note"]));
  return {
    done: fd.get("decision") === "approve"
      ? "Approved. Collectors can record this household from now on. Print its sticker if the resident needs one."
      : "Not approved. The resident sees your note.",
  };
}

/** Admin: a new sign-up code for any household (e.g. a code was shared with the wrong people). */
export async function regenerateCodeAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requirePermission("household:update");
  const r = await regenerateSignUpCode(admin.id, String(fd.get("householdId") ?? ""));
  if (!r.ok) return { error: r.message };
  refreshHousehold();
  return { done: "New sign-up code made. The old one no longer works." };
}

/** Resident: a new sign-up code for their own household. Scope comes from the account, never the form. */
export async function regenerateOwnCodeAction(): Promise<ActionState> {
  const user = await requirePermission("household:read:own");
  if (!user.householdId) return { error: "Your account isn’t linked to a household." };
  const r = await regenerateSignUpCode(user.id, user.householdId);
  if (!r.ok) return { error: r.message };
  revalidatePath("/citizen", "layout");
  return { done: (await getI18n()).t.citizen.newCodeDone };
}
