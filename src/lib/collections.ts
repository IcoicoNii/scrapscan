import "server-only";
import { createHash } from "node:crypto";
import type { Collection, Household } from "@prisma/client";
import { db } from "./db";
import { scoreCollection } from "./scoring";
import { manilaDateString, manilaDay } from "./dates";
import {
  collectionInputSchema,
  householdRefSchema,
  normalizeHouseholdCode,
  type CollectionInput,
  type HouseholdRef,
} from "./collection-input";

// Records one collection: the only place that creates Collection rows and AWARD ledger rows.
//
// Idempotency: the device-generated `id` is the key. Sending the same id again with the same
// payload returns the stored result and never awards twice. The same id with a different payload
// flags the stored collection for admin review and holds its points; the submitted bins never change.

/** Phones' clocks drift. Allow a little skew into the future. */
const MAX_FUTURE_MS = 10 * 60 * 1000;
/** Matches the collector session length, so anything queued while signed in can still sync. */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export type CollectionSummary = {
  id: string;
  householdCode: string;
  householdName: string;
  collectedAt: string;
  collectionDay: string; // YYYY-MM-DD, Manila
  score: number;
  status: Collection["status"];
};

export type RecordErrorCode =
  | "INVALID" // malformed request: fix the client, don't retry
  | "OUT_OF_RANGE" // collectedAt too far in the future or the past
  | "HOUSEHOLD_NOT_FOUND"
  | "QR_REVOKED"
  | "HOUSEHOLD_INACTIVE"
  | "ALREADY_COLLECTED" // this household already has a collection for that Manila day
  | "ID_CONFLICT"; // this id was already used with different details (or by someone else)

export type RecordResult =
  | { ok: true; replay: boolean; collection: CollectionSummary }
  | { ok: false; error: RecordErrorCode; message: string; collection?: CollectionSummary };

type WithHousehold = Collection & { household: Pick<Household, "code" | "name"> };
const householdSelect = { household: { select: { code: true, name: true } } } as const;

const summarize = (c: WithHousehold): CollectionSummary => ({
  id: c.id,
  householdCode: c.household.code,
  householdName: c.household.name,
  collectedAt: c.collectedAt.toISOString(),
  collectionDay: c.collectionDay.toISOString().slice(0, 10),
  score: c.score,
  status: c.status,
});

const fail = (error: RecordErrorCode, message: string, collection?: CollectionSummary): RecordResult => ({
  ok: false,
  error,
  message,
  ...(collection && { collection }),
});

/** Fingerprint of what the collector actually submitted, normalized so equivalent retries match. */
export function payloadHash(input: CollectionInput): string {
  const ref = "qrToken" in input.household
    ? `qr:${input.household.qrToken}`
    : `code:${normalizeHouseholdCode(input.household.code)}`;
  const { biodegradable, recyclable, residual } = input.bins;
  const canonical = JSON.stringify([ref, new Date(input.collectedAt).toISOString(), biodegradable, recyclable, residual]);
  return createHash("sha256").update(canonical).digest("hex");
}

const isUniqueViolation = (e: unknown) =>
  typeof e === "object" && e !== null && "code" in e && e.code === "P2002";

export type HouseholdLookup =
  | {
      ok: true;
      household: { code: string; name: string; address: string; purok: string };
      /** Already has a collection today (Manila), so recording another would be refused. */
      collectedToday: CollectionSummary | null;
    }
  | { ok: false; error: "INVALID" | "HOUSEHOLD_NOT_FOUND" | "QR_REVOKED" | "HOUSEHOLD_INACTIVE"; message: string };

/** For the scan screen: confirm who this is before the collector checks the bins. */
export async function lookupHousehold(raw: unknown, now = new Date()): Promise<HouseholdLookup> {
  const parsed = householdRefSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "INVALID", message: "Scan a QR code or type a household number." };
  const household = await resolveHousehold(parsed.data);
  if ("ok" in household) return household;
  if (household.status !== "ACTIVE") {
    return { ok: false, error: "HOUSEHOLD_INACTIVE", message: "This household is inactive. Check with the barangay admin." };
  }
  const today = await db.collection.findUnique({
    where: { householdId_collectionDay: { householdId: household.id, collectionDay: manilaDay(now) } },
    include: householdSelect,
  });
  const { code, name, address, purok } = household;
  return { ok: true, household: { code, name, address, purok }, collectedToday: today ? summarize(today) : null };
}

type ResolveFailure = { ok: false; error: "HOUSEHOLD_NOT_FOUND" | "QR_REVOKED"; message: string };
const notFound = (message: string): ResolveFailure => ({ ok: false, error: "HOUSEHOLD_NOT_FOUND", message });

async function resolveHousehold(ref: HouseholdRef): Promise<Household | ResolveFailure> {
  if ("qrToken" in ref) {
    const qr = await db.qrCode.findUnique({ where: { token: ref.qrToken }, include: { household: true } });
    if (!qr) return notFound("This QR code isn't registered to any household.");
    if (qr.status !== "ACTIVE") {
      return {
        ok: false,
        error: "QR_REVOKED",
        message: "This QR code was replaced. Ask the household for their new one, or type the household number.",
      };
    }
    return qr.household;
  }
  const household = await db.household.findUnique({ where: { code: normalizeHouseholdCode(ref.code) } });
  return household ?? notFound("No household has that number. Check it and try again.");
}

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/** Reason on the system REVERSAL that holds a flagged collection's points. */
export const FLAG_HOLD_REASON = "On hold: collection flagged for review";

/**
 * Takes a flagged collection's points back out of the balance, so held points can't be spent.
 * The ledger is append-only, so this is a REVERSAL of the AWARD (actor null = system).
 * Ledger: AWARD +10 -> REVERSAL -10 (hold). If the admin clears the collection, they release it with
 * a REVERSAL of the hold (+10). If they reject it, the hold simply stays.
 */
async function holdAward(tx: Tx, collectionId: string) {
  const award = await tx.pointsLedger.findUnique({
    where: { collectionId },
    select: { id: true, householdId: true, points: true, reversedBy: { select: { id: true } } },
  });
  // Score 0 means nothing was awarded. Already reversed (e.g. by an admin) means nothing is left to hold.
  if (!award || award.reversedBy) return;
  await tx.pointsLedger.create({
    data: {
      householdId: award.householdId,
      type: "REVERSAL",
      points: -award.points,
      reversesId: award.id,
      reason: FLAG_HOLD_REASON,
    },
  });
}

/**
 * What the conflicting resend said, kept in the flag's audit row so the admin can compare it with the
 * stored collection. The household is recorded by its code, never by the raw QR token.
 */
export type ReceivedResend = {
  householdCode: string | null; // null: the QR or code it sent doesn't match any household
  via: "qr" | "code";
  collectedAt: string;
  bins: CollectionInput["bins"];
};

async function describeResend(input: CollectionInput): Promise<ReceivedResend> {
  const ref = input.household;
  const householdCode = "qrToken" in ref
    ? (await db.qrCode.findUnique({ where: { token: ref.qrToken }, select: { household: { select: { code: true } } } }))
        ?.household.code ?? null
    : normalizeHouseholdCode(ref.code);
  return {
    householdCode,
    via: "qrToken" in ref ? "qr" : "code",
    collectedAt: new Date(input.collectedAt).toISOString(),
    bins: input.bins,
  };
}

/** What to say when the id already exists. */
async function answerExisting(
  existing: WithHousehold,
  collectorId: string,
  hash: string,
  input: CollectionInput,
): Promise<RecordResult> {
  // Don't reveal anything about another collector's record.
  if (existing.collectorId !== collectorId) {
    return fail("ID_CONFLICT", "This collection ID is already in use. Record the collection again.");
  }
  if (existing.payloadHash === hash) {
    return { ok: true, replay: true, collection: summarize(existing) };
  }

  // Same id, different details: someone or something changed a submitted collection. Keep the
  // original, mark it for review (once) and hold its points until an admin decides.
  const received = await describeResend(input);
  const flagged = await db.$transaction(async (tx) => {
    const { count } = await tx.collection.updateMany({
      where: { id: existing.id, status: "VERIFIED" },
      data: { status: "FLAGGED", flagReason: "Sent again with different details. Needs review." },
    });
    if (count > 0) {
      await holdAward(tx, existing.id);
      await tx.auditLog.create({
        data: {
          actorId: collectorId,
          action: "collection.flag",
          targetType: "Collection",
          targetId: existing.id,
          reason: "Resubmitted with a different payload",
          meta: { storedHash: existing.payloadHash, receivedHash: hash, received },
        },
      });
    }
    return tx.collection.findUniqueOrThrow({ where: { id: existing.id }, include: householdSelect });
  });
  return fail(
    "ID_CONFLICT",
    "This collection was already sent with different details. It's been flagged for the admin to review, and its points are on hold.",
    summarize(flagged),
  );
}

export async function recordCollection(collectorId: string, raw: unknown, now = new Date()): Promise<RecordResult> {
  const parsed = collectionInputSchema.safeParse(raw);
  if (!parsed.success) return fail("INVALID", "The collection details are incomplete or malformed.");
  const input = parsed.data;
  const hash = payloadHash(input);

  // Retries are answered from the stored row before anything else, even if the QR has since been
  // revoked or the time window has passed: the device just needs to learn it already went through.
  const findExisting = () => db.collection.findUnique({ where: { id: input.id }, include: householdSelect });
  const existing = await findExisting();
  if (existing) return answerExisting(existing, collectorId, hash, input);

  const collectedAt = new Date(input.collectedAt);
  const age = now.getTime() - collectedAt.getTime();
  if (age < -MAX_FUTURE_MS) return fail("OUT_OF_RANGE", "The phone's clock looks wrong: this collection is dated in the future.");
  if (age > MAX_AGE_MS) return fail("OUT_OF_RANGE", "This collection is more than 30 days old and can't be recorded.");

  const household = await resolveHousehold(input.household);
  if ("ok" in household) return household;
  if (household.status !== "ACTIVE") return fail("HOUSEHOLD_INACTIVE", "This household is inactive. Check with the barangay admin.");

  const collectionDay = manilaDay(collectedAt);
  const score = scoreCollection(input.bins);

  try {
    const created = await db.$transaction(async (tx) => {
      const c = await tx.collection.create({
        data: {
          id: input.id,
          householdId: household.id,
          collectorId,
          collectedAt,
          collectionDay,
          ...input.bins,
          score,
          payloadHash: hash,
        },
        include: householdSelect,
      });
      // A score of 0 earns nothing, so there's no ledger row (AWARD rows must be positive).
      if (score > 0) {
        await tx.pointsLedger.create({
          data: { householdId: household.id, type: "AWARD", points: score, collectionId: c.id },
        });
      }
      return c;
    });
    return { ok: true, replay: false, collection: summarize(created) };
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    // Lost a race. Either the same id landed first (a concurrent retry), or this household was
    // already collected that day.
    const raced = await findExisting();
    if (raced) return answerExisting(raced, collectorId, hash, input);
    const sameDay = await db.collection.findUnique({
      where: { householdId_collectionDay: { householdId: household.id, collectionDay } },
      include: householdSelect,
    });
    return fail(
      "ALREADY_COLLECTED",
      `${household.name} (${household.code}) was already collected on ${manilaDateString(collectedAt)}.`,
      sameDay ? summarize(sameDay) : undefined,
    );
  }
}
