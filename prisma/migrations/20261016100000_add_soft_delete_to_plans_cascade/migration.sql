-- AlterTable
ALTER TABLE `Plans` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `plan_images` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `UserSubscriptions` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `Deliveries` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `DeliveryVariation` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `Payments` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `CustomerMessTransaction` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `Enquiry` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `Plans_deletedAt_idx` ON `Plans`(`deletedAt`);

-- CreateIndex
CREATE INDEX `UserSubscriptions_deletedAt_idx` ON `UserSubscriptions`(`deletedAt`);

-- CreateIndex
CREATE INDEX `Deliveries_deletedAt_idx` ON `Deliveries`(`deletedAt`);
