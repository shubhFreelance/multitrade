-- CreateEnum
CREATE TYPE "FulfilmentReason" AS ENUM ('MATURED', 'WON');

-- CreateEnum
CREATE TYPE "FulfilmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DELIVERED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('MATURED', 'WON');

-- CreateTable
CREATE TABLE "Fulfilment" (
    "id" TEXT NOT NULL,
    "enrolmentId" TEXT NOT NULL,
    "reason" "FulfilmentReason" NOT NULL,
    "status" "FulfilmentStatus" NOT NULL DEFAULT 'PENDING',
    "address" TEXT,
    "productId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fulfilment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "enrolmentId" TEXT,
    "sms" BOOLEAN NOT NULL DEFAULT false,
    "smsSentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Fulfilment_enrolmentId_key" ON "Fulfilment"("enrolmentId");

-- CreateIndex
CREATE INDEX "Fulfilment_status_idx" ON "Fulfilment"("status");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_sms_smsSentAt_idx" ON "Notification"("sms", "smsSentAt");

-- AddForeignKey
ALTER TABLE "Fulfilment" ADD CONSTRAINT "Fulfilment_enrolmentId_fkey" FOREIGN KEY ("enrolmentId") REFERENCES "Enrolment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fulfilment" ADD CONSTRAINT "Fulfilment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

