import { describe, expect, it } from "vitest";
import {
  addDays,
  bucketFor,
  bucketKeys,
  bucketLabel,
  byCollector,
  byPurok,
  collectionsPerDay,
  daysEnding,
  parseRange,
  pointsFlow,
  sortingQuality,
  summarize,
  weekStart,
  type CollectionRow,
  type HouseholdRow,
} from "../analytics";

const c = (day: string, householdId: string, score: number, status: CollectionRow["status"] = "VERIFIED", extra: Partial<CollectionRow> = {}): CollectionRow => ({
  day, householdId, score, status, collectorId: "col-1", purok: "Purok 1", ...extra,
});

const households: HouseholdRow[] = [
  { id: "h1", purok: "Purok 1", status: "ACTIVE", signedUp: true },
  { id: "h2", purok: "Purok 1", status: "ACTIVE", signedUp: false },
  { id: "h3", purok: "Purok 2", status: "ACTIVE", signedUp: true },
  { id: "h4", purok: "Purok 2", status: "PENDING", signedUp: true }, // not in the program yet
  { id: "h5", purok: "Purok 10", status: "INACTIVE", signedUp: false },
];

describe("days and weeks", () => {
  it("lists the days of a range, oldest first, across month ends", () => {
    expect(daysEnding("2026-11-02", 4)).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("weeks start on Monday", () => {
    expect(weekStart("2026-11-16")).toBe("2026-11-16"); // Monday
    expect(weekStart("2026-11-22")).toBe("2026-11-16"); // Sunday
    expect(weekStart("2026-11-01")).toBe("2026-10-26"); // Sunday, previous month
  });
  it("short ranges are per day, longer ones per week", () => {
    expect([7, 30, 90].map(bucketFor)).toEqual(["day", "week", "week"]);
    expect(bucketKeys(daysEnding("2026-11-16", 9), "week")).toEqual(["2026-11-02", "2026-11-09", "2026-11-16"]);
    expect(parseRange("90")).toBe(90);
    expect(parseRange("999")).toBe(30);
    expect(parseRange(undefined)).toBe(30);
  });
  it("labels buckets", () => {
    expect(bucketLabel("2026-11-16", "day")).toBe("Nov 16");
    expect(bucketLabel("2026-10-26", "week")).toBe("Oct 26–Nov 1");
  });
});

describe("series", () => {
  const days = daysEnding("2026-11-16", 3); // Nov 14, 15, 16
  const rows = [
    c("2026-11-14", "h1", 10),
    c("2026-11-14", "h2", 5),
    c("2026-11-16", "h1", 0),
    c("2026-11-16", "h3", 10, "FLAGGED"),
    c("2026-11-16", "h2", 10, "REJECTED"), // a recording mistake: not activity, not points
    c("2026-11-10", "h3", 10), // outside the range
  ];

  it("counts households collected per day, including empty days, excluding rejected ones", () => {
    expect(collectionsPerDay(rows, days)).toEqual([
      { day: "2026-11-14", collected: 2 },
      { day: "2026-11-15", collected: 0 },
      { day: "2026-11-16", collected: 2 },
    ]);
  });

  it("splits verified collections by score", () => {
    expect(sortingQuality(rows, days, "day")).toEqual([
      { key: "2026-11-14", clean: 1, partial: 1, poor: 0, total: 2 },
      { key: "2026-11-15", clean: 0, partial: 0, poor: 0, total: 0 },
      { key: "2026-11-16", clean: 0, partial: 0, poor: 1, total: 1 },
    ]);
  });

  it("points earned come from verified collections; spent from rewards picked up", () => {
    const claims = [{ day: "2026-11-15", points: 50 }, { day: "2026-11-01", points: 80 }];
    expect(pointsFlow(rows, claims, days, "week")).toEqual([
      { key: "2026-11-09", earned: 15, spent: 50 },
      { key: "2026-11-16", earned: 0, spent: 0 },
    ]);
  });

  it("compares puroks using active households only", () => {
    const ranged = rows.filter((r) => days.includes(r.day));
    expect(byPurok(households, ranged)).toEqual([
      { purok: "Purok 1", households: 2, signedUp: 1, reached: 2, verified: 3, clean: 1 },
      { purok: "Purok 2", households: 1, signedUp: 1, reached: 1, verified: 0, clean: 0 },
    ]);
  });

  it("ranks collectors by collections and counts the days they worked", () => {
    const more = [...rows, c("2026-11-15", "h3", 10, "VERIFIED", { collectorId: "col-2" })];
    expect(byCollector(more)).toEqual([
      { collectorId: "col-1", collections: 5, days: 3 },
      { collectorId: "col-2", collections: 1, days: 1 },
    ]);
  });

  it("summarizes the range, with no rates when there's nothing to divide", () => {
    expect(summarize(households, rows, [{ day: "2026-11-15", points: 50 }], days)).toEqual({
      activeHouseholds: 3, reachRate: 1, cleanRate: 1 / 3, verified: 3, earned: 15, spent: 50,
    });
    expect(summarize([], [], [], days)).toMatchObject({ reachRate: null, cleanRate: null, earned: 0, spent: 0 });
  });
});
