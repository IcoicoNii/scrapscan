"use client";

import { createContext, useContext } from "react";
import { DICTIONARIES } from "@/lib/i18n/dictionaries";
import { INTL_LOCALE, type Locale } from "@/lib/i18n/config";

const I18nContext = createContext<Locale>("en");

/** Sets the language for the client components below it. The admin area wraps itself in "en". */
export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <I18nContext.Provider value={locale}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const locale = useContext(I18nContext);
  return { locale, t: DICTIONARIES[locale], intl: INTL_LOCALE[locale] };
}
