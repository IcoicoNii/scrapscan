import { describe, expect, it, vi } from "vitest";
import { collectionInputSchema, newCollectionId, normalizeHouseholdCode } from "../collection-input";
import { manilaDateString, manilaDay } from "../dates";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));
const { payloadHash } = await import("../collections");

const valid = {
  id: "7d0f7a8e-3b8c-4e9a-9c1e-2f4b5a6c7d8e",
  household: { qrToken: "SS1.abc" },
  collectedAt: "2026-11-11T07:30:00+08:00",
  bins: { biodegradable: "CORRECT", recyclable: "CORRECT", residual: "CONTAMINATED" },
} as const;

describe("manilaDay", () => {
  it("rolls over at Manila midnight, not UTC midnight", () => {
    expect(manilaDateString(new Date("2026-11-10T15:59:59Z"))).toBe("2026-11-10");
    expect(manilaDateString(new Date("2026-11-10T16:00:00Z"))).toBe("2026-11-11");
  });
  it("returns UTC midnight of the Manila date", () => {
    expect(manilaDay(new Date("2026-11-10T20:00:00Z")).toISOString()).toBe("2026-11-11T00:00:00.000Z");
  });
});

describe("normalizeHouseholdCode", () => {
  it.each(["HH-00042", "hh-00042", "HH 42", "hh42", "42", " 00042 "])("%s -> HH-00042", (s) => {
    expect(normalizeHouseholdCode(s)).toBe("HH-00042");
  });
  it("leaves other codes as typed, upper-cased", () => {
    expect(normalizeHouseholdCode("ab-1")).toBe("AB-1");
  });
});

describe("collectionInputSchema", () => {
  it("accepts a QR or a typed code", () => {
    expect(collectionInputSchema.safeParse(valid).success).toBe(true);
    expect(collectionInputSchema.safeParse({ ...valid, household: { code: "42" } }).success).toBe(true);
  });
  it("rejects both refs at once, extra fields, a client-sent score, and bad values", () => {
    const bad = [
      { ...valid, household: { qrToken: "SS1.abc", code: "42" } },
      { ...valid, score: 10 },
      { ...valid, id: "not-a-uuid" },
      { ...valid, collectedAt: "yesterday" },
      { ...valid, bins: { ...valid.bins, residual: "MAYBE" } },
      { ...valid, bins: { biodegradable: "CORRECT", recyclable: "CORRECT" } },
    ];
    for (const b of bad) expect(collectionInputSchema.safeParse(b).success).toBe(false);
  });
});

describe("payloadHash", () => {
  const parse = (o: unknown) => collectionInputSchema.parse(o);
  it("matches equivalent retries (same instant in another offset, code typed differently)", () => {
    expect(payloadHash(parse(valid))).toBe(payloadHash(parse({ ...valid, collectedAt: "2026-11-10T23:30:00Z" })));
    expect(payloadHash(parse({ ...valid, household: { code: "hh 42" } }))).toBe(
      payloadHash(parse({ ...valid, household: { code: "HH-00042" } })),
    );
  });
  it("differs when any submitted detail changes", () => {
    const base = payloadHash(parse(valid));
    expect(payloadHash(parse({ ...valid, bins: { ...valid.bins, residual: "CORRECT" } }))).not.toBe(base);
    expect(payloadHash(parse({ ...valid, collectedAt: "2026-11-11T07:31:00+08:00" }))).not.toBe(base);
    expect(payloadHash(parse({ ...valid, household: { qrToken: "SS1.xyz" } }))).not.toBe(base);
  });
});

describe("newCollectionId", () => {
  const isValidId = (id: string) => collectionInputSchema.shape.id.safeParse(id).success;
  it("makes valid, unique v4 UUIDs", () => {
    const ids = new Set(Array.from({ length: 200 }, newCollectionId));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(isValidId(id)).toBe(true);
  });
  it("still works where crypto.randomUUID is missing (plain-http LAN testing)", () => {
    const real = globalThis.crypto;
    vi.stubGlobal("crypto", { getRandomValues: real.getRandomValues.bind(real) });
    try {
      const id = newCollectionId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(isValidId(id)).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
