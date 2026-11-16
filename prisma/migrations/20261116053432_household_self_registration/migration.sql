-- Households get their own status enum (adds PENDING for resident self-registration).
-- Converted in place so existing households keep their status (Prisma's default would drop the column).
CREATE TYPE "HouseholdStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE');

ALTER TABLE "Household" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Household" ALTER COLUMN "status" TYPE "HouseholdStatus" USING ("status"::text::"HouseholdStatus");
ALTER TABLE "Household" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

ALTER TABLE "Household" ADD COLUMN "selfRegistered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "statusNote" TEXT;
