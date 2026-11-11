-- AlterTable
ALTER TABLE `UserSubscriptions` ADD COLUMN `customerId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `UserSubscriptions_customerId_idx` ON `UserSubscriptions`(`customerId`);

-- AddForeignKey
ALTER TABLE `UserSubscriptions` ADD CONSTRAINT `UserSubscriptions_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
