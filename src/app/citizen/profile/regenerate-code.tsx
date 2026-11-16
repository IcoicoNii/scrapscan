"use client";

import { useActionState } from "react";
import { regenerateOwnCodeAction } from "@/app/actions/households";
import { FormMessages } from "@/components/form-bits";
import type { ActionState } from "@/lib/form-state";
import { useI18n } from "@/components/i18n";

export function RegenerateOwnCode() {
  const [state, action, pending] = useActionState<ActionState, FormData>(regenerateOwnCodeAction, undefined);
  const { t } = useI18n();
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(t.citizen.newCodeConfirm)) {
          e.preventDefault();
        }
      }}
      className="space-y-2"
    >
      <button type="submit" disabled={pending} className="btn btn-ghost btn-sm">
        {t.citizen.newCode}
      </button>
      <FormMessages state={state} pending={pending} />
    </form>
  );
}
