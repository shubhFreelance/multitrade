-- CreateEnum
CREATE TYPE "SchemeCode" AS ENUM ('UPAHAR', 'MANPASAND', 'GOLD');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('OPEN', 'RUNNING', 'CLOSED');

-- CreateTable
CREATE TABLE "AgentProfile" (
    "userId" TEXT NOT NULL,
    "panchayat" TEXT NOT NULL,
    "pan" TEXT,
    "payoutDetails" JSONB,
    "approved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AgentProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "MemberProfile" (
    "userId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "village" TEXT NOT NULL,
    "nominee" TEXT,

    CONSTRAINT "MemberProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Scheme" (
    "id" TEXT NOT NULL,
    "code" "SchemeCode" NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameHi" TEXT NOT NULL,
    "installmentAmount" INTEGER NOT NULL,
    "tenureMonths" INTEGER NOT NULL,
    "commissionRule" JSONB NOT NULL,

    CONSTRAINT "Scheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "startMonth" DATE NOT NULL,
    "size" INTEGER NOT NULL,
    "winnersPerDraw" INTEGER NOT NULL,
    "status" "BatchStatus" NOT NULL DEFAULT 'OPEN',

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Config" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Config_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Scheme_code_key" ON "Scheme"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Batch_schemeId_number_key" ON "Batch"("schemeId", "number");

-- AddForeignKey
ALTER TABLE "AgentProfile" ADD CONSTRAINT "AgentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberProfile" ADD CONSTRAINT "MemberProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "Scheme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
