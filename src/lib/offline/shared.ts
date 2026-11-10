// Pure logic for offline scanning, shared by the server (directory endpoint) and the collector's
// browser (queue + offline lookups). No browser or server-only imports, so it's unit-testable.
import { normalizeHouseholdCode } from "@/lib/collection-input";

// ---------- Household directory (the list stored on collector phones) ----------

/** Deliberately minimal: no address, claim code, residents or contact details. */
export type DirectoryHousehold = {
  code: string;
  name: string;
  purok: string;
  /** SHA-256 (hex) of each active QR token. The phone can recognize a code but holds no usable tokens. */
  qrHashes: string[];
  /** Manila YYYY-MM-DD of the latest collection, to warn about double scans while offline. */
  lastCollectionDay: string | null;
};

export type DirectoryPayload = { generatedAt: string; households: DirectoryHousehold[] };

/** What the phone stores: the payload, plus whose it is and when it was fetched. */
export type StoredDirectory = DirectoryPayload & { collectorId: string; fetchedAt: number };

/** Deleted from the phone if it hasn't been refreshed for this long. */
export const DIRECTORY_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** Refreshed in the background when online and older than this. */
export const DIRECTORY_REFRESH_MS = 60 * 60 * 1000;

/** The stored list is only used by the collector who downloaded it, and only while it's fresh. */
export function directoryUsable(dir: StoredDirectory | null | undefined, collectorId: string, now: number) {
  return !!dir && dir.collectorId === collectorId && now - dir.fetchedAt < DIRECTORY_MAX_AGE_MS;
}

export function findInDirectory(
  dir: Pick<StoredDirectory, "households">,
  ref: { qrHash: string } | { code: string },
): DirectoryHousehold | null {
  if ("qrHash" in ref) return dir.households.find((h) => h.qrHashes.includes(ref.qrHash)) ?? null;
  const code = normalizeHouseholdCode(ref.code);
  return dir.households.find((h) => h.code === code) ?? null;
}

// ---------- Queue retry policy ----------

/** 30s, 1m, 2m, 4m, then every 10m at most. Coming back online retries immediately anyway. */
export function backoffMs(attempts: number) {
  return Math.min(30_000 * 2 ** Math.max(0, attempts - 1), 10 * 60_000);
}

export type SendClass = "sent" | "retry" | "signed-out" | "forbidden" | "rejected";

/** Mirrors the retry rule documented in src/app/api/collections/route.ts. `null` = network error. */
export function classifyStatus(status: number | null): SendClass {
  if (status === null || status >= 500 || status === 408 || status === 429) return "retry";
  if (status >= 200 && status < 300) return "sent";
  if (status === 401) return "signed-out";
  if (status === 403) return "forbidden";
  return "rejected";
}

// ---------- Hex helper (same output as node's digest("hex")) ----------

export const toHex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
