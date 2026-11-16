import "server-only";
import { db } from "./db";
import { manilaDateString } from "./dates";
import {
  bucketFor,
  byCollector,
  byPurok,
  collectionsPerDay,
  daysEnding,
  pointsFlow,
  sortingQuality,
  summarize,
  type ClaimRow,
  type CollectionRow,
  type HouseholdRow,
} from "./analytics";

// Loads the rows for a range and hands them to the pure functions in analytics.ts. At pilot scale
// (about 50 households, at most 90 days) that's a few thousand small rows, so plain queries are enough.

export async function loadAnalytics(range: number, now = new Date()) {
  const days = daysEnding(manilaDateString(now), range);
  const first = new Date(`${days[0]}T00:00:00Z`);
  const bucket = bucketFor(range);

  const [collections, households, claims, collectors, outstanding] = await Promise.all([
    db.collection.findMany({
      where: { collectionDay: { gte: first } },
      select: { collectionDay: true, householdId: true, collectorId: true, score: true, status: true, household: { select: { purok: true } } },
    }),
    db.household.findMany({ select: { id: true, purok: true, status: true, claimedAt: true } }),
    // decidedAt is a timestamp; a day early is enough margin for the Manila offset, then filter by Manila day.
    db.redemption.findMany({
      where: { status: "CLAIMED", decidedAt: { gte: new Date(first.getTime() - 86_400_000) } },
      select: { decidedAt: true, pointsHeld: true },
    }),
    db.user.findMany({ where: { role: "COLLECTOR" }, select: { id: true, name: true, status: true } }),
    db.pointsLedger.aggregate({ _sum: { points: true } }),
  ]);

  const rows: CollectionRow[] = collections.map((c) => ({
    day: c.collectionDay.toISOString().slice(0, 10),
    householdId: c.householdId,
    collectorId: c.collectorId,
    purok: c.household.purok,
    score: c.score,
    status: c.status,
  }));
  const homes: HouseholdRow[] = households.map((h) => ({ id: h.id, purok: h.purok, status: h.status, signedUp: h.claimedAt !== null }));
  const claimRows: ClaimRow[] = claims.filter((c) => c.decidedAt).map((c) => ({ day: manilaDateString(c.decidedAt!), points: c.pointsHeld }));
  const nameOf = new Map(collectors.map((u) => [u.id, u.name]));

  return {
    range,
    bucket,
    days,
    summary: summarize(homes, rows, claimRows, days),
    perDay: collectionsPerDay(rows, days),
    quality: sortingQuality(rows, days, bucket),
    points: pointsFlow(rows, claimRows, days, bucket),
    puroks: byPurok(homes, rows),
    collectors: byCollector(rows).map((c) => ({ ...c, name: nameOf.get(c.collectorId) ?? "Former collector" })),
    /** All points currently in households' balances (earned minus spent and held). */
    outstanding: outstanding._sum.points ?? 0,
  };
}

export type AnalyticsData = Awaited<ReturnType<typeof loadAnalytics>>;

/** Collections per day for the overview's small chart. */
export async function recentCollections(days = 14, now = new Date()) {
  const list = daysEnding(manilaDateString(now), days);
  const rows = await db.collection.findMany({
    where: { collectionDay: { gte: new Date(`${list[0]}T00:00:00Z`) } },
    select: { collectionDay: true, status: true },
  });
  return collectionsPerDay(
    rows.map((r) => ({ day: r.collectionDay.toISOString().slice(0, 10), status: r.status, householdId: "", collectorId: "", purok: "", score: 0 })),
    list,
  );
}
