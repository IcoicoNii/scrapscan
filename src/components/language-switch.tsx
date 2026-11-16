"use client";

import { setLanguageAction } from "@/app/actions/language";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import { useI18n } from "./i18n";

const LABEL: Record<Locale, { short: string; full: string }> = {
  en: { short: "EN", full: "English" },
  fil: { short: "FIL", full: "Filipino" },
};

/** EN | FIL. Works without JavaScript (plain form post); the choice is saved on this device. */
export function LanguageSwitch({ tone = "light", className = "" }: { tone?: "light" | "dark"; className?: string }) {
  const { locale, t } = useI18n();
  const dark = tone === "dark";
  return (
    <form action={setLanguageAction} className={className}>
      <fieldset className={`inline-flex rounded-full p-0.5 ring-1 ring-inset ${dark ? "ring-white/30" : "ring-line bg-white"}`}>
        <legend className="sr-only">{t.common.language}</legend>
        {LOCALES.map((l) => {
          const on = l === locale;
          return (
            <button
              key={l}
              type="submit"
              name="locale"
              value={l}
              aria-pressed={on}
              lang={l === "fil" ? "fil" : "en"}
              title={LABEL[l].full}
              className={`min-h-9 min-w-11 rounded-full px-3 text-xs font-bold transition-colors ${
                on ? (dark ? "bg-white text-forest" : "bg-forest text-white") : dark ? "text-white hover:bg-white/10" : "text-forest hover:bg-mint"
              }`}
            >
              <span aria-hidden="true">{LABEL[l].short}</span>
              <span className="sr-only">{LABEL[l].full}</span>
            </button>
          );
        })}
      </fieldset>
    </form>
  );
}
