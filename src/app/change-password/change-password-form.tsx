"use client";

import { useActionState } from "react";
import { changePasswordAction } from "@/app/actions/accounts";
import { TextField } from "@/components/fields";
import { FormMessages, fieldError } from "@/components/form-bits";
import type { ActionState } from "@/lib/form-state";
import { useI18n } from "@/components/i18n";
import { en } from "@/lib/i18n/en";

export function ChangePasswordForm({ currentLabel, english = false }: { currentLabel: string; english?: boolean }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(changePasswordAction, undefined);
  const { t: dict } = useI18n();
  const c = (english ? en : dict).changePassword;
  return (
    <form action={formAction} noValidate className="mt-6 space-y-4">
      <TextField label={currentLabel} name="current" type="password" autoComplete="current-password" required error={fieldError(state, "current")} />
      <TextField
        label={c.password}
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint={c.passwordHint}
        error={fieldError(state, "password")}
      />
      <TextField label={c.confirm} name="confirm" type="password" autoComplete="new-password" required error={fieldError(state, "confirm")} />
      <button type="submit" disabled={pending} className="btn btn-primary w-full">
        {pending ? c.submitting : c.submit}
      </button>
      <FormMessages state={state} />
    </form>
  );
}
