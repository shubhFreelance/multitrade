-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'DUE_SOON';
ALTER TYPE "NotificationType" ADD VALUE 'DUE_TODAY';
ALTER TYPE "NotificationType" ADD VALUE 'OVERDUE';
ALTER TYPE "NotificationType" ADD VALUE 'DEFAULTED';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "installmentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Notification_installmentId_type_key" ON "Notification"("installmentId", "type");

