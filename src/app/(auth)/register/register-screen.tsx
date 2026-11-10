"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerAction, type FormState } from "@/app/actions/auth";
import { AuthFrame } from "@/components/auth-frame";
import { TextField } from "@/components/fields";
import { Icon } from "@/components/icons";

export function RegisterScreen() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(registerAction, undefined);
  const e = state?.fieldErrors ?? {};

  return (
    <AuthFrame>
      <div className="on-light mx-auto w-full max-w-md bg-white md:overflow-hidden md:rounded-[2rem] md:shadow-pop">
        <header className="surface-forest rounded-b-[2rem] px-6 pb-10 pt-[calc(1rem+env(safe-area-inset-top))] sm:px-8 md:pt-8">
          <Link href="/" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold hover:underline lg:hidden">
            <Icon name="arrow-left" className="h-5 w-5" />
            Home
          </Link>
          <h1 className="mt-4 text-4xl leading-tight tracking-tight">
            <span className="block font-light text-mint">Let’s</span>
            <span className="block font-extrabold">Create Your</span>
            <span className="block font-extrabold">Account</span>
          </h1>
        </header>

        <form action={formAction} noValidate className="space-y-4 px-6 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-8 text-slate-green sm:px-8 md:pb-10">
          <TextField label="Full name" name="name" autoComplete="name" required error={e.name} />
          <TextField
            label="Email or mobile number"
            name="identifier"
            autoComplete="username"
            inputMode="email"
            required
            error={e.identifier}
          />
          <TextField
            label="Household code"
            name="householdCode"
            autoComplete="off"
            autoCapitalize="characters"
            required
            hint="Printed on the sheet your barangay gave you, like K7QM-4XD9."
            error={e.householdCode}
          />
          <TextField
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            error={e.password}
          />
          <TextField
            label="Retype password"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            error={e.confirm}
          />

          <div>
            <div className="flex min-h-11 items-center gap-3 text-sm">
              <input id="terms" type="checkbox" name="terms" className="h-6 w-6 shrink-0 accent-forest" required />
              <label htmlFor="terms">
                I agree to the{" "}
                <Link href="/terms" target="_blank" className="font-bold underline underline-offset-4">
                  Terms
                </Link>{" "}
                and{" "}
                <Link href="/privacy" target="_blank" className="font-bold underline underline-offset-4">
                  Privacy notice
                </Link>
                <span className="sr-only"> (open in a new tab)</span>
              </label>
            </div>
            {e.terms && <p className="px-2 text-sm font-medium text-danger">{e.terms}</p>}
          </div>

          <button type="submit" disabled={pending} className="btn btn-primary w-full">
            {pending ? "Creating account…" : "Sign up"}
          </button>
          <p className="pt-2 text-center text-sm">
            Have an account?{" "}
            <Link href="/login" className="font-bold underline underline-offset-4">
              Log in
            </Link>
          </p>
        </form>
      </div>
    </AuthFrame>
  );
}
