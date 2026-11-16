"use client";

import Link from "next/link";
import { BrandMark, Wordmark } from "./brand";
import { Icon } from "./icons";
import { useI18n } from "./i18n";
import { LanguageSwitch } from "./language-switch";

// Phones: the screen itself is full-bleed. Tablets: a centered card. Desktop: brand panel + card.
// The language switch sits in the top corner on every sign-in screen.
export function AuthFrame({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const points = [t.authFrame.point1, t.authFrame.point2, t.authFrame.point3];
  return (
    <main id="main" className="relative min-h-dvh bg-white md:bg-transparent lg:grid lg:grid-cols-2">
      <aside className="surface-forest sticky top-0 hidden h-dvh flex-col justify-between p-12 lg:flex">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold hover:underline">
          <Icon name="arrow-left" className="h-5 w-5" />
          {t.common.backToHome}
        </Link>
        <div>
          <span className="grid h-24 w-24 place-items-center rounded-[1.75rem] bg-white/10 ring-1 ring-inset ring-white/15 shadow-lift">
            <BrandMark className="h-14 w-14 text-lawn" />
          </span>
          <p className="mt-6">
            <Wordmark className="text-5xl" />
          </p>
          <p className="mt-4 max-w-md text-lg text-white/90">{t.authFrame.tagline}</p>
          <ul className="mt-10 max-w-md space-y-3">
            {points.map((p) => (
              <li key={p} className="flex items-center gap-3 rounded-2xl bg-white/[0.07] px-4 py-3 ring-1 ring-inset ring-white/10">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-lawn text-khaki">
                  <Icon name="check" className="h-5 w-5" />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-mint">{t.common.pilot}</p>
      </aside>
      <div className="md:grid md:min-h-dvh md:place-items-center md:p-6 lg:p-10">
        <LanguageSwitch className="absolute right-3 top-[calc(0.75rem+env(safe-area-inset-top))] z-10 md:right-6 md:top-6" />
        {children}
      </div>
    </main>
  );
}
