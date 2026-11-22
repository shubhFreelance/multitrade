-- CreateEnum
CREATE TYPE "DrawType" AS ENUM ('MONTHLY', 'BONUS');

-- AlterEnum
ALTER TYPE "EnrolmentStatus" ADD VALUE 'WON';

-- CreateTable
CREATE TABLE "Draw" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "type" "DrawType" NOT NULL DEFAULT 'MONTHLY',
    "monthNo" INTEGER NOT NULL,
    "seed" TEXT NOT NULL,
    "eligible" JSONB NOT NULL,
    "runById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Draw_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrawWinner" (
    "id" TEXT NOT NULL,
    "drawId" TEXT NOT NULL,
    "enrolmentId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "DrawWinner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Draw_batchId_type_monthNo_key" ON "Draw"("batchId", "type", "monthNo");

-- CreateIndex
CREATE INDEX "DrawWinner_enrolmentId_idx" ON "DrawWinner"("enrolmentId");

-- CreateIndex
CREATE UNIQUE INDEX "DrawWinner_drawId_enrolmentId_key" ON "DrawWinner"("drawId", "enrolmentId");

-- AddForeignKey
ALTER TABLE "Draw" ADD CONSTRAINT "Draw_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Draw" ADD CONSTRAINT "Draw_runById_fkey" FOREIGN KEY ("runById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawWinner" ADD CONSTRAINT "DrawWinner_drawId_fkey" FOREIGN KEY ("drawId") REFERENCES "Draw"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawWinner" ADD CONSTRAINT "DrawWinner_enrolmentId_fkey" FOREIGN KEY ("enrolmentId") REFERENCES "Enrolment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

