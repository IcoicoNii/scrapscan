"use client";

import { useActionState } from "react";
import { changePasswordAction } from "@/app/actions/accounts";
import { TextField } from "@/components/fields";
import { FormMessages, fieldError } from "@/components/form-bits";
import type { ActionState } from "@/lib/form-state";

export function ChangePasswordForm({ currentLabel }: { currentLabel: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(changePasswordAction, undefined);
  return (
    <form action={formAction} noValidate className="mt-6 space-y-4">
      <TextField label={currentLabel} name="current" type="password" autoComplete="current-password" required error={fieldError(state, "current")} />
      <TextField
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint="At least 8 characters."
        error={fieldError(state, "password")}
      />
      <TextField label="Type it again" name="confirm" type="password" autoComplete="new-password" required error={fieldError(state, "confirm")} />
      <button type="submit" disabled={pending} className="btn btn-primary w-full">
        {pending ? "Saving…" : "Save password"}
      </button>
      <FormMessages state={state} />
    </form>
  );
}
