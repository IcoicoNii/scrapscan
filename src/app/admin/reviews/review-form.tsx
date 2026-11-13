"use client";

import { useActionState, useId } from "react";
import { reviewCollectionAction, type ReviewState } from "@/app/actions/reviews";
import { Icon } from "@/components/icons";

export function ReviewForm({ collectionId, pointsHeld }: { collectionId: string; pointsHeld: number }) {
  const [state, formAction, pending] = useActionState<ReviewState, FormData>(reviewCollectionAction, undefined);
  const id = useId();
  const reasonError = state?.field === "reason" ? state.error : undefined;
  const otherError = state?.error && !reasonError ? state.error : undefined;

  return (
    <form action={formAction} noValidate className="space-y-3">
      <input type="hidden" name="collectionId" value={collectionId} />
      <div>
        <label htmlFor={`${id}-reason`} className="mb-1 block text-sm font-semibold">
          Reason for your decision
        </label>
        <textarea
          id={`${id}-reason`}
          name="reason"
          rows={2}
          maxLength={500}
          // React resets the form after the action; this puts the typed reason back when it came back with an error.
          defaultValue={state?.reason}
          placeholder="e.g. Talked to the collector: the phone sent it twice after a crash. First result is right."
          aria-invalid={reasonError ? true : undefined}
          aria-describedby={`${id}-hint${reasonError ? ` ${id}-err` : ""}`}
          className="field-box min-h-20 resize-y"
        />
        <p id={`${id}-hint`} className="mt-1.5 px-2 text-sm text-slate-green">
          Saved in the audit log with your name. Residents don’t see it.
        </p>
        {reasonError && (
          <p id={`${id}-err`} className="mt-1.5 px-2 text-sm font-medium text-danger">
            {reasonError}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="submit" name="decision" value="release" disabled={pending} className="btn btn-primary sm:flex-1">
          <Icon name="check" className="h-5 w-5" />
          {pointsHeld > 0 ? `Release ${pointsHeld} points` : "Mark as verified"}
        </button>
        <button type="submit" name="decision" value="reject" disabled={pending} className="btn btn-outline sm:flex-1">
          <Icon name="warn" className="h-5 w-5" />
          Don’t count it
        </button>
      </div>

      <div aria-live="polite">
        {pending && <p className="text-sm text-slate-green">Saving your decision…</p>}
        {otherError && (
          <p role="alert" className="text-sm font-semibold text-danger">
            {otherError}
          </p>
        )}
      </div>
    </form>
  );
}
