"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { reviewFlaggedCollection } from "@/lib/reviews";

export type ReviewState = { error?: string; field?: "reason"; reason?: string } | undefined;

export async function reviewCollectionAction(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const admin = await requirePermission("collection:review");

  const result = await reviewFlaggedCollection(admin.id, {
    collectionId: formData.get("collectionId"),
    decision: formData.get("decision"),
    reason: formData.get("reason"),
  });

  if (!result.ok) {
    // Someone else decided it first: show the fresh list rather than an error on a card that's gone.
    if (result.error === "NOT_FLAGGED") revalidatePath("/admin/reviews");
    const reason = formData.get("reason");
    return {
      error: result.message,
      ...(result.field && { field: result.field }),
      ...(typeof reason === "string" && { reason: reason.slice(0, 500) }),
    };
  }

  revalidatePath("/admin/reviews");
  revalidatePath("/admin");
  // The page reads the decision back from the audit log, so the URL can't be used to fake a message.
  redirect(`/admin/reviews?reviewed=${encodeURIComponent(String(formData.get("collectionId")))}`);
}
