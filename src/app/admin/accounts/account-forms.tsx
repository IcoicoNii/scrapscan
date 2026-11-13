"use client";

import { useActionState } from "react";
import { createAccountAction, resetPasswordAction, setAccountStatusAction } from "@/app/actions/accounts";
import { TextField } from "@/components/fields";
import { FormMessages, TextAreaField, fieldError } from "@/components/form-bits";
import type { ActionState } from "@/lib/form-state";

export function NewAccountForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createAccountAction, undefined);
  const v = state?.values;
  return (
    <form action={action} noValidate className="space-y-4">
      <TextField label="Full name" name="name" defaultValue={v?.name} required error={fieldError(state, "name")} />
      <TextField
        label="Email or mobile number"
        name="identifier"
        defaultValue={v?.identifier}
        required
        hint="What they’ll log in with."
        error={fieldError(state, "identifier")}
      />
      <fieldset>
        <legend className="mb-1 text-sm font-semibold">Role</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            ["COLLECTOR", "Collector", "Scans households and records bins."],
            ["ADMIN", "Barangay admin", "Full access, including accounts and points."],
          ].map(([value, label, note]) => (
            <label key={value} className="flex min-h-12 cursor-pointer items-start gap-3 rounded-2xl border border-line p-3 has-checked:border-forest has-checked:bg-mint/50">
              <input type="radio" name="role" value={value} defaultChecked={(v?.role || "COLLECTOR") === value} className="mt-1 h-5 w-5 accent-forest" />
              <span>
                <span className="block font-semibold">{label}</span>
                <span className="block text-sm text-slate-green">{note}</span>
              </span>
            </label>
          ))}
        </div>
        {fieldError(state, "role") && <p className="mt-1.5 px-2 text-sm font-medium text-danger">{fieldError(state, "role")}</p>}
      </fieldset>
      <button type="submit" disabled={pending} className="btn btn-primary w-full sm:w-auto">
        Create account
      </button>
      <FormMessages state={state} pending={pending} />
    </form>
  );
}

export function ResetPasswordForm({ userId, name }: { userId: string; name: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(resetPasswordAction, undefined);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`Give ${name} a new temporary password? Their current password stops working and they’ll be logged out.`)) e.preventDefault();
      }}
      className="space-y-3"
    >
      <input type="hidden" name="userId" value={userId} />
      <p className="text-sm text-slate-green">
        For a forgotten password or a lost phone. You’ll get a one-time temporary password to give them; they choose a new one when they log in.
      </p>
      <button type="submit" disabled={pending} className="btn btn-outline btn-sm">
        Reset password
      </button>
      <FormMessages state={state} pending={pending} />
    </form>
  );
}

export function AccountStatusForm({ userId, active }: { userId: string; active: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(setAccountStatusAction, undefined);
  if (state?.done && !pending) return <FormMessages state={state} />;
  return (
    <form action={action} noValidate className="space-y-3">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="status" value={active ? "INACTIVE" : "ACTIVE"} />
      <p className="text-sm text-slate-green">
        {active
          ? "They lose access on their next tap, on every device. Their records stay. A collector’s unsent scans stay on their phone until someone logs in there again."
          : "They can log in again with their current password."}
      </p>
      <TextAreaField
        label="Reason"
        name="reason"
        defaultValue={state?.values?.reason}
        error={fieldError(state, "reason")}
        hint="Saved in the audit log with your name."
        placeholder={active ? "e.g. No longer a collector" : undefined}
      />
      <button type="submit" disabled={pending} className={`btn btn-sm ${active ? "btn-outline" : "btn-primary"}`}>
        {active ? "Turn off account" : "Turn on account"}
      </button>
      <FormMessages state={state} pending={pending} />
    </form>
  );
}
