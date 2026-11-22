-- CreateEnum
CREATE TYPE "BonusPrize" AS ENUM ('SCOOTER', 'GOLD_CHAIN');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'BONUS_SCOOTER';
ALTER TYPE "NotificationType" ADD VALUE 'BONUS_GOLD_CHAIN';

-- DropForeignKey
ALTER TABLE "Draw" DROP CONSTRAINT "Draw_batchId_fkey";

-- AlterTable
ALTER TABLE "Draw" ADD COLUMN     "prize" "BonusPrize",
ALTER COLUMN "batchId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "DrawWinner" ADD COLUMN     "handedOverAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Draw_type_prize_key" ON "Draw"("type", "prize");

-- AddForeignKey
ALTER TABLE "Draw" ADD CONSTRAINT "Draw_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

