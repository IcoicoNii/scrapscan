const TZ = "Asia/Manila";
export const formatDate = (d: Date) =>
  new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: TZ }).format(d);
export const formatDateTime = (d: Date) =>
  new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: TZ }).format(d);
export const formatPoints = (n: number) => new Intl.NumberFormat("en-PH").format(n);
/** Up to two initials for an avatar, e.g. "Juan dela Cruz" → "JD". */
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
