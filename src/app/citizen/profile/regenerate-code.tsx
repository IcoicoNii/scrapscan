"use client";

import { useActionState } from "react";
import { regenerateOwnCodeAction } from "@/app/actions/households";
import { FormMessages } from "@/components/form-bits";
import type { ActionState } from "@/lib/form-state";

export function RegenerateOwnCode() {
  const [state, action, pending] = useActionState<ActionState, FormData>(regenerateOwnCodeAction, undefined);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm("Make a new sign-up code? The old code stops working. Family members already in keep their access.")) {
          e.preventDefault();
        }
      }}
      className="space-y-2"
    >
      <button type="submit" disabled={pending} className="btn btn-ghost btn-sm">
        Get a new code
      </button>
      <FormMessages state={state} pending={pending} />
    </form>
  );
}
