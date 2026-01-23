/*
  Warnings:

  - A unique constraint covering the columns `[messId,deliveryPriority]` on the table `UserSubscriptions` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE INDEX `UserSubscriptions_messId_deliveryPriority_idx` ON `UserSubscriptions`(`messId`, `deliveryPriority`);

-- CreateIndex
CREATE UNIQUE INDEX `UserSubscriptions_messId_deliveryPriority_key` ON `UserSubscriptions`(`messId`, `deliveryPriority`);
