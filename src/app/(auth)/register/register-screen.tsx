"use client";

import Link from "next/link";
import { SignUp } from "@clerk/nextjs";
import { AuthFrame } from "@/components/auth-frame";
import { Icon } from "@/components/icons";
import { useI18n } from "@/components/i18n";

// Sign-up is Clerk's: email and mobile number, each confirmed with a code. The household step follows.
export function RegisterScreen() {
  const { t } = useI18n();
  const r = t.register;

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

        <div className="px-6 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-8 md:pb-10 sm:px-8">
          <SignUp routing="path" path="/register" signInUrl="/login" fallbackRedirectUrl="/after-sign-in" />
          <p className="pt-6 text-center text-sm text-slate-green">
            {r.haveAccount}{" "}
            <Link href="/login" className="font-bold underline underline-offset-4">
              {t.common.logIn}
            </Link>
          </p>
        </div>
      </div>
    </AuthFrame>
  );
}
