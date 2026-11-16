// Pure i18n helpers shared by server and client code.

export const LOCALES = ["en", "fil"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LANG_COOKIE = "ss_lang";

export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v);

/** BCP 47 tags for Intl formatting and <html lang>. */
export const INTL_LOCALE: Record<Locale, string> = { en: "en-PH", fil: "fil-PH" };
export const HTML_LANG: Record<Locale, string> = { en: "en", fil: "fil" };

/** Fills {placeholders}: format("Hi {name}", { name: "Ana" }) → "Hi Ana". Unknown placeholders are left as is. */
export function format(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** Picks the "one" or "other" form: plural(n, t.x.one, t.x.other). Filipino doesn't inflect, but its strings can differ. */
export const plural = (n: number, one: string, other: string) => format(n === 1 ? one : other, { n });

/** Picks a locale from an Accept-Language header: Filipino/Tagalog first if the browser prefers it, else English. */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  const prefs = header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { tag: tag.toLowerCase(), q: q ? Number(q) : 1 };
    })
    .filter((p) => p.tag && !Number.isNaN(p.q))
    .sort((a, b) => b.q - a.q);
  for (const p of prefs) {
    if (p.tag.startsWith("fil") || p.tag.startsWith("tl")) return "fil";
    if (p.tag.startsWith("en")) return "en";
  }
  return DEFAULT_LOCALE;
}

/** The same shape as T, with every string widened to `string` (so a translation has to cover every key). */
export type Translation<T> = { [K in keyof T]: T[K] extends string ? string : Translation<T[K]> };
