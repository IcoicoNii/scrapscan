"use client";

import Link from "next/link";
import { BrandMark, Wordmark } from "./brand";
import { useI18n } from "./i18n";
import { LanguageSwitch } from "./language-switch";

// Header and footer for pages anyone can open (landing, terms, privacy).
export function PublicShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="glass-forest sticky top-0 z-20 pt-[env(safe-area-inset-top)] text-white shadow-[0_8px_24px_-16px_rgb(27_67_0/0.8)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <Link href="/" className="flex min-h-11 items-center gap-2">
            <BrandMark className="h-8 w-8 text-lawn" />
            <Wordmark className="hidden text-lg min-[400px]:inline sm:text-xl" />
          </Link>
          <nav aria-label="Account" className="flex items-center gap-1.5 sm:gap-2">
            <LanguageSwitch tone="dark" />
            <Link href="/login" className="btn btn-sm px-3 text-white shadow-none hover:bg-white/10 sm:px-4">
              {t.common.logIn}
            </Link>
            <Link href="/register" className="btn btn-lawn btn-sm px-3 sm:px-4">
              {t.common.signUp}
            </Link>
          </nav>
        </div>
      </header>

      <main id="main" className="on-light flex-1">
        {children}
      </main>

      <footer className="on-light border-t border-line bg-white/70 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-slate-green sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="flex items-center gap-2">
            <BrandMark className="h-5 w-5 text-forest" />
            ScrapScan · {t.common.pilot}
          </p>
          <ul className="flex gap-1">
            <li>
              <Link href="/terms" className="inline-flex min-h-11 items-center px-2 underline underline-offset-4">
                {t.common.terms}
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="inline-flex min-h-11 items-center px-2 underline underline-offset-4">
                {t.common.privacy}
              </Link>
            </li>
          </ul>
        </div>
      </footer>
    </div>
  );
}

/** Narrow reading layout for policy-style pages. */
export function ProsePage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 md:py-14">
      <h1 className="text-3xl font-extrabold tracking-tight md:text-5xl">{title}</h1>
      <p className="mt-2 text-sm text-slate-green">{updated}</p>
      <div className="card mt-8 space-y-6 leading-relaxed sm:p-8 lg:p-10 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:tracking-tight [&_li]:mt-1 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6">
        {children}
      </div>
    </article>
  );
}
