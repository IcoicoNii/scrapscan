"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, type FormState } from "@/app/actions/auth";
import { AuthFrame } from "@/components/auth-frame";
import { BrandMark, Wordmark } from "@/components/brand";
import { TextField } from "@/components/fields";
import { Icon } from "@/components/icons";
import { useI18n } from "@/components/i18n";

export function LoginScreen({ passwordReset = false }: { passwordReset?: boolean }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(loginAction, undefined);
  const { t } = useI18n();

  return (
    <AuthFrame>
      <form
        action={formAction}
        noValidate
        className="surface-forest mx-auto flex min-h-dvh w-full max-w-md flex-col md:min-h-0 md:rounded-[2rem] md:shadow-pop"
      >
        <div className="flex flex-1 flex-col items-center px-6 pt-[calc(1rem+env(safe-area-inset-top))] sm:px-8">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold hover:underline lg:hidden"
          >
            <Icon name="arrow-left" className="h-5 w-5" />
            {t.common.home}
          </Link>
          <div className="mt-4 grid h-32 w-32 place-items-center rounded-[2rem] bg-white/10 text-white ring-1 ring-inset ring-white/20 sm:h-36 sm:w-36 lg:h-24 lg:w-24 lg:rounded-[1.5rem]">
            <BrandMark className="h-20 w-20 sm:h-24 sm:w-24 lg:h-16 lg:w-16" />
          </div>
          <h1 className="mt-6">
            <Wordmark />
            <span className="sr-only"> {t.login.srTitle}</span>
          </h1>
          <p className="mt-3 max-w-xs text-center text-base leading-snug lg:hidden">{t.authFrame.tagline}</p>
          <p className="mt-3 hidden text-center text-base lg:block">{t.login.welcome}</p>
          {passwordReset && (
            <p role="status" className="mt-5 w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-forest shadow-card">
              {t.login.resetDone}
            </p>
          )}

          <div className="mt-8 w-full space-y-4">
            <TextField
              variant="pill"
              labelHidden
              label={t.login.identifier}
              name="identifier"
              placeholder={t.login.identifier}
              autoComplete="username"
              inputMode="email"
              required
            />
            <TextField
              variant="pill"
              labelHidden
              label={t.login.password}
              name="password"
              type="password"
              placeholder={t.login.password}
              autoComplete="current-password"
              required
            />
            <div aria-live="polite">
              {state?.error && (
                <p role="alert" className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-danger shadow-card">
                  {state.error}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="on-light mt-6 rounded-t-[2rem] bg-white px-6 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-6 text-slate-green sm:px-8 md:rounded-b-[2rem] md:pb-10">
          <p className="text-center text-sm">
            <Link href="/forgot-password" className="inline-flex min-h-11 items-center underline underline-offset-4">
              {t.login.forgot}
            </Link>
          </p>
          <button type="submit" disabled={pending} className="btn btn-primary mt-2 w-full">
            {pending ? t.login.submitting : t.login.submit}
          </button>
          <p className="my-3 text-center text-sm">{t.login.or}</p>
          <Link href="/register" className="btn btn-secondary w-full">
            {t.login.create}
          </Link>
        </div>
      </form>
    </AuthFrame>
  );
}
