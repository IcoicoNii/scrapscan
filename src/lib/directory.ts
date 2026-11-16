import "server-only";
import { createHash } from "node:crypto";
import { db } from "./db";
import type { DirectoryPayload } from "./offline/shared";

/** Same fingerprint the phone computes for a scanned token (hex SHA-256). */
export const qrTokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * The household list collector phones keep for offline scanning. Active households only, and only
 * what's needed to confirm a household at the door: number, name, purok, QR fingerprints, last
 * collection day. Pilot is one purok; when collectors get assigned areas, filter by area here.
 */
export async function collectorDirectory(): Promise<DirectoryPayload> {
  const rows = await db.household.findMany({
    where: { status: "ACTIVE" },
    orderBy: { code: "asc" },
    select: {
      code: true,
      name: true,
      purok: true,
      qrCodes: { where: { status: "ACTIVE" }, select: { token: true } },
      collections: { orderBy: { collectionDay: "desc" }, take: 1, select: { collectionDay: true } },
    },
  });
  return {
    generatedAt: new Date().toISOString(),
    households: rows.map((h) => ({
      code: h.code,
      name: h.name,
      purok: h.purok,
      qrHashes: h.qrCodes.map((q) => qrTokenHash(q.token)),
      lastCollectionDay: h.collections[0]?.collectionDay.toISOString().slice(0, 10) ?? null,
    })),
  };
}
