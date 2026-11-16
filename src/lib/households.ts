import "server-only";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { HouseholdStatus } from "@prisma/client";
import { db } from "./db";
import { generateClaimCode, generateQrToken, normalizeClaimCode } from "./codes";
import { parseLoginId } from "./identifiers";
import { normalizeHouseholdCode } from "./collection-input";
import { en } from "./i18n/en";
import { format } from "./i18n/config";

/** Sign-up messages in one language. Callers pass the reader's; English by default. */
export type RegisterMessages = { [K in keyof typeof en.errors.register]: string };
const EN_REGISTER: RegisterMessages = en.errors.register;

// Creating households and linking resident accounts to them.
//
// A household is created by an admin (ACTIVE right away) or by a resident registering themselves
// (PENDING until an admin approves; it gets its QR code at once but collectors can't record it yet).
// The household's sign-up code (claimCode) lets family members join it, up to MAX_MEMBERS accounts.

export const MAX_MEMBERS = 5;

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];
const isUniqueViolation = (e: unknown) => typeof e === "object" && e !== null && "code" in e && e.code === "P2002";
/** True when the clash is on a login (email/phone). The error's shape differs between engines, so search all of it. */
const isLoginClash = (e: unknown) =>
  isUniqueViolation(e) && /email|phone/i.test(JSON.stringify((e as { meta?: unknown }).meta ?? {}) + String((e as Error).message));

export const householdFieldsSchema = z.object({
  name: z.string().trim().min(2, "Enter the household name.").max(80),
  address: z.string().trim().min(3, "Enter the address.").max(160),
  purok: z.string().trim().min(1, "Enter the purok or sitio.").max(40),
});
export type HouseholdFields = z.infer<typeof householdFieldsSchema>;

/**
 * Inserts a household with the next HH number, a sign-up code and a QR code. Two creations at once can pick the
 * same number; the unique constraint catches it and the caller retries the whole transaction (withNumberRetry).
 */
export async function createHousehold(
  tx: Tx,
  fields: HouseholdFields,
  opts: { status: HouseholdStatus; selfRegistered: boolean; claimedAt?: Date },
) {
  const last = await tx.household.findFirst({ where: { code: { startsWith: "HH-" } }, orderBy: { code: "desc" }, select: { code: true } });
  const next = last ? parseInt(last.code.slice(3), 10) + 1 : 1;
  const code = `HH-${String(next).padStart(5, "0")}`;
  return tx.household.create({
    data: {
      code,
      ...fields,
      status: opts.status,
      selfRegistered: opts.selfRegistered,
      claimedAt: opts.claimedAt,
      claimCode: generateClaimCode(),
      qrCodes: { create: { token: generateQrToken() } },
    },
  });
}

/** Retries a transaction that lost the race for the next household number (or drew a duplicate sign-up code). */
export async function withNumberRetry<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run();
    } catch (e) {
      // Household number, sign-up code or QR token clash: draw again. A login clash is the user's to fix.
      if (!isUniqueViolation(e) || isLoginClash(e) || attempt >= 3) throw e;
    }
  }
}

// ---------- Resident registration ----------

function registerSchema(m: RegisterMessages) {
  const account = z.object({
    name: z.string().trim().min(2, m.fullName).max(80),
    identifier: z.string().trim().min(1, m.identifier),
    password: z.string().min(8, m.password).max(200),
    confirm: z.string(),
    terms: z.literal("on", { error: m.terms }),
  });
  return z.discriminatedUnion("mode", [
    account.extend({
      mode: z.literal("new"),
      householdName: z.string().trim().min(2, m.householdName).max(80),
      address: z.string().trim().min(3, m.address).max(160),
      purok: z.string().trim().min(1, m.purok).max(40),
    }),
    account.extend({
      mode: z.literal("join"),
      householdCode: z.string().trim().min(1, m.code),
    }),
  ]);
}

export type RegisterResult =
  | { ok: true; userId: string; householdCode: string; joined: boolean }
  | { ok: false; fieldErrors: Record<string, string> };

class FieldError extends Error {
  constructor(public field: string, message: string) {
    super(message);
  }
}

/** Creates a resident account and either registers a new (PENDING) household or joins one with its sign-up code. */
export async function registerResident(raw: Record<string, unknown>, m: RegisterMessages = EN_REGISTER): Promise<RegisterResult> {
  const parsed = registerSchema(m).safeParse({ ...raw, mode: raw.mode === "join" ? "join" : "new" });
  const fieldErrors: Record<string, string> = {};
  if (!parsed.success) {
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0] ?? "form")] ??= i.message;
  } else if (parsed.data.password !== parsed.data.confirm) {
    fieldErrors.confirm = m.confirm;
  }
  const id = typeof raw.identifier === "string" ? parseLoginId(raw.identifier) : null;
  if (!id && !fieldErrors.identifier) fieldErrors.identifier = m.identifierInvalid;
  if (!parsed.success || Object.keys(fieldErrors).length || !id) return { ok: false, fieldErrors };

  const input = parsed.data;
  const passwordHash = await bcrypt.hash(input.password, 12);
  const login = id.kind === "email" ? { email: id.value } : { phone: id.value };

  try {
    return await withNumberRetry(() =>
      db.$transaction(async (tx) => {
        if (input.mode === "new") {
          const household = await createHousehold(
            tx,
            { name: input.householdName, address: input.address, purok: input.purok },
            { status: "PENDING", selfRegistered: true, claimedAt: new Date() },
          );
          const user = await tx.user.create({ data: { name: input.name, role: "CITIZEN", passwordHash, householdId: household.id, ...login } });
          await tx.auditLog.create({
            data: { actorId: user.id, action: "household.register", targetType: "Household", targetId: household.id, meta: { code: household.code } },
          });
          return { ok: true, userId: user.id, householdCode: household.code, joined: false } as const;
        }

        const household = await lockHouseholdByClaimCode(tx, input.householdCode, m);
        await assertRoomFor(tx, household.id, m);
        const user = await tx.user.create({ data: { name: input.name, role: "CITIZEN", passwordHash, householdId: household.id, ...login } });
        if (!household.claimedAt) await tx.household.update({ where: { id: household.id }, data: { claimedAt: new Date() } });
        await tx.auditLog.create({
          data: { actorId: user.id, action: "household.join", targetType: "Household", targetId: household.id, meta: { code: household.code } },
        });
        return { ok: true, userId: user.id, householdCode: household.code, joined: true } as const;
      }),
    );
  } catch (e) {
    if (e instanceof FieldError) return { ok: false, fieldErrors: { [e.field]: e.message } };
    if (isLoginClash(e)) return { ok: false, fieldErrors: { identifier: m.identifierTaken } };
    throw e;
  }
}

/** Finds a joinable household by sign-up code and locks it, so concurrent joins count members one at a time. */
async function lockHouseholdByClaimCode(tx: Tx, rawCode: string, m: RegisterMessages, field = "householdCode") {
  const claimCode = normalizeClaimCode(rawCode);
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Household" WHERE "claimCode" = ${claimCode} FOR UPDATE`;
  const household = rows[0] && (await tx.household.findUnique({ where: { id: rows[0].id } }));
  if (!household || household.status === "INACTIVE") {
    throw new FieldError(field, m.codeInvalid);
  }
  return household;
}

async function assertRoomFor(tx: Tx, householdId: string, m: RegisterMessages = EN_REGISTER, field = "householdCode") {
  const members = await tx.user.count({ where: { householdId } });
  if (members >= MAX_MEMBERS) {
    throw new FieldError(field, format(m.householdFull, { max: MAX_MEMBERS }));
  }
}

// ---------- Sign-up code ----------

/** A new sign-up code for the household; the old one stops working at once. */
export async function regenerateSignUpCode(actorId: string, householdId: string): Promise<{ ok: true; code: string } | { ok: false; message: string }> {
  return withNumberRetry(() =>
    db.$transaction(async (tx) => {
      const claimCode = generateClaimCode();
      const { count } = await tx.household.updateMany({ where: { id: householdId }, data: { claimCode } });
      if (!count) return { ok: false, message: "That household doesn’t exist." } as const;
      await tx.auditLog.create({ data: { actorId, action: "household.code_reset", targetType: "Household", targetId: householdId } });
      return { ok: true, code: claimCode } as const;
    }),
  );
}

// ---------- Admin: linking accounts and spotting duplicates ----------

/**
 * Moves a resident account to another household (by household number), or unlinks it (null).
 * For duplicate registrations and residents the admin signs up in person.
 */
export async function linkResident(
  adminId: string,
  userId: string,
  householdNumber: string | null,
): Promise<{ ok: true } | { ok: false; message: string; fieldErrors?: Record<string, string> }> {
  try {
    return await db.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { role: true, householdId: true } });
      if (!user || user.role !== "CITIZEN") return { ok: false, message: "Only resident accounts belong to a household." } as const;
      let target: { id: string; code: string } | null = null;
      if (householdNumber) {
        const code = normalizeHouseholdCode(householdNumber);
        const rows = await tx.$queryRaw<{ id: string; code: string }[]>`SELECT id, code FROM "Household" WHERE code = ${code} FOR UPDATE`;
        if (!rows[0]) throw new FieldError("household", "No household has that number.");
        target = rows[0];
        if (target.id === user.householdId) return { ok: true } as const;
        await assertRoomFor(tx, target.id, EN_REGISTER, "household");
      }
      await tx.user.update({ where: { id: userId }, data: { householdId: target?.id ?? null } });
      if (target) await tx.household.updateMany({ where: { id: target.id, claimedAt: null }, data: { claimedAt: new Date() } });
      await tx.auditLog.create({
        data: { actorId: adminId, action: "account.household_link", targetType: "User", targetId: userId, meta: { from: user.householdId, to: target?.code ?? null } },
      });
      return { ok: true } as const;
    });
  } catch (e) {
    if (e instanceof FieldError) return { ok: false, message: e.message, fieldErrors: { [e.field]: e.message } };
    throw e;
  }
}

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Other households that may be the same one: same purok and the same address or name, ignoring spacing and punctuation. */
export async function possibleDuplicates(h: { id: string; name: string; address: string; purok: string }) {
  const samePurok = await db.household.findMany({
    where: { purok: { equals: h.purok, mode: "insensitive" }, id: { not: h.id } },
    select: { code: true, name: true, address: true, status: true },
    take: 500,
  });
  const addr = normalize(h.address);
  const name = normalize(h.name);
  return samePurok.filter((o) => normalize(o.address) === addr || normalize(o.name) === name).slice(0, 5);
}
