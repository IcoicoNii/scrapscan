// Shape of one collection as the collector's device sends it. Pure module (no server-only imports)
// so the scan screen and offline queue can validate with the same schema before sending.
import { z } from "zod";

const binResult = z.enum(["CORRECT", "CONTAMINATED"]);

/** Every ScrapScan QR token starts with this, so the scanner can reject other QR codes on the spot. */
export const QR_PREFIX = "SS1.";

/** Exactly one: the scanned QR token, or the household code typed by hand. */
export const householdRefSchema = z.union([
  z.strictObject({ qrToken: z.string().trim().min(1).max(200) }),
  z.strictObject({ code: z.string().trim().min(1).max(20) }),
]);
export type HouseholdRef = z.infer<typeof householdRefSchema>;

export const collectionInputSchema = z.strictObject({
  // Generated on the device (crypto.randomUUID()) and reused on every retry: it's the idempotency key.
  id: z.uuid(),
  household: householdRefSchema,
  // Device time when the bins were checked. Late syncs keep the original time.
  collectedAt: z.iso.datetime({ offset: true }),
  bins: z.strictObject({
    biodegradable: binResult,
    recyclable: binResult,
    residual: binResult,
  }),
});

export type CollectionInput = z.infer<typeof collectionInputSchema>;

/**
 * A v4 UUID for a new collection. crypto.randomUUID() only exists in secure contexts (HTTPS or
 * localhost), so fall back to getRandomValues, which works everywhere, e.g. testing over LAN http.
 */
export function newCollectionId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // RFC 4122 variant
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** "hh-00042", "HH 42", "hh42" and "42" all mean HH-00042. Anything else is matched as typed (upper-cased). */
export function normalizeHouseholdCode(input: string): string {
  const s = input.trim().toUpperCase().replace(/\s+/g, "");
  const m = /^(?:HH-?)?(\d{1,5})$/.exec(s);
  return m ? `HH-${m[1].padStart(5, "0")}` : s;
}
