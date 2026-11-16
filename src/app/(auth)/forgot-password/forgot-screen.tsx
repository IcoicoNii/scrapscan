"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestResetAction, type ForgotState } from "@/app/actions/password-reset";
import { AuthFrame } from "@/components/auth-frame";
import { TextField } from "@/components/fields";
import { useI18n } from "@/components/i18n";

function LockIcon() {
  return (
    <span className="icon-tile mx-auto h-20 w-20 rounded-[1.5rem]">
      <svg viewBox="0 0 24 24" className="h-10 w-10" aria-hidden="true" fill="currentColor">
        <path d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5Zm-3 8V6a3 3 0 1 1 6 0v3H9Zm3 4a1.6 1.6 0 0 1 .8 3v2.2h-1.6V16a1.6 1.6 0 0 1 .8-3Z" />
      </svg>
    </span>
  );
}

export function ForgotScreen({ enabled }: { enabled: boolean }) {
  const { t } = useI18n();
  const f = t.forgot;
  const [state, action, pending] = useActionState<ForgotState, FormData>(requestResetAction, undefined);

  return (
    <AuthFrame>
      <div className="on-light mx-auto w-full max-w-md bg-white px-6 pb-14 pt-16 text-center text-slate-green sm:px-8 md:rounded-4xl md:pt-14 md:shadow-pop">
        <LockIcon />
        <h1 className="mt-6 text-3xl tracking-tight text-khaki">
          <span className="block font-extrabold">{f.title1}</span>
          <span className="block font-light">{f.title2}</span>
        </h1>

        {!enabled ? (
          <p className="mx-auto mt-6 max-w-xs text-base leading-relaxed">{f.unavailable}</p>
        ) : state?.sent ? (
          <div role="status" className="mt-6 space-y-2">
            <p className="text-lg font-bold text-khaki">{f.sentTitle}</p>
            <p className="leading-relaxed">{f.sent}</p>
          </div>
        ) : (
          <form action={action} noValidate className="mt-6 space-y-4 text-left">
            <p className="text-center leading-relaxed">{f.intro}</p>
            <TextField
              label={f.email}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              defaultValue={state?.email}
              error={state?.error === "INVALID_EMAIL" ? f.invalidEmail : state?.error === "PHONE" ? f.phone : undefined}
            />
            <button type="submit" disabled={pending} className="btn btn-primary w-full">
              {pending ? f.submitting : f.submit}
            </button>
            <p className="text-center text-sm">{f.noEmail}</p>
          </form>
        )}

        <Link href="/login" className={`btn mt-8 w-full ${enabled && !state?.sent ? "btn-ghost" : "btn-primary"}`}>
          {f.backToLogin}
        </Link>
      </div>
    </AuthFrame>
  );
}
