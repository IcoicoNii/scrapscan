const TZ = "Asia/Manila";
// `intl` is an Intl locale tag ("en-PH" / "fil-PH"); screens pass the reader's language.
export const formatDate = (d: Date, intl = "en-PH") =>
  new Intl.DateTimeFormat(intl, { dateStyle: "medium", timeZone: TZ }).format(d);
export const formatDateTime = (d: Date, intl = "en-PH") =>
  new Intl.DateTimeFormat(intl, { dateStyle: "medium", timeStyle: "short", timeZone: TZ }).format(d);
export const formatPoints = (n: number, intl = "en-PH") => new Intl.NumberFormat(intl).format(n);
/** Up to two initials for an avatar, e.g. "Juan dela Cruz" → "JD". */
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
