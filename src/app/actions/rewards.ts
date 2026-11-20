"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { cancelRedemption, decideRedemption, requestReward, saveReward } from "@/lib/redemptions";
import { failed, typedValues, type ActionState } from "@/lib/form-state";

const refresh = () => {
  revalidatePath("/admin/rewards");
  revalidatePath("/citizen", "layout");
};

export async function saveRewardAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requirePermission("reward:manage");
  const id = fd.get("rewardId");
  const r = await saveReward(admin.id, typeof id === "string" && id ? id : null, {
    name: fd.get("name"), description: fd.get("description") ?? "", pointsCost: fd.get("pointsCost"), stock: fd.get("stock") ?? "",
    imageUrl: fd.get("imageUrl"),
    active: fd.get("active") ?? "off",
  });
  if (!r.ok) return failed(r, typedValues(fd, ["name", "description", "pointsCost", "stock", "imageUrl"]));
  refresh();
  return { done: id ? "Reward saved." : "Reward added." };
}

export async function decideRedemptionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requirePermission("redemption:approve");
  const r = await decideRedemption(admin.id, { redemptionId: fd.get("redemptionId"), decision: fd.get("decision"), note: fd.get("note") ?? undefined });
  if (!r.ok) {
    refresh();
    return failed(r, typedValues(fd, ["note"]));
  }
  refresh();
  return { done: "Updated." };
}

export async function requestRewardAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("redemption:create:own");
  const { t } = await getI18n();
  const r = await requestReward(user, fd.get("rewardId"), t.errors.rewards);
  if (!r.ok) return { error: r.message };
  refresh();
  return { done: t.citizen.requested_done };
}

export async function cancelRedemptionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePermission("redemption:create:own");
  const { t } = await getI18n();
  const r = await cancelRedemption(user, fd.get("redemptionId"), t.errors.rewards);
  if (!r.ok) return { error: r.message };
  refresh();
  return { done: t.citizen.cancelled_done };
}
