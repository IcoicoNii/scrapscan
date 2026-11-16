"use client";

import { useId, useState } from "react";
import type { ActionState } from "@/lib/form-state";
import { useI18n } from "./i18n";

/** Success, one-time secret and error messages for a form, announced to screen readers. */
export function FormMessages({ state, pending, pendingText }: { state: ActionState; pending?: boolean; pendingText?: string }) {
  const { t } = useI18n();
  return (
    <div aria-live="polite" className="empty:hidden">
      {pending && <p className="text-sm text-slate-green">{pendingText ?? t.common.saving}</p>}
      {!pending && state?.done && (
        <div role="status" className="rounded-2xl border border-forest/15 bg-mint/70 p-3.5 text-sm">
          <p className="font-semibold">{state.done}</p>
          {state.secret && <Secret value={state.secret} />}
        </div>
      )}
      {!pending && state?.error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {state.error}
        </p>
      )}
    </div>
  );
}

function Secret({ value }: { value: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-2 space-y-2">
      <p className="rounded-xl bg-white px-3 py-2 font-mono text-2xl font-bold tracking-widest text-forest ring-1 ring-line select-all">{value}</p>
      <p className="text-slate-green">{t.common.secretOnce}</p>
      <button
        type="button"
        className="btn btn-outline btn-sm"
        onClick={() => navigator.clipboard?.writeText(value).then(() => setCopied(true), () => {})}
      >
        {copied ? t.common.copied : t.common.copy}
      </button>
    </div>
  );
}

/** Multi-line text with the same label/hint/error wiring as TextField. */
export function TextAreaField({
  label,
  name,
  error,
  hint,
  defaultValue,
  placeholder,
  rows = 2,
  maxLength = 300,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  defaultValue?: string;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
}) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold">
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="field-box min-h-16 resize-y"
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 px-2 text-sm text-slate-green">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} className="mt-1.5 px-2 text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** Field error for a name, falling back to the form error when it's the reason the form failed. */
export const fieldError = (state: ActionState, name: string) => state?.fieldErrors?.[name];
