import { describe, expect, it, vi } from "vitest";
import {
  backoffMs,
  classifyStatus,
  DIRECTORY_MAX_AGE_MS,
  directoryUsable,
  findInDirectory,
  type StoredDirectory,
} from "../offline/shared";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));
const { qrTokenHash } = await import("../directory");
const { hashToken } = await import("../offline/queue");

const now = Date.UTC(2026, 10, 11, 2, 0, 0);
const dir: StoredDirectory = {
  collectorId: "c1",
  fetchedAt: now - 1000,
  generatedAt: new Date(now).toISOString(),
  households: [
    { code: "HH-00042", name: "Santos household", purok: "Purok 1", qrHashes: ["aa", "bb"], lastCollectionDay: null },
    { code: "HH-00007", name: "Reyes household", purok: "Purok 1", qrHashes: [], lastCollectionDay: "2026-11-10" },
  ],
};

describe("directoryUsable", () => {
  it("only for the collector who downloaded it, and only while fresh", () => {
    expect(directoryUsable(dir, "c1", now)).toBe(true);
    expect(directoryUsable(dir, "someone-else", now)).toBe(false);
    expect(directoryUsable({ ...dir, fetchedAt: now - DIRECTORY_MAX_AGE_MS }, "c1", now)).toBe(false);
    expect(directoryUsable(null, "c1", now)).toBe(false);
  });
});

describe("findInDirectory", () => {
  it("matches a QR fingerprint or a typed code in any accepted spelling", () => {
    expect(findInDirectory(dir, { qrHash: "bb" })?.code).toBe("HH-00042");
    expect(findInDirectory(dir, { code: "hh 42" })?.code).toBe("HH-00042");
    expect(findInDirectory(dir, { code: "7" })?.code).toBe("HH-00007");
    expect(findInDirectory(dir, { qrHash: "zz" })).toBeNull();
    expect(findInDirectory(dir, { code: "99" })).toBeNull();
  });
});

describe("QR fingerprints", () => {
  it("the phone's Web Crypto hash matches the server's", async () => {
    const token = "SS1.TkBYtZBSLRDyEGCIR-N9wg";
    expect(await hashToken(token)).toBe(qrTokenHash(token));
    expect(qrTokenHash(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(qrTokenHash(token)).not.toContain("TkBY");
  });
});

describe("retry policy", () => {
  it("backs off 30s, 1m, 2m, 4m ... capped at 10m", () => {
    expect([1, 2, 3, 4, 5, 6, 20].map(backoffMs)).toEqual([30_000, 60_000, 120_000, 240_000, 480_000, 600_000, 600_000]);
  });
  it("follows the endpoint's retry rule", () => {
    expect(classifyStatus(201)).toBe("sent");
    expect(classifyStatus(200)).toBe("sent");
    expect(classifyStatus(null)).toBe("retry"); // network error / timeout
    expect(classifyStatus(500)).toBe("retry");
    expect(classifyStatus(503)).toBe("retry");
    expect(classifyStatus(429)).toBe("retry");
    expect(classifyStatus(401)).toBe("signed-out");
    expect(classifyStatus(403)).toBe("forbidden");
    for (const s of [400, 404, 409, 415, 422]) expect(classifyStatus(s)).toBe("rejected");
  });
});
