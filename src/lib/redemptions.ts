import "server-only";
import { z } from "zod";
import type { RedemptionStatus } from "@prisma/client";
import { db } from "./db";
import { en } from "./i18n/en";
import { format } from "./i18n/config";
import { parseRewardImage } from "./reward-images";

/** Reward messages in one language (resident actions pass the reader's; admin uses English). */
export type RewardMessages = { [K in keyof typeof en.errors.rewards]: string };
const EN_REWARDS: RewardMessages = en.errors.rewards;

// Rewards and redemptions. The only place REDEMPTION_HOLD rows are written.
//
//   request: points are held at once (REDEMPTION_HOLD -cost), so they can't be spent twice. One stock unit is reserved.
//   approve: the barangay has the item ready.              REQUESTED -> APPROVED
//   claim:   the resident picked it up. The hold stays (the points are spent).  APPROVED -> CLAIMED
//   reject:  admin says no. Hold reversed (+cost), stock returned.            REQUESTED|APPROVED -> REJECTED
//   cancel:  the resident withdraws it. Same as reject.                       REQUESTED -> CANCELLED

export type Result<T = object> = ({ ok: true } & T) | { ok: false; message: string; fieldErrors?: Record<string, string> };
type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

function invalid(error: z.ZodError): { ok: false; message: string; fieldErrors: Record<string, string> } {
  const fieldErrors: Record<string, string> = {};
  for (const i of error.issues) fieldErrors[String(i.path[0] ?? "form")] ??= i.message;
  return { ok: false, message: error.issues[0]?.message ?? "Check the form and try again.", fieldErrors };
}

/** Max open (requested or approved) redemptions per household, so a mistaken tap can't empty a balance. */
export const MAX_OPEN_REQUESTS = 3;

export const balanceOf = async (householdId: string, tx: Tx | typeof db = db) =>
  (await tx.pointsLedger.aggregate({ where: { householdId }, _sum: { points: true } }))._sum.points ?? 0;

// ---------- Catalogue (admin) ----------

const optionalStock = z
  .union([z.literal(""), z.coerce.number().int("Stock must be a whole number.").min(0, "Stock can’t be negative.").max(100_000)])
  .transform((v) => (v === "" ? null : v));

export const rewardSchema = z.object({
  name: z.string().trim().min(2, "Enter the reward name.").max(80),
  description: z.string().trim().max(240).transform((v) => v || null),
  pointsCost: z.coerce.number({ error: "Enter the points cost." }).int("Use a whole number.").min(1, "It must cost at least 1 point.").max(1_000_000),
  stock: optionalStock,
  // Optional: a missing picture means no picture (parseRewardImage turns anything unknown into null).
  imageUrl: z.unknown().optional().transform(parseRewardImage),
  active: z.enum(["on", "off"]).default("off").transform((v) => v === "on"),
});

export async function saveReward(adminId: string, rewardId: string | null, raw: unknown): Promise<Result<{ rewardId: string }>> {
  const parsed = rewardSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const data = parsed.data;
  return db.$transaction(async (tx) => {
    if (rewardId && !(await tx.reward.count({ where: { id: rewardId } }))) return { ok: false, message: "That reward doesn’t exist." } as const;
    const r = rewardId ? await tx.reward.update({ where: { id: rewardId }, data }) : await tx.reward.create({ data });
    await tx.auditLog.create({
      data: { actorId: adminId, action: rewardId ? "reward.update" : "reward.create", targetType: "Reward", targetId: r.id, meta: data },
    });
    return { ok: true, rewardId: r.id } as const;
  });
}

// ---------- Requests (resident) ----------

export async function requestReward(
  user: { id: string; householdId: string | null },
  rewardId: unknown,
  m: RewardMessages = EN_REWARDS,
): Promise<Result<{ redemptionId: string }>> {
  if (!user.householdId) return { ok: false, message: m.noHousehold };
  if (typeof rewardId !== "string" || !rewardId) return { ok: false, message: m.choose };
  const householdId = user.householdId;

  return db.$transaction(async (tx) => {
    // Serialize this household's spending: two taps at once can't both pass the balance check.
    await tx.$queryRaw`SELECT id FROM "Household" WHERE id = ${householdId} FOR UPDATE`;
    const reward = await tx.reward.findUnique({ where: { id: rewardId } });
    if (!reward || !reward.active) return { ok: false, message: m.unavailable } as const;
    const open = await tx.redemption.count({ where: { householdId, status: { in: ["REQUESTED", "APPROVED"] } } });
    if (open >= MAX_OPEN_REQUESTS) {
      return { ok: false, message: format(m.tooManyOpen, { n: open }) } as const;
    }
    const balance = await balanceOf(householdId, tx);
    if (balance < reward.pointsCost) {
      return { ok: false, message: format(m.needMore, { n: reward.pointsCost - balance }) } as const;
    }
    if (reward.stock !== null) {
      const { count } = await tx.reward.updateMany({ where: { id: reward.id, stock: { gt: 0 } }, data: { stock: { decrement: 1 } } });
      if (count === 0) return { ok: false, message: m.outOfStock } as const;
    }
    const r = await tx.redemption.create({ data: { householdId, rewardId: reward.id, pointsHeld: reward.pointsCost } });
    await tx.pointsLedger.create({
      data: { householdId, type: "REDEMPTION_HOLD", points: -reward.pointsCost, redemptionId: r.id, actorId: user.id },
    });
    await tx.auditLog.create({
      data: { actorId: user.id, action: "redemption.request", targetType: "Redemption", targetId: r.id, meta: { reward: reward.name, points: reward.pointsCost } },
    });
    return { ok: true, redemptionId: r.id } as const;
  });
}

// ---------- Decisions ----------

export type Decision = "approve" | "claim" | "reject" | "cancel";
const FROM: Record<Decision, RedemptionStatus[]> = {
  approve: ["REQUESTED"],
  claim: ["APPROVED"],
  reject: ["REQUESTED", "APPROVED"],
  cancel: ["REQUESTED"],
};
const TO: Record<Decision, RedemptionStatus> = { approve: "APPROVED", claim: "CLAIMED", reject: "REJECTED", cancel: "CANCELLED" };

const decisionSchema = z.object({
  redemptionId: z.uuid(),
  decision: z.enum(["approve", "claim", "reject"]),
  note: z.string().trim().max(300).optional().transform((v) => v || undefined),
});

/** Admin moves a request along. A rejection needs a note, which the resident sees. */
export async function decideRedemption(adminId: string, raw: unknown): Promise<Result> {
  const parsed = decisionSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { redemptionId, decision, note } = parsed.data;
  if (decision === "reject" && (!note || note.length < 3)) {
    return { ok: false, message: "Tell the resident why (they’ll see this note).", fieldErrors: { note: "Tell the resident why (they’ll see this note)." } };
  }
  return transition(redemptionId, decision, { actorId: adminId, decidedById: adminId, note });
}

/** The resident withdraws a request that hasn't been approved yet. */
export async function cancelRedemption(
  user: { id: string; householdId: string | null },
  redemptionId: unknown,
  m: RewardMessages = EN_REWARDS,
): Promise<Result> {
  if (typeof redemptionId !== "string" || !user.householdId) return { ok: false, message: m.notFound };
  const owned = await db.redemption.count({ where: { id: redemptionId, householdId: user.householdId } });
  if (!owned) return { ok: false, message: m.notFound };
  return transition(redemptionId, "cancel", { actorId: user.id, decidedById: null, note: "Cancelled by the resident" }, m);
}

async function transition(
  redemptionId: string,
  decision: Decision,
  by: { actorId: string; decidedById: string | null; note?: string },
  m: RewardMessages = EN_REWARDS,
): Promise<Result> {
  return db.$transaction(async (tx) => {
    // Compare-and-set on the status: two decisions at once can't both apply.
    const { count } = await tx.redemption.updateMany({
      where: { id: redemptionId, status: { in: FROM[decision] } },
      data: { status: TO[decision], decidedById: by.decidedById, decidedAt: new Date(), ...(by.note && { note: by.note }) },
    });
    if (count === 0) {
      const exists = await tx.redemption.count({ where: { id: redemptionId } });
      return { ok: false, message: exists ? m.alreadyUpdated : m.notFound } as const;
    }
    const r = await tx.redemption.findUniqueOrThrow({
      where: { id: redemptionId },
      include: { reward: { select: { id: true, stock: true } }, ledger: { where: { type: "REDEMPTION_HOLD" }, include: { reversedBy: { select: { id: true } } } } },
    });
    if (decision === "reject" || decision === "cancel") {
      const hold = r.ledger[0];
      if (hold && !hold.reversedBy) {
        await tx.pointsLedger.create({
          data: {
            householdId: r.householdId, type: "REVERSAL", points: -hold.points, reversesId: hold.id, redemptionId: r.id,
            reason: decision === "cancel" ? "Request cancelled by the resident" : "Request rejected",
            actorId: by.actorId,
          },
        });
      }
      if (r.reward.stock !== null) await tx.reward.update({ where: { id: r.reward.id }, data: { stock: { increment: 1 } } });
    }
    await tx.auditLog.create({
      data: { actorId: by.actorId, action: `redemption.${decision}`, targetType: "Redemption", targetId: r.id, reason: by.note ?? null },
    });
    return { ok: true } as const;
  });
}
