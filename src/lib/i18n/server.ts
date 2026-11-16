import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { DICTIONARIES } from "./dictionaries";
import { INTL_LOCALE, LANG_COOKIE, isLocale, localeFromAcceptLanguage, type Locale } from "./config";

/** The visitor's language: their saved choice, else what their browser prefers (Filipino or English). */
export const getLocale = cache(async (): Promise<Locale> => {
  const saved = (await cookies()).get(LANG_COOKIE)?.value;
  if (isLocale(saved)) return saved;
  return localeFromAcceptLanguage((await headers()).get("accept-language"));
});

/** For server components, actions and route handlers: `t` is the dictionary, `intl` the Intl locale tag. */
export async function getI18n() {
  const locale = await getLocale();
  return { locale, t: DICTIONARIES[locale], intl: INTL_LOCALE[locale] };
}
