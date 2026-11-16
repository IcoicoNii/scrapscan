-- AlterEnum
ALTER TYPE "RedemptionStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sessionsValidFrom" TIMESTAMP(3);
