"use client";

import { useActionState } from "react";
import { decideRedemptionAction, saveRewardAction } from "@/app/actions/rewards";
import { TextField } from "@/components/fields";
import { FormMessages, TextAreaField, fieldError } from "@/components/form-bits";
import type { ActionState } from "@/lib/form-state";
import { REWARD_IMAGES } from "@/lib/reward-images";

type RewardValues = { id: string; name: string; description: string | null; pointsCost: number; stock: number | null; imageUrl: string | null; active: boolean };

export function RewardForm({ reward }: { reward?: RewardValues }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveRewardAction, undefined);
  const v = state?.values;
  return (
    <form action={action} noValidate className="space-y-4">
      {reward && <input type="hidden" name="rewardId" value={reward.id} />}
      <TextField label="Reward name" name="name" defaultValue={v?.name ?? reward?.name} required error={fieldError(state, "name")} placeholder="e.g. 1 kg rice" />
      <TextField label="Description (optional)" name="description" defaultValue={v?.description ?? reward?.description ?? ""} error={fieldError(state, "description")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Points cost"
          name="pointsCost"
          inputMode="numeric"
          defaultValue={v?.pointsCost ?? reward?.pointsCost?.toString()}
          required
          error={fieldError(state, "pointsCost")}
        />
        <TextField
          label="Stock (optional)"
          name="stock"
          inputMode="numeric"
          defaultValue={v?.stock ?? reward?.stock?.toString() ?? ""}
          hint="Leave empty for no limit."
          error={fieldError(state, "stock")}
        />
      </div>
      <div>
        <label htmlFor={`${reward?.id ?? "new"}-image`} className="mb-1 block text-sm font-semibold">
          Thumbnail (optional)
        </label>
        <select
          id={`${reward?.id ?? "new"}-image`}
          name="imageUrl"
          defaultValue={v?.imageUrl ?? reward?.imageUrl ?? ""}
          className="field-box"
        >
          <option value="">No thumbnail</option>
          {REWARD_IMAGES.map((i) => (
            <option key={i.url} value={i.url}>
              {i.label}
            </option>
          ))}
        </select>
      </div>
      <label className="flex min-h-11 items-center gap-3 font-semibold">
        <input type="checkbox" name="active" defaultChecked={reward ? reward.active : true} className="h-5 w-5 accent-forest" />
        Residents can see and request it
      </label>
      <button type="submit" disabled={pending} className="btn btn-primary btn-sm">
        {reward ? "Save reward" : "Add reward"}
      </button>
      <FormMessages state={state} pending={pending} />
    </form>
  );
}

/** Buttons for the next step of a request. Rejecting needs a note the resident will see. */
export function RedemptionDecision({ redemptionId, status }: { redemptionId: string; status: "REQUESTED" | "APPROVED" }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(decideRedemptionAction, undefined);
  return (
    <form action={action} noValidate className="space-y-3">
      <input type="hidden" name="redemptionId" value={redemptionId} />
      <div className="flex flex-wrap gap-2">
        {status === "REQUESTED" ? (
          <button type="submit" name="decision" value="approve" disabled={pending} className="btn btn-primary btn-sm">
            Approve: item is ready
          </button>
        ) : (
          <button type="submit" name="decision" value="claim" disabled={pending} className="btn btn-primary btn-sm">
            Mark as picked up
          </button>
        )}
      </div>
      <details className="rounded-2xl border border-line">
        <summary className="flex min-h-11 cursor-pointer list-none items-center px-4 text-sm font-semibold text-forest [&::-webkit-details-marker]:hidden">
          Don’t approve…
        </summary>
        <div className="space-y-3 border-t border-line-soft p-4">
          <TextAreaField
            label="Note to the resident"
            name="note"
            defaultValue={state?.values?.note}
            error={fieldError(state, "note")}
            hint="They’ll see this. Their points are returned."
            placeholder="e.g. Out of rice this week. Please request again next week."
          />
          <button type="submit" name="decision" value="reject" disabled={pending} className="btn btn-outline btn-sm">
            Don’t approve and return the points
          </button>
        </div>
      </details>
      <FormMessages state={state} pending={pending} />
    </form>
  );
}
