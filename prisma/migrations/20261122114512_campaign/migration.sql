-- AlterTable
ALTER TABLE "Commission" ADD COLUMN     "campaign" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Commission_agentId_campaign_key" ON "Commission"("agentId", "campaign");

