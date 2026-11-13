"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { generateClaimCode, generateQrToken, formatClaimCode } from "@/lib/codes";
import { excludeCollection, replaceQrCode, setHouseholdStatus, updateHouseholdDetails } from "@/lib/admin-households";
import { failed, typedValues, type ActionState } from "@/lib/form-state";

export type CreateHouseholdState =
  | { error?: string; fieldErrors?: Record<string, string>; created?: { code: string; name: string; claimCode: string } }
  | undefined;

const schema = z.object({
  name: z.string().trim().min(2, "Enter the household name.").max(80),
  address: z.string().trim().min(3, "Enter the address.").max(160),
  purok: z.string().trim().min(1, "Enter the purok or sitio.").max(40),
});

export async function createHouseholdAction(
  _prev: CreateHouseholdState,
  formData: FormData,
): Promise<CreateHouseholdState> {
  const admin = await requirePermission("household:create");

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { fieldErrors };
  }

  // Sequential human-readable code (HH-00001). A unique-constraint clash from two
  // admins creating at once is retried with the next number.
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const claimCode = generateClaimCode();
      const h = await db.$transaction(async (tx) => {
        const last = await tx.household.findFirst({ orderBy: { code: "desc" }, select: { code: true } });
        const next = last ? parseInt(last.code.slice(3), 10) + 1 : 1;
        const code = `HH-${String(next).padStart(5, "0")}`;
        const household = await tx.household.create({
          data: { code, ...parsed.data, claimCode, qrCodes: { create: { token: generateQrToken() } } },
        });
        await tx.auditLog.create({
          data: { actorId: admin.id, action: "household.create", targetType: "Household", targetId: household.id, meta: { code } },
        });
        return household;
      });
      revalidatePath("/admin/households");
      revalidatePath("/admin");
      return { created: { code: h.code, name: h.name, claimCode: formatClaimCode(claimCode) } };
    } catch (e) {
      const clash = typeof e === "object" && e && "code" in e && e.code === "P2002";
      if (!clash || attempt === 3) {
        return { error: "Couldn't create the household. Try again." };
      }
    }
  }
  return { error: "Couldn't create the household. Try again." };
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
