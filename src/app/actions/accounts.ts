"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser, requirePermission } from "@/lib/auth";
import { changeOwnPassword, createStaffAccount, resetPassword, setAccountStatus } from "@/lib/accounts";
import { createSession } from "@/lib/session";
import { homeFor } from "@/lib/rbac";
import { failed, typedValues, type ActionState } from "@/lib/form-state";

export async function createAccountAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requirePermission("user:manage");
  const r = await createStaffAccount(admin.id, { name: fd.get("name"), identifier: fd.get("identifier"), role: fd.get("role") });
  if (!r.ok) return failed(r, typedValues(fd, ["name", "identifier", "role"]));
  revalidatePath("/admin/accounts");
  return { done: `${r.name} can now log in with ${r.login} and this temporary password. They’ll choose their own after logging in.`, secret: r.tempPassword };
}

export async function resetPasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requirePermission("user:manage");
  const r = await resetPassword(admin.id, String(fd.get("userId") ?? ""));
  if (!r.ok) return { error: r.message };
  revalidatePath("/admin/accounts");
  return { done: "Their old password no longer works and they’ve been logged out everywhere. Give them this temporary password:", secret: r.tempPassword };
}

export async function setAccountStatusAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requirePermission("user:manage");
  const r = await setAccountStatus(admin.id, { userId: fd.get("userId"), status: fd.get("status"), reason: fd.get("reason") });
  if (!r.ok) return failed(r, typedValues(fd, ["reason"]));
  revalidatePath("/admin/accounts");
  return { done: fd.get("status") === "ACTIVE" ? "Account turned back on." : "Account turned off. It lost access right away." };
}

export async function changePasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const r = await changeOwnPassword(user.id, { current: fd.get("current"), password: fd.get("password"), confirm: fd.get("confirm") });
  if (!r.ok) return failed(r);
  await createSession(user.id, user.role); // other devices are signed out; this one stays in
  redirect(homeFor(user.role));
}

