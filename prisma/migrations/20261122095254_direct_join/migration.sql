-- DropForeignKey
ALTER TABLE "Enrolment" DROP CONSTRAINT "Enrolment_agentId_fkey";

-- AlterTable
ALTER TABLE "Enrolment" ALTER COLUMN "agentId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Enrolment" ADD CONSTRAINT "Enrolment_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

