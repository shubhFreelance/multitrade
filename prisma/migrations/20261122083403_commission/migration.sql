-- CreateEnum
CREATE TYPE "CommissionType" AS ENUM ('INSTALLMENT', 'BONUS');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('EARNED', 'REVERSED', 'PAID');

-- CreateTable
CREATE TABLE "Commission" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "paymentId" TEXT,
    "type" "CommissionType" NOT NULL DEFAULT 'INSTALLMENT',
    "amount" INTEGER NOT NULL,
    "ruleMissing" BOOLEAN NOT NULL DEFAULT false,
    "status" "CommissionStatus" NOT NULL DEFAULT 'EARNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Commission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Commission_paymentId_key" ON "Commission"("paymentId");

-- CreateIndex
CREATE INDEX "Commission_agentId_idx" ON "Commission"("agentId");

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
