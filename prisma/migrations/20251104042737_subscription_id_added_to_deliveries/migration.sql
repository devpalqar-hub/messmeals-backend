-- AlterTable
ALTER TABLE `Deliveries` ADD COLUMN `subscriptionId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `Deliveries` ADD CONSTRAINT `Deliveries_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `UserSubscriptions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
