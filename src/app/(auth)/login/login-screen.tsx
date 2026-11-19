"use client";

import Link from "next/link";
import { SignIn } from "@clerk/nextjs";
import { AuthFrame } from "@/components/auth-frame";
import { BrandMark, Wordmark } from "@/components/brand";
import { Icon } from "@/components/icons";
import { useI18n } from "@/components/i18n";

// Sign-in is Clerk's: email or mobile number plus the code Clerk sends. Clerk supplies the screens.
export function LoginScreen() {
  const { t } = useI18n();

  return (
    <AuthFrame>
      <div className="surface-forest mx-auto flex min-h-dvh w-full max-w-md flex-col md:min-h-0 md:rounded-[2rem] md:shadow-pop">
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

          <div className="my-8 flex w-full justify-center pb-6 md:pb-10">
            <SignIn routing="path" path="/login" signUpUrl="/register" fallbackRedirectUrl="/after-sign-in" />
          </div>
        </div>
      </div>
    </AuthFrame>
  );
}
