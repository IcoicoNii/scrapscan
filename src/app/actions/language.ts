"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { LANG_COOKIE, isLocale } from "@/lib/i18n/config";

/** Remembers the language on this device for a year, then re-renders the page in it. */
export async function setLanguageAction(formData: FormData) {
  const locale = formData.get("locale");
  if (!isLocale(locale)) return;
  (await cookies()).set(LANG_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: false });
  refresh();
}
