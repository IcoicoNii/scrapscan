"use client";

import { useActionState } from "react";
import { cancelRedemptionAction, requestRewardAction } from "@/app/actions/rewards";
import { FormMessages } from "@/components/form-bits";
import type { ActionState } from "@/lib/form-state";
import { format } from "@/lib/i18n/config";
import { useI18n } from "@/components/i18n";

export function RequestRewardButton({ rewardId, name, cost }: { rewardId: string; name: string; cost: number }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(requestRewardAction, undefined);
  const { t } = useI18n();
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(format(t.citizen.requestConfirm, { name, cost }))) e.preventDefault();
      }}
      className="space-y-2"
    >
      <input type="hidden" name="rewardId" value={rewardId} />
      <button type="submit" disabled={pending} className="btn btn-primary btn-sm w-full">
        {pending ? t.citizen.requesting : t.citizen.request}
      </button>
      <FormMessages state={state} />
    </form>
  );
}

export function CancelRequestButton({ redemptionId }: { redemptionId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(cancelRedemptionAction, undefined);
  const { t } = useI18n();
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="redemptionId" value={redemptionId} />
      <button type="submit" disabled={pending} className="btn btn-ghost btn-sm">
        {pending ? t.citizen.cancelling : t.citizen.cancel}
      </button>
      <FormMessages state={state} />
    </form>
  );
}
