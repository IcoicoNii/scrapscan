"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { registerAction, type FormState } from "@/app/actions/auth";
import { AuthFrame } from "@/components/auth-frame";
import { TextField } from "@/components/fields";
import { Icon } from "@/components/icons";
import { useI18n } from "@/components/i18n";

type Mode = "new" | "join";

export function RegisterScreen({ puroks }: { puroks: string[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(registerAction, undefined);
  // Controlled, so the choice survives React resetting the form after an error.
  const [mode, setMode] = useState<Mode>("new");
  const { t } = useI18n();
  const r = t.register;
  const e = state?.fieldErrors ?? {};
  const v = state?.values ?? {};

  return (
    <AuthFrame>
      <div className="on-light mx-auto w-full max-w-md bg-white md:overflow-hidden md:rounded-4xl md:shadow-pop">
        <header className="surface-forest rounded-b-4xl px-6 pb-10 pt-[calc(1rem+env(safe-area-inset-top))] sm:px-8 md:pt-8">
          <Link href="/" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold hover:underline lg:hidden">
            <Icon name="arrow-left" className="h-5 w-5" />
            {t.common.home}
          </Link>
          <h1 className="mt-4 text-4xl leading-tight tracking-tight">
            <span className="block font-light text-mint">{r.title1}</span>
            <span className="block font-extrabold">{r.title2}</span>
            <span className="block font-extrabold">{r.title3}</span>
          </h1>
        </header>

        <form action={formAction} noValidate className="space-y-4 px-6 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-8 text-slate-green sm:px-8 md:pb-10">
          <TextField label={r.fullName} name="name" autoComplete="name" required defaultValue={v.name} error={e.name} />
          <TextField
            label={r.identifier}
            name="identifier"
            autoComplete="username"
            inputMode="email"
            required
            defaultValue={v.identifier}
            error={e.identifier}
          />

          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-semibold text-khaki">{r.household}</legend>
            {(
              [
                ["new", r.newLabel, r.newNote],
                ["join", r.joinLabel, r.joinNote],
              ] as const
            ).map(([value, label, note]) => (
              <label
                key={value}
                className="flex min-h-12 cursor-pointer items-start gap-3 rounded-2xl border border-line p-3 has-checked:border-forest has-checked:bg-mint/50"
              >
                <input
                  type="radio"
                  name="mode"
                  value={value}
                  checked={mode === value}
                  onChange={() => setMode(value)}
                  className="mt-1 h-5 w-5 shrink-0 accent-forest"
                />
                <span>
                  <span className="block font-semibold text-khaki">{label}</span>
                  <span className="block text-sm">{note}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {mode === "new" ? (
            <>
              <TextField
                label={r.householdName}
                name="householdName"
                placeholder={r.householdNamePlaceholder}
                required
                defaultValue={v.householdName}
                error={e.householdName}
              />
              <TextField
                label={r.address}
                name="address"
                placeholder={r.addressPlaceholder}
                autoComplete="street-address"
                required
                defaultValue={v.address}
                error={e.address}
              />
              <TextField
                label={r.purok}
                name="purok"
                list="puroks"
                placeholder="Purok 1"
                required
                defaultValue={v.purok}
                error={e.purok}
              />
              <datalist id="puroks">
                {puroks.map((p) => <option key={p} value={p} />)}
              </datalist>
              <p className="rounded-2xl bg-cream/70 px-4 py-3 text-sm text-khaki">
                {r.approvalNote}
              </p>
            </>
          ) : (
            <TextField
              label={r.code}
              name="householdCode"
              autoComplete="off"
              autoCapitalize="characters"
              required
              hint={r.codeHint}
              defaultValue={v.householdCode}
              error={e.householdCode}
            />
          )}

          <TextField label={r.password} name="password" type="password" autoComplete="new-password" required hint={r.passwordHint} error={e.password} />
          <TextField label={r.confirm} name="confirm" type="password" autoComplete="new-password" required error={e.confirm} />

          <div>
            <div className="flex min-h-11 items-center gap-3 text-sm">
              <input id="terms" type="checkbox" name="terms" className="h-6 w-6 shrink-0 accent-forest" required />
              <label htmlFor="terms">
                {r.agree}{" "}
                <Link href="/terms" target="_blank" className="font-bold underline underline-offset-4">
                  {t.common.terms}
                </Link>{" "}
                {r.and}{" "}
                <Link href="/privacy" target="_blank" className="font-bold underline underline-offset-4">
                  {r.privacyNotice}
                </Link>
                <span className="sr-only"> {r.newTab}</span>
              </label>
            </div>
            {e.terms && <p className="px-2 text-sm font-medium text-danger">{e.terms}</p>}
          </div>

          {Object.keys(e).length > 0 && (
            <p role="alert" className="text-sm font-semibold text-danger">
              {r.checkFields}
            </p>
          )}
          <button type="submit" disabled={pending} className="btn btn-primary w-full">
            {pending ? r.submitting : r.submit}
          </button>
          <p className="pt-2 text-center text-sm">
            {r.haveAccount}{" "}
            <Link href="/login" className="font-bold underline underline-offset-4">
              {t.common.logIn}
            </Link>
          </p>
        </form>
      </div>
    </AuthFrame>
  );
}
