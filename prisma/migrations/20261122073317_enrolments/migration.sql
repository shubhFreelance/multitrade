/*
  Warnings:

  - The primary key for the `OtpCode` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('LOGIN', 'ENROL');

-- CreateEnum
CREATE TYPE "EnrolmentStatus" AS ENUM ('ACTIVE', 'MATURED', 'DEFAULTED');

-- CreateEnum
CREATE TYPE "InstallmentStatus" AS ENUM ('DUE', 'PAID', 'OVERDUE', 'WAIVED');

-- AlterTable
ALTER TABLE "OtpCode" DROP CONSTRAINT "OtpCode_pkey",
ADD COLUMN     "context" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "purpose" "OtpPurpose" NOT NULL DEFAULT 'LOGIN',
ADD CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("phone", "purpose");

-- CreateTable
CREATE TABLE "Enrolment" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "tokenNumber" TEXT NOT NULL,
    "status" "EnrolmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Enrolment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Installment" (
    "id" TEXT NOT NULL,
    "enrolmentId" TEXT NOT NULL,
    "monthNo" INTEGER NOT NULL,
    "dueDate" DATE NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "InstallmentStatus" NOT NULL DEFAULT 'DUE',

    CONSTRAINT "Installment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Enrolment_tokenNumber_key" ON "Enrolment"("tokenNumber");

-- CreateIndex
CREATE INDEX "Enrolment_memberId_idx" ON "Enrolment"("memberId");

-- CreateIndex
CREATE INDEX "Enrolment_agentId_idx" ON "Enrolment"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "Enrolment_batchId_seq_key" ON "Enrolment"("batchId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "Installment_enrolmentId_monthNo_key" ON "Installment"("enrolmentId", "monthNo");

-- AddForeignKey
ALTER TABLE "Enrolment" ADD CONSTRAINT "Enrolment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrolment" ADD CONSTRAINT "Enrolment_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrolment" ADD CONSTRAINT "Enrolment_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_enrolmentId_fkey" FOREIGN KEY ("enrolmentId") REFERENCES "Enrolment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
