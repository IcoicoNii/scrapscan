// One-off import: creates a Clerk login for every existing account that has a real email and no Clerk link yet.
//
// - Keeps each account's existing password (bcrypt), so nobody has to reset it.
// - Skips *.test addresses (seed data Clerk rejects) and phone-only accounts (Clerk can't send SMS to Philippine numbers yet).
// - Safe to re-run: accounts that already have a clerkId are never touched.
//
// Usage (from the project folder):
//   npx tsx scripts/clerk-import.ts --dry-run   # shows what would happen, changes nothing
//   npx tsx scripts/clerk-import.ts             # does the import

import { readFileSync } from "node:fs";
import { randomInt } from "node:crypto";
import { Client } from "pg";

// Read .env without extra packages (keys and values only; nothing is printed).
const env: Record<string, string> = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(line);
  if (m) env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
}

const secret = env.CLERK_SECRET_KEY;
const databaseUrl = env.DATABASE_URL;
if (!secret || !databaseUrl) throw new Error("CLERK_SECRET_KEY and DATABASE_URL must be set in .env");
const dryRun = process.argv.includes("--dry-run");

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const usernameFor = (name: string) => {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 20) || "user";
  const suffix = Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `${slug}_${suffix}`;
};

type Row = { id: string; email: string; name: string; role: string; passwordHash: string | null };

async function main() {
  const db = new Client({ connectionString: databaseUrl });
  await db.connect();
  try {
    const { rows } = await db.query<Row>(
      `SELECT id, email, name, role, "passwordHash" FROM "User"
       WHERE "clerkId" IS NULL AND email IS NOT NULL AND email NOT LIKE '%.test'
       ORDER BY role, name`,
    );
    console.log(`${rows.length} account(s) to import${dryRun ? " (dry run)" : ""}.`);

    let created = 0;
    let failed = 0;
    for (const row of rows) {
      if (dryRun) {
        console.log(`  would import: ${row.role} ${row.name} <${row.email}>`);
        continue;
      }
      const body: Record<string, unknown> = {
        email_address: [row.email],
        username: usernameFor(row.name),
        first_name: row.name,
      };
      if (row.passwordHash) {
        body.password_digest = row.passwordHash;
        body.password_hasher = "bcrypt";
      } else {
        body.skip_password_requirement = true;
      }
      const res = await fetch("https://api.clerk.com/v1/users", {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { id?: string; errors?: { long_message?: string; message?: string }[] };
      if (!res.ok || !json.id) {
        failed++;
        console.log(`  FAILED ${row.role} ${row.name}: ${json.errors?.[0]?.long_message ?? json.errors?.[0]?.message ?? res.status}`);
      } else {
        await db.query(`UPDATE "User" SET "clerkId" = $1 WHERE id = $2 AND "clerkId" IS NULL`, [json.id, row.id]);
        created++;
        console.log(`  imported ${row.role} ${row.name}`);
      }
      // Stay well under Clerk's rate limit.
      await new Promise((r) => setTimeout(r, 500));
    }

    const skipped = await db.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM "User" WHERE "clerkId" IS NULL AND (email IS NULL OR email LIKE '%.test')`,
    );
    console.log(`\nDone. Imported: ${created}. Failed: ${failed}. Skipped (test or phone-only, still unlinked): ${skipped.rows[0].n}.`);
  } finally {
    await db.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
