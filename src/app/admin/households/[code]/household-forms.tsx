"use client";

import { useActionState } from "react";
import {
  excludeCollectionAction,
  replaceQrAction,
  setHouseholdStatusAction,
  updateHouseholdAction,
} from "@/app/actions/households";
import { TextField } from "@/components/fields";
import { FormMessages, TextAreaField, fieldError } from "@/components/form-bits";
import type { ActionState } from "@/lib/form-state";

export function EditDetailsForm({ householdId, name, address, purok }: { householdId: string; name: string; address: string; purok: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateHouseholdAction, undefined);
  const v = state?.values;
  return (
    <form action={action} noValidate className="space-y-4">
      <input type="hidden" name="householdId" value={householdId} />
      <TextField label="Household name" name="name" defaultValue={v?.name ?? name} required error={fieldError(state, "name")} />
      <TextField label="Address" name="address" defaultValue={v?.address ?? address} required error={fieldError(state, "address")} />
      <TextField label="Purok or sitio" name="purok" defaultValue={v?.purok ?? purok} required error={fieldError(state, "purok")} />
      <button type="submit" disabled={pending} className="btn btn-primary w-full sm:w-auto">
        Save details
      </button>
      <FormMessages state={state} pending={pending} />
    </form>
  );
}

/** A reason-required action behind a disclosure, so it can't be triggered by one stray tap. */
function ReasonAction({
  summary,
  intro,
  submit,
  hidden,
  action,
  tone = "outline",
  placeholder,
  reasonLabel,
  available = true,
}: {
  summary: string;
  intro: string;
  submit: string;
  hidden: Record<string, string>;
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  tone?: "outline" | "primary";
  placeholder?: string;
  /** Specific label, so several of these on one page are told apart. */
  reasonLabel: string;
  /** False once the thing is done (e.g. the collection no longer counts). Stays mounted so the confirmation stays visible. */
  available?: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, undefined);
  if (state?.done && !pending) return <FormMessages state={state} />;
  if (!available) return null;
  return (
    <details className="group rounded-2xl border border-line">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 font-semibold text-forest [&::-webkit-details-marker]:hidden">
        {summary}
        <span aria-hidden="true" className="transition-transform group-open:rotate-180">▾</span>
      </summary>
      <form action={formAction} noValidate className="space-y-3 border-t border-line-soft p-4">
        {Object.entries(hidden).map(([k, val]) => <input key={k} type="hidden" name={k} value={val} />)}
        <p className="text-sm text-slate-green">{intro}</p>
        <TextAreaField
          label={reasonLabel}
          name="reason"
          defaultValue={state?.values?.reason}
          error={fieldError(state, "reason")}
          hint="Saved in the audit log with your name."
          placeholder={placeholder}
        />
        <button type="submit" disabled={pending} className={`btn btn-sm ${tone === "primary" ? "btn-primary" : "btn-outline"}`}>
          {submit}
        </button>
        <FormMessages state={state} pending={pending} />
      </form>
    </details>
  );
}

export function StatusForm({ householdId, active }: { householdId: string; active: boolean }) {
  return active ? (
    <ReasonAction
      summary="Turn off this household"
      intro="Collectors won’t be able to record it, and its sign-up code stops working. Its points and history are kept. You can turn it back on."
      submit="Turn off household"
      reasonLabel="Why turn it off?"
      hidden={{ householdId, status: "INACTIVE" }}
      action={setHouseholdStatusAction}
      placeholder="e.g. Moved out of the barangay"
    />
  ) : (
    <ReasonAction
      summary="Turn this household back on"
      intro="Collectors can record it again."
      submit="Turn on household"
      reasonLabel="Why turn it back on?"
      tone="primary"
      hidden={{ householdId, status: "ACTIVE" }}
      action={setHouseholdStatusAction}
    />
  );
}

export function ReplaceQrForm({ householdId }: { householdId: string }) {
  return (
    <ReasonAction
      summary="Replace QR code"
      intro="For a lost, stolen or damaged sticker. The old sticker stops working right away; print the new one and swap it."
      submit="Replace QR code"
      reasonLabel="Why replace the QR code?"
      hidden={{ householdId }}
      action={replaceQrAction}
      placeholder="e.g. Sticker was torn off the bin"
    />
  );
}

export function ExcludeCollectionForm({ collectionId, score, counts }: { collectionId: string; score: number; counts: boolean }) {
  return (
    <ReasonAction
      available={counts}
      summary="Don’t count this"
      intro={`For a collection recorded wrongly (wrong household, wrong bins). ${score > 0 ? `Its ${score} points are taken back. ` : ""}The record stays, marked as not counted.`}
      submit="Don’t count this collection"
      reasonLabel="Why shouldn’t it count?"
      hidden={{ collectionId }}
      action={excludeCollectionAction}
      placeholder="e.g. Collector scanned the neighbour's sticker"
    />
  );
}
