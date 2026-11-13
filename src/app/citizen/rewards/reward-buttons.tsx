"use client";

import { useActionState } from "react";
import { cancelRedemptionAction, requestRewardAction } from "@/app/actions/rewards";
import { FormMessages } from "@/components/form-bits";
import type { ActionState } from "@/lib/form-state";

export function RequestRewardButton({ rewardId, name, cost }: { rewardId: string; name: string; cost: number }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(requestRewardAction, undefined);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`Request ${name} for ${cost} points? The points are set aside until the barangay office decides.`)) e.preventDefault();
      }}
      className="space-y-2"
    >
      <input type="hidden" name="rewardId" value={rewardId} />
      <button type="submit" disabled={pending} className="btn btn-primary btn-sm w-full">
        {pending ? "Requesting…" : "Request this reward"}
      </button>
      <FormMessages state={state} />
    </form>
  );
}

export function CancelRequestButton({ redemptionId }: { redemptionId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(cancelRedemptionAction, undefined);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="redemptionId" value={redemptionId} />
      <button type="submit" disabled={pending} className="btn btn-ghost btn-sm">
        {pending ? "Cancelling…" : "Cancel request"}
      </button>
      <FormMessages state={state} />
    </form>
  );
}
