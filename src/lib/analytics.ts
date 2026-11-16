// Pure aggregation for the admin analytics page. No database access here: analytics-data.ts loads
// rows and these functions turn them into chart series, so the numbers can be unit-tested.
//
// Days are Manila calendar dates as YYYY-MM-DD strings (see dates.ts). Weeks start on Monday.

export const RANGES = [7, 30, 90] as const;
export type RangeDays = (typeof RANGES)[number];
export const parseRange = (raw: string | undefined): RangeDays => (RANGES.find((r) => String(r) === raw) ?? 30);

/** Short ranges are shown per day; longer ones per week, so a bar chart never collapses to one or two bars. */
export type Bucket = "day" | "week";
export const bucketFor = (range: number): Bucket => (range <= 14 ? "day" : "week");

const DAY_MS = 86_400_000;
const toUtc = (day: string) => Date.parse(`${day}T00:00:00Z`);
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const addDays = (day: string, n: number) => fromUtc(toUtc(day) + n * DAY_MS);

/** The `n` days ending on `lastDay`, oldest first. */
export const daysEnding = (lastDay: string, n: number) => Array.from({ length: n }, (_, i) => addDays(lastDay, i - (n - 1)));

/** Monday of the week containing `day`. */
export const weekStart = (day: string) => {
  const dow = new Date(toUtc(day)).getUTCDay(); // 0 = Sunday
  return addDays(day, -((dow + 6) % 7));
};

/** The bucket keys covering `days` (each day, or each distinct week start), in order. */
export const bucketKeys = (days: string[], bucket: Bucket) =>
  bucket === "day" ? days : [...new Set(days.map(weekStart))];
const keyOf = (day: string, bucket: Bucket) => (bucket === "day" ? day : weekStart(day));

// ---------- Input rows (what analytics-data.ts loads) ----------

export type CollectionRow = {
  day: string;
  householdId: string;
  collectorId: string;
  purok: string;
  score: number;
  status: "VERIFIED" | "FLAGGED" | "REJECTED";
};
export type HouseholdRow = { id: string; purok: string; status: "PENDING" | "ACTIVE" | "INACTIVE"; signedUp: boolean };
export type ClaimRow = { day: string; points: number };

/** Collections that happened (rejected ones were recording mistakes, so they don't count as activity). */
const happened = (c: CollectionRow) => c.status !== "REJECTED";

// ---------- Series ----------

export type DayCount = { day: string; collected: number };

/** Households collected each day. */
export function collectionsPerDay(rows: CollectionRow[], days: string[]): DayCount[] {
  const counts = new Map(days.map((d) => [d, 0]));
  for (const r of rows) if (happened(r) && counts.has(r.day)) counts.set(r.day, counts.get(r.day)! + 1);
  return days.map((day) => ({ day, collected: counts.get(day)! }));
}

export type QualityBucket = { key: string; clean: number; partial: number; poor: number; total: number };

/** How well households sorted: verified collections scoring 10 (clean), 5 (one bin wrong) and 0. */
export function sortingQuality(rows: CollectionRow[], days: string[], bucket: Bucket): QualityBucket[] {
  const out = new Map(bucketKeys(days, bucket).map((k) => [k, { key: k, clean: 0, partial: 0, poor: 0, total: 0 }]));
  const inRange = new Set(days);
  for (const r of rows) {
    if (r.status !== "VERIFIED" || !inRange.has(r.day)) continue;
    const b = out.get(keyOf(r.day, bucket))!;
    if (r.score >= 10) b.clean++;
    else if (r.score > 0) b.partial++;
    else b.poor++;
    b.total++;
  }
  return [...out.values()];
}

export type PointsBucket = { key: string; earned: number; spent: number };

/** Points earned (verified collections, by collection day) vs spent (rewards picked up, by pickup day). */
export function pointsFlow(rows: CollectionRow[], claims: ClaimRow[], days: string[], bucket: Bucket): PointsBucket[] {
  const out = new Map(bucketKeys(days, bucket).map((k) => [k, { key: k, earned: 0, spent: 0 }]));
  const inRange = new Set(days);
  for (const r of rows) if (r.status === "VERIFIED" && inRange.has(r.day)) out.get(keyOf(r.day, bucket))!.earned += r.score;
  for (const c of claims) if (inRange.has(c.day)) out.get(keyOf(c.day, bucket))!.spent += c.points;
  return [...out.values()];
}

export type PurokRow = {
  purok: string;
  households: number;
  signedUp: number;
  /** Active households collected at least once in the range. */
  reached: number;
  verified: number;
  clean: number;
};

/** Per purok, active households only (pending and turned-off households aren't part of the program yet). */
export function byPurok(households: HouseholdRow[], rows: CollectionRow[]): PurokRow[] {
  const active = households.filter((h) => h.status === "ACTIVE");
  const purokOf = new Map(active.map((h) => [h.id, h.purok]));
  const out = new Map<string, PurokRow>();
  const row = (p: string) => {
    if (!out.has(p)) out.set(p, { purok: p, households: 0, signedUp: 0, reached: 0, verified: 0, clean: 0 });
    return out.get(p)!;
  };
  for (const h of active) {
    const r = row(h.purok);
    r.households++;
    if (h.signedUp) r.signedUp++;
  }
  const reached = new Set<string>();
  for (const c of rows) {
    const p = purokOf.get(c.householdId);
    if (!p || !happened(c)) continue;
    reached.add(c.householdId);
    if (c.status === "VERIFIED") {
      row(p).verified++;
      if (c.score >= 10) row(p).clean++;
    }
  }
  for (const id of reached) row(purokOf.get(id)!).reached++;
  return [...out.values()].sort((a, b) => a.purok.localeCompare(b.purok, "en", { numeric: true }));
}

export type CollectorRow = { collectorId: string; collections: number; days: number };

/** Collections per collector, most active first. */
export function byCollector(rows: CollectionRow[]): CollectorRow[] {
  const out = new Map<string, { collections: number; days: Set<string> }>();
  for (const r of rows) {
    if (!happened(r)) continue;
    const c = out.get(r.collectorId) ?? { collections: 0, days: new Set<string>() };
    c.collections++;
    c.days.add(r.day);
    out.set(r.collectorId, c);
  }
  return [...out.entries()]
    .map(([collectorId, c]) => ({ collectorId, collections: c.collections, days: c.days.size }))
    .sort((a, b) => b.collections - a.collections);
}

export type Summary = {
  activeHouseholds: number;
  /** Share of active households collected at least once in the range (0..1), null when there are none. */
  reachRate: number | null;
  /** Share of verified collections scoring 10 (0..1), null when there are none. */
  cleanRate: number | null;
  verified: number;
  earned: number;
  spent: number;
};

export function summarize(households: HouseholdRow[], rows: CollectionRow[], claims: ClaimRow[], days: string[]): Summary {
  const inRange = new Set(days);
  const ranged = rows.filter((r) => inRange.has(r.day));
  const purok = byPurok(households, ranged);
  const activeHouseholds = purok.reduce((s, p) => s + p.households, 0);
  const reached = purok.reduce((s, p) => s + p.reached, 0);
  const verified = ranged.filter((r) => r.status === "VERIFIED");
  const clean = verified.filter((r) => r.score >= 10).length;
  return {
    activeHouseholds,
    reachRate: activeHouseholds ? reached / activeHouseholds : null,
    cleanRate: verified.length ? clean / verified.length : null,
    verified: verified.length,
    earned: verified.reduce((s, r) => s + r.score, 0),
    spent: claims.filter((c) => inRange.has(c.day)).reduce((s, c) => s + c.points, 0),
  };
}

/** "Nov 10" / "Nov 10–16" style labels for bucket keys. */
export function bucketLabel(key: string, bucket: Bucket, locale = "en-PH") {
  const fmt = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" });
  const start = new Date(`${key}T00:00:00Z`);
  if (bucket === "day") return fmt.format(start);
  return `${fmt.format(start)}–${fmt.format(new Date(toUtc(key) + 6 * DAY_MS))}`;
}
