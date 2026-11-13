import "server-only";
import { z } from "zod";
import type { BinResult } from "@prisma/client";
import { db } from "./db";
import { FLAG_HOLD_REASON, type ReceivedResend } from "./collections";
import { scoreCollection } from "./scoring";

// Admin review of flagged collections: the only place a FLAGGED collection leaves that state.
//
// When a collection is flagged its points are held by a system REVERSAL of the AWARD
// (see holdAward in collections.ts). The admin then either:
//   release: the collection is fine. Status back to VERIFIED, and the hold is reversed (+points).
//            Ledger: AWARD +10 -> REVERSAL -10 (hold) -> REVERSAL +10 (release). Balance +10.
//   reject:  don't count it. Status REJECTED, and the hold simply stays. Balance 0.
// Either way the stored bins never change, and the decision and its reason go in the audit log.

export const reviewInputSchema = z.object({
  collectionId: z.uuid({ error: "Choose a collection to review." }),
  decision: z.enum(["release", "reject"], { error: "Choose release or don’t count." }),
  reason: z
    .string({ error: "Write a reason for your decision." })
    .trim()
    .min(3, "Write a reason for your decision (at least a few words).")
    .max(500, "Keep the reason under 500 characters."),
});
export type ReviewInput = z.infer<typeof reviewInputSchema>;

export type ReviewResult =
  | { ok: true; decision: ReviewInput["decision"]; householdCode: string; points: number }
  | { ok: false; error: "INVALID" | "NOT_FOUND" | "NOT_FLAGGED"; message: string; field?: "reason" };

/** Reason written on the release row. Visible in the ledger, so it stays short; the full reason is in the audit log. */
export const RELEASE_REASON = "Released after review";

export async function reviewFlaggedCollection(adminId: string, raw: unknown): Promise<ReviewResult> {
  const parsed = reviewInputSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path[0] === "reason" ? "reason" : undefined;
    return { ok: false, error: "INVALID", message: issue?.message ?? "Check the form and try again.", ...(field && { field }) };
  }
  const { collectionId, decision, reason } = parsed.data;

  return db.$transaction(async (tx) => {
    // The status guard makes this a compare-and-set: of two admins deciding at once, the second
    // waits for the first's row lock, then matches nothing.
    const { count } = await tx.collection.updateMany({
      where: { id: collectionId, status: "FLAGGED" },
      data: { status: decision === "release" ? "VERIFIED" : "REJECTED" },
    });
    if (count === 0) {
      const exists = await tx.collection.findUnique({ where: { id: collectionId }, select: { status: true } });
      return exists
        ? { ok: false, error: "NOT_FLAGGED", message: "This collection was already reviewed. The list has been updated." } as const
        : { ok: false, error: "NOT_FOUND", message: "That collection doesn’t exist." } as const;
    }

    const c = await tx.collection.findUniqueOrThrow({
      where: { id: collectionId },
      select: { householdId: true, score: true, household: { select: { code: true } } },
    });
    const hold = await findHold(tx, collectionId);

    let released = 0;
    if (decision === "release" && hold) {
      await tx.pointsLedger.create({
        data: {
          householdId: c.householdId,
          type: "REVERSAL",
          points: -hold.points,
          reversesId: hold.id,
          reason: RELEASE_REASON,
          actorId: adminId,
        },
      });
      released = -hold.points;
    }
    const held = hold ? -hold.points : 0;

    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: decision === "release" ? "collection.release" : "collection.reject",
        targetType: "Collection",
        targetId: collectionId,
        reason,
        meta: decision === "release" ? { pointsReleased: released } : { pointsNotCounted: held },
      },
    });
    return { ok: true, decision, householdCode: c.household.code, points: decision === "release" ? released : held } as const;
  });
}

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/** Selects the row that reversed an AWARD, with enough to tell whether it's a hold still in force. */
const holdSelect = {
  reversedBy: { select: { id: true, points: true, reason: true, actorId: true, reversedBy: { select: { id: true } } } },
} as const;
type HoldCandidate = { id: string; points: number; reason: string | null; actorId: string | null; reversedBy: { id: string } | null };

/**
 * The system hold on a collection's award, if it's still in force. There's none when the score was 0
 * (nothing awarded) or when the award had already been reversed for another reason before the flag.
 */
const activeHold = (r: HoldCandidate | null | undefined) =>
  r && r.actorId === null && r.reason === FLAG_HOLD_REASON && !r.reversedBy ? r : null;

async function findHold(tx: Tx, collectionId: string) {
  const award = await tx.pointsLedger.findUnique({ where: { collectionId }, select: holdSelect });
  return activeHold(award?.reversedBy);
}

// ---------- Reading the review queue ----------

type Bins = { biodegradable: BinResult; recyclable: BinResult; residual: BinResult };

export type FlaggedForReview = {
  id: string;
  household: { code: string; name: string; purok: string };
  collector: { name: string };
  collectedAt: Date;
  receivedAt: Date;
  collectionDay: string;
  bins: Bins;
  score: number;
  pointsHeld: number;
  flagReason: string | null;
  flaggedAt: Date | null;
  /** What the conflicting resend said. Null for collections flagged before this was recorded. */
  received: (Omit<ReceivedResend, "collectedAt"> & { collectedAt: Date; score: number }) | null;
};

const binsOf = (b: Bins): Bins => ({ biodegradable: b.biodegradable, recyclable: b.recyclable, residual: b.residual });

/** Validates the audit row's meta instead of trusting its shape. */
const receivedSchema = z.object({
  householdCode: z.string().nullable(),
  via: z.enum(["qr", "code"]),
  collectedAt: z.iso.datetime(),
  bins: z.object({
    biodegradable: z.enum(["CORRECT", "CONTAMINATED"]),
    recyclable: z.enum(["CORRECT", "CONTAMINATED"]),
    residual: z.enum(["CORRECT", "CONTAMINATED"]),
  }),
});

/** Flagged collections waiting for a decision, oldest first, so nothing waits forever. */
export async function flaggedForReview(limit = 50): Promise<FlaggedForReview[]> {
  const rows = await db.collection.findMany({
    where: { status: "FLAGGED" },
    orderBy: { collectedAt: "asc" },
    take: limit,
    include: {
      household: { select: { code: true, name: true, purok: true } },
      collector: { select: { name: true } },
      ledgerEntries: { where: { type: "AWARD" }, select: holdSelect },
    },
  });
  const flags = await db.auditLog.findMany({
    where: { action: "collection.flag", targetType: "Collection", targetId: { in: rows.map((r) => r.id) } },
    orderBy: { createdAt: "asc" },
    select: { targetId: true, createdAt: true, meta: true },
  });
  const flagOf = new Map<string, (typeof flags)[number]>();
  for (const f of flags) if (!flagOf.has(f.targetId)) flagOf.set(f.targetId, f);

  return rows.map((r) => {
    const hold = activeHold(r.ledgerEntries[0]?.reversedBy);
    const flag = flagOf.get(r.id);
    const meta = flag?.meta && typeof flag.meta === "object" && !Array.isArray(flag.meta) ? flag.meta.received : undefined;
    const rec = receivedSchema.safeParse(meta);
    return {
      id: r.id,
      household: r.household,
      collector: r.collector,
      collectedAt: r.collectedAt,
      receivedAt: r.receivedAt,
      collectionDay: r.collectionDay.toISOString().slice(0, 10),
      bins: binsOf(r),
      score: r.score,
      pointsHeld: hold ? -hold.points : 0,
      flagReason: r.flagReason,
      flaggedAt: flag?.createdAt ?? null,
      received: rec.success
        ? { ...rec.data, collectedAt: new Date(rec.data.collectedAt), score: scoreCollection(rec.data.bins) }
        : null,
    };
  });
}

export type RecentDecision = {
  id: string;
  decision: "release" | "reject";
  reason: string | null;
  points: number;
  decidedAt: Date;
  adminName: string;
  collectionId: string;
  household: { code: string; name: string } | null;
  collectedAt: Date | null;
};

const DECISION_ACTIONS = { "collection.release": "release", "collection.reject": "reject" } as const;

/** The latest review decisions, newest first, for the page's history and the "done" message. */
export async function recentDecisions(opts: { limit?: number; collectionId?: string } = {}): Promise<RecentDecision[]> {
  const logs = await db.auditLog.findMany({
    where: {
      action: { in: Object.keys(DECISION_ACTIONS) },
      targetType: "Collection",
      ...(opts.collectionId && { targetId: opts.collectionId }),
    },
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 10,
    include: { actor: { select: { name: true } } },
  });
  const collections = await db.collection.findMany({
    where: { id: { in: logs.map((l) => l.targetId) } },
    select: { id: true, collectedAt: true, household: { select: { code: true, name: true } } },
  });
  const byId = new Map(collections.map((c) => [c.id, c]));
  return logs.map((l) => {
    const meta = l.meta && typeof l.meta === "object" && !Array.isArray(l.meta) ? l.meta : {};
    const pts = meta.pointsReleased ?? meta.pointsNotCounted;
    const c = byId.get(l.targetId);
    return {
      id: l.id,
      decision: DECISION_ACTIONS[l.action as keyof typeof DECISION_ACTIONS],
      reason: l.reason,
      points: typeof pts === "number" ? pts : 0,
      decidedAt: l.createdAt,
      adminName: l.actor.name,
      collectionId: l.targetId,
      household: c?.household ?? null,
      collectedAt: c?.collectedAt ?? null,
    };
  });
}

export const countFlagged = () => db.collection.count({ where: { status: "FLAGGED" } });
