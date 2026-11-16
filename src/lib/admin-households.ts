import "server-only";
import { z } from "zod";
import { db } from "./db";
import { generateQrToken } from "./codes";

// Admin changes to a household after it's created. Every change is audited with a reason where it
// affects collectors or points.

export type AdminResult = { ok: true } | { ok: false; message: string; fieldErrors?: Record<string, string> };

const reason = z.string({ error: "Write a reason." }).trim().min(3, "Write a reason (at least a few words).").max(300);

function invalid(error: z.ZodError): AdminResult {
  const fieldErrors: Record<string, string> = {};
  for (const i of error.issues) fieldErrors[String(i.path[0] ?? "form")] ??= i.message;
  return { ok: false, message: error.issues[0]?.message ?? "Check the form and try again.", fieldErrors };
}

export const householdDetailsSchema = z.object({
  householdId: z.uuid(),
  name: z.string().trim().min(2, "Enter the household name.").max(80),
  address: z.string().trim().min(3, "Enter the address.").max(160),
  purok: z.string().trim().min(1, "Enter the purok or sitio.").max(40),
});

export async function updateHouseholdDetails(adminId: string, raw: unknown): Promise<AdminResult> {
  const parsed = householdDetailsSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { householdId, ...data } = parsed.data;
  return db.$transaction(async (tx) => {
    const before = await tx.household.findUnique({ where: { id: householdId }, select: { name: true, address: true, purok: true } });
    if (!before) return { ok: false, message: "That household doesn’t exist." } as const;
    await tx.household.update({ where: { id: householdId }, data });
    await tx.auditLog.create({
      data: { actorId: adminId, action: "household.update", targetType: "Household", targetId: householdId, meta: { before, after: data } },
    });
    return { ok: true } as const;
  });
}

const statusSchema = z.object({ householdId: z.uuid(), status: z.enum(["ACTIVE", "INACTIVE"]), reason });

/** Inactive households can't be collected (online or from a collector's stored list) or signed up for. */
export async function setHouseholdStatus(adminId: string, raw: unknown): Promise<AdminResult> {
  const parsed = statusSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { householdId, status, reason } = parsed.data;
  return db.$transaction(async (tx) => {
    // PENDING households are decided with decideRegistration, never switched on directly.
    const from = status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const { count } = await tx.household.updateMany({ where: { id: householdId, status: from }, data: { status, statusNote: null } });
    if (count === 0) {
      const h = await tx.household.findUnique({ where: { id: householdId }, select: { status: true } });
      if (!h) return { ok: false, message: "That household doesn’t exist." } as const;
      if (h.status === "PENDING") return { ok: false, message: "This household is waiting for approval. Approve or decline the registration instead." } as const;
      return { ok: true } as const;
    }
    await tx.auditLog.create({
      data: {
        actorId: adminId, action: status === "ACTIVE" ? "household.activate" : "household.deactivate",
        targetType: "Household", targetId: householdId, reason,
      },
    });
    return { ok: true } as const;
  });
}

const registrationSchema = z
  .object({
    householdId: z.uuid(),
    decision: z.enum(["approve", "reject"], { error: "Choose approve or don’t approve." }),
    note: z.string().trim().max(300).optional().transform((v) => v || undefined),
  })
  .refine((d) => d.decision === "approve" || (d.note && d.note.length >= 3), {
    path: ["note"],
    message: "Tell the resident why (they’ll see this note).",
  });

/**
 * A resident-registered household: approve it (collectors can record it from now on) or don't
 * (it's turned off and the resident sees the note). Only PENDING households can be decided, once.
 */
export async function decideRegistration(adminId: string, raw: unknown): Promise<AdminResult & { code?: string }> {
  const parsed = registrationSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { householdId, decision, note } = parsed.data;
  return db.$transaction(async (tx) => {
    const { count } = await tx.household.updateMany({
      where: { id: householdId, status: "PENDING" },
      data: decision === "approve" ? { status: "ACTIVE", statusNote: null } : { status: "INACTIVE", statusNote: note },
    });
    if (count === 0) {
      const exists = await tx.household.count({ where: { id: householdId } });
      return { ok: false, message: exists ? "This registration was already decided. The page has been refreshed." : "That household doesn’t exist." } as const;
    }
    await tx.auditLog.create({
      data: {
        actorId: adminId, action: decision === "approve" ? "household.approve" : "household.reject",
        targetType: "Household", targetId: householdId, reason: note ?? null,
      },
    });
    return { ok: true } as const;
  });
}

const replaceSchema = z.object({ householdId: z.uuid(), reason });

/**
 * Lost or damaged sticker: the old QR stops working at once (collectors see "this QR code was replaced"),
 * and a new one is issued to print. Collectors' stored lists pick up the change on their next refresh.
 */
export async function replaceQrCode(adminId: string, raw: unknown): Promise<AdminResult> {
  const parsed = replaceSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { householdId, reason } = parsed.data;
  return db.$transaction(async (tx) => {
    // Lock the household so two replacements at once can't leave two active codes.
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Household" WHERE id = ${householdId} FOR UPDATE`;
    if (rows.length === 0) return { ok: false, message: "That household doesn’t exist." } as const;
    const revoked = await tx.qrCode.updateMany({ where: { householdId, status: "ACTIVE" }, data: { status: "REVOKED", revokedAt: new Date() } });
    const qr = await tx.qrCode.create({ data: { householdId, token: generateQrToken() } });
    await tx.auditLog.create({
      data: { actorId: adminId, action: "qr.replace", targetType: "Household", targetId: householdId, reason, meta: { revoked: revoked.count, newQrId: qr.id } },
    });
    return { ok: true } as const;
  });
}

const excludeSchema = z.object({ collectionId: z.uuid(), reason });

/**
 * A verified collection that shouldn't count (wrong household, bins recorded wrongly): it becomes REJECTED
 * and its award is reversed. The stored bins never change. The household can't be re-recorded that day;
 * if it earned less than recorded, the collector's next collection earns normally.
 */
export async function excludeCollection(adminId: string, raw: unknown): Promise<AdminResult & { points?: number }> {
  const parsed = excludeSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { collectionId, reason } = parsed.data;
  return db.$transaction(async (tx) => {
    const { count } = await tx.collection.updateMany({ where: { id: collectionId, status: "VERIFIED" }, data: { status: "REJECTED" } });
    if (count === 0) {
      const c = await tx.collection.findUnique({ where: { id: collectionId }, select: { status: true } });
      if (!c) return { ok: false, message: "That collection doesn’t exist." } as const;
      return {
        ok: false,
        message: c.status === "FLAGGED" ? "This collection is flagged. Decide it on the Reviews page." : "This collection already doesn’t count.",
      } as const;
    }
    const award = await tx.pointsLedger.findUnique({
      where: { collectionId },
      select: { id: true, householdId: true, points: true, reversedBy: { select: { id: true } } },
    });
    let points = 0;
    if (award && !award.reversedBy) {
      await tx.pointsLedger.create({
        data: { householdId: award.householdId, type: "REVERSAL", points: -award.points, reversesId: award.id, reason: `Not counted: ${reason}`.slice(0, 300), actorId: adminId },
      });
      points = award.points;
    }
    await tx.auditLog.create({
      data: { actorId: adminId, action: "collection.exclude", targetType: "Collection", targetId: collectionId, reason, meta: { pointsRemoved: points } },
    });
    return { ok: true, points } as const;
  });
}

export const householdBalance = async (householdId: string) =>
  (await db.pointsLedger.aggregate({ where: { householdId }, _sum: { points: true } }))._sum.points ?? 0;
