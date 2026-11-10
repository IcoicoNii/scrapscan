"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createHouseholdAction, type CreateHouseholdState } from "@/app/actions/households";
import { TextField } from "@/components/fields";

export function HouseholdForm() {
  const [state, formAction, pending] = useActionState<CreateHouseholdState, FormData>(createHouseholdAction, undefined);
  const e = state?.fieldErrors ?? {};

  return (
    <section aria-labelledby="add-h" className="card">
      <h2 id="add-h" className="text-lg font-bold">
        Household details
      </h2>
      <form action={formAction} noValidate className="mt-4 space-y-4">
        <TextField label="Household name" name="name" placeholder="Dela Cruz household" required error={e.name} />
        <TextField label="Address" name="address" placeholder="Street or block" required error={e.address} />
        <TextField label="Purok or sitio" name="purok" placeholder="Purok 1" required error={e.purok} />
        <button type="submit" disabled={pending} className="btn btn-primary w-full">
          {pending ? "Adding…" : "Add household"}
        </button>
        <div aria-live="polite">
          {state?.error && (
            <p role="alert" className="text-sm font-semibold text-danger">
              {state.error}
            </p>
          )}
          {state?.created && (
            <div role="status" className="rounded-2xl border border-forest/15 bg-mint/70 p-4">
              <p className="font-bold">
                {state.created.code} added: {state.created.name}
              </p>
              <p className="mt-1 text-sm">Give this household code to the resident so they can sign up:</p>
              <p className="mt-1 text-2xl font-extrabold tracking-widest text-forest">{state.created.claimCode}</p>
              <p className="mt-3 text-sm">The form is cleared, so you can add another household now.</p>
              <Link href="/admin/households" className="btn btn-outline btn-sm mt-3 w-full sm:w-auto">
                Back to households
              </Link>
            </div>
          )}
        </div>
      </form>
    </section>
  );
}
