"use client";

import Link from "next/link";
import { useActionState } from "react";
import { resetPasswordAction, type ResetState } from "@/app/actions/password-reset";
import { AuthFrame } from "@/components/auth-frame";
import { TextField } from "@/components/fields";
import { useI18n } from "@/components/i18n";

export function ResetScreen({ token, problem }: { token: string | null; problem: "invalid" | "expired" | null }) {
  const { t } = useI18n();
  const r = t.reset;
  const [state, action, pending] = useActionState<ResetState, FormData>(resetPasswordAction, undefined);
  // The link can also fail on submit (used in another tab, or it just expired).
  const failure = problem ?? state?.error ?? null;
  const fe = state?.fieldErrors;

  return (
    <AuthFrame>
      <div className="on-light mx-auto w-full max-w-md bg-white px-6 pb-14 pt-16 text-slate-green sm:px-8 md:rounded-4xl md:pt-10 md:shadow-pop">
        {failure || !token ? (
          <div className="space-y-4 text-center">
            <h1 className="text-3xl font-extrabold tracking-tight text-khaki">
              {failure === "expired" ? r.expiredTitle : r.invalidTitle}
            </h1>
            <p className="leading-relaxed">{failure === "expired" ? r.expired : r.invalid}</p>
            <Link href="/forgot-password" className="btn btn-primary w-full">
              {r.newLink}
            </Link>
            <Link href="/login" className="btn btn-ghost w-full">
              {t.forgot.backToLogin}
            </Link>
          </div>
        ) : (
          <form action={action} noValidate className="space-y-4">
            <h1 className="text-3xl font-extrabold tracking-tight text-khaki">{r.title}</h1>
            <p>{r.intro}</p>
            <input type="hidden" name="token" value={token} />
            <TextField
              label={r.password}
              name="password"
              type="password"
              autoComplete="new-password"
              required
              hint={r.passwordHint}
              error={fe?.password === "TOO_SHORT" ? r.tooShort : fe?.password === "TOO_LONG" ? r.tooLong : undefined}
            />
            <TextField
              label={r.confirm}
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              error={fe?.confirm === "MISMATCH" ? r.mismatch : undefined}
            />
            <button type="submit" disabled={pending} className="btn btn-primary w-full">
              {pending ? r.submitting : r.submit}
            </button>
          </form>
        )}
      </div>
    </AuthFrame>
  );
}
