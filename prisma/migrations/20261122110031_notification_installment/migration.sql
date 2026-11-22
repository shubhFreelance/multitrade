-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "Installment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

