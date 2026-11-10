// Dev/demo seed. Refuses to run in production.
// Run: npm run db:seed   (safe to re-run: it only fills what's missing)
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { generateClaimCode, generateQrToken } from "../src/lib/codes";

if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed in production.");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const DEMO_PASSWORD = "Password123!";
const SURNAMES = [
  "Dela Cruz", "Santos", "Reyes", "Garcia", "Mendoza", "Bautista", "Ramos", "Aquino", "Flores", "Castillo",
  "Villanueva", "Navarro", "Torres", "Domingo", "Salazar", "Aguilar", "Pascual", "Mercado", "Cruz", "Rivera",
  "Lopez", "Soriano", "Valdez", "Tolentino", "Manalo",
];

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  await db.user.upsert({
    where: { email: "admin@scrapscan.test" },
    update: {},
    create: { email: "admin@scrapscan.test", name: "Barangay Admin", role: "ADMIN", passwordHash },
  });
  await db.user.upsert({
    where: { email: "collector@scrapscan.test" },
    update: {},
    create: { email: "collector@scrapscan.test", name: "Jose Collector", role: "COLLECTOR", passwordHash },
  });

  // 50 households in one purok, matching the pilot size.
  for (let i = 1; i <= 50; i++) {
    const code = `HH-${String(i).padStart(5, "0")}`;
    const exists = await db.household.findUnique({ where: { code } });
    if (exists) continue;
    await db.household.create({
      data: {
        code,
        name: `${SURNAMES[(i - 1) % SURNAMES.length]} household`,
        address: `Block ${Math.ceil(i / 10)}, Lot ${i}`,
        purok: "Purok 1",
        claimCode: generateClaimCode(),
        qrCodes: { create: { token: generateQrToken() } },
      },
    });
  }

  // Demo resident already signed up to HH-00001.
  const first = await db.household.findUniqueOrThrow({ where: { code: "HH-00001" } });
  if (!first.claimedAt) {
    await db.$transaction([
      db.household.update({ where: { id: first.id }, data: { claimedAt: new Date() } }),
      db.user.create({
        data: { email: "maria@scrapscan.test", name: "Maria Dela Cruz", role: "CITIZEN", passwordHash, householdId: first.id },
      }),
    ]);
  }

  // Community cleanliness items from the system doc.
  if ((await db.reward.count()) === 0) {
    await db.reward.createMany({
      data: [
        { name: "Broom", description: "Walis tingting", pointsCost: 50 },
        { name: "Eco-friendly dish soap", pointsCost: 80 },
        { name: "Dustpan set", pointsCost: 120 },
      ],
    });
  }

  console.log("\nSeeded. Demo logins (password for all: %s)", DEMO_PASSWORD);
  console.log("  admin      admin@scrapscan.test");
  console.log("  collector  collector@scrapscan.test");
  console.log("  citizen    maria@scrapscan.test  (household HH-00001)");
  const open = await db.household.findFirst({ where: { claimedAt: null }, orderBy: { code: "asc" } });
  if (open) console.log("  unclaimed household %s has claim code %s", open.code, open.claimCode);
}

main().finally(() => db.$disconnect());
