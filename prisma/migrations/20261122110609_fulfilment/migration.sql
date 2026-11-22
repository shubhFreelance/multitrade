-- AlterEnum
ALTER TYPE "FulfilmentStatus" ADD VALUE 'ALLOCATED';

-- AlterTable
ALTER TABLE "Fulfilment" ADD COLUMN     "allocatedAt" TIMESTAMP(3),
ADD COLUMN     "differenceDue" INTEGER,
ADD COLUMN     "differencePaidAt" TIMESTAMP(3),
ADD COLUMN     "differenceRef" TEXT,
ADD COLUMN     "price" INTEGER,
ADD COLUMN     "priceDetails" JSONB;

-- CreateTable
CREATE TABLE "GoldRate" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "purity" TEXT NOT NULL DEFAULT '22K',
    "ratePerGram" INTEGER NOT NULL,
    "enteredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoldRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GoldRate_day_purity_key" ON "GoldRate"("day", "purity");

