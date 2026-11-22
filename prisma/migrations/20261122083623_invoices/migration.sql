-- CreateEnum
CREATE TYPE "AgentInvoiceStatus" AS ENUM ('ISSUED', 'PAID', 'CANCELLED');

-- AlterTable
ALTER TABLE "Commission" ADD COLUMN     "invoiceId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "invoiceNo" TEXT;

-- CreateTable
CREATE TABLE "InvoiceCounter" (
    "series" TEXT NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceCounter_pkey" PRIMARY KEY ("series")
);

-- CreateTable
CREATE TABLE "AgentInvoice" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "gross" INTEGER NOT NULL,
    "tdsBps" INTEGER NOT NULL,
    "tds" INTEGER NOT NULL,
    "net" INTEGER NOT NULL,
    "status" "AgentInvoiceStatus" NOT NULL DEFAULT 'ISSUED',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "utr" TEXT,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "AgentInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentInvoice_number_key" ON "AgentInvoice"("number");

-- CreateIndex
CREATE INDEX "AgentInvoice_agentId_idx" ON "AgentInvoice"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_invoiceNo_key" ON "Payment"("invoiceNo");

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "AgentInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentInvoice" ADD CONSTRAINT "AgentInvoice_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentInvoice" ADD CONSTRAINT "AgentInvoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

