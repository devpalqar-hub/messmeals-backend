/*
  Warnings:

  - You are about to drop the column `deliveryPartnerProfileId` on the `CustomerProfile` table. All the data in the column will be lost.
  - You are about to drop the column `end_date` on the `CustomerProfile` table. All the data in the column will be lost.
  - You are about to drop the column `planId` on the `CustomerProfile` table. All the data in the column will be lost.
  - You are about to drop the column `start_date` on the `CustomerProfile` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `CustomerProfile` DROP FOREIGN KEY `CustomerProfile_deliveryPartnerProfileId_fkey`;

-- DropForeignKey
ALTER TABLE `CustomerProfile` DROP FOREIGN KEY `CustomerProfile_planId_fkey`;

-- DropIndex
DROP INDEX `CustomerProfile_deliveryPartnerProfileId_fkey` ON `CustomerProfile`;

-- DropIndex
DROP INDEX `CustomerProfile_planId_fkey` ON `CustomerProfile`;

-- AlterTable
ALTER TABLE `CustomerProfile` DROP COLUMN `deliveryPartnerProfileId`,
    DROP COLUMN `end_date`,
    DROP COLUMN `planId`,
    DROP COLUMN `start_date`;

-- CreateTable
CREATE TABLE `UserSubscriptions` (
    `id` VARCHAR(191) NOT NULL,
    `start_date` DATETIME(3) NOT NULL,
    `end_date` DATETIME(3) NULL,
    `deliveryPartnerProfileId` VARCHAR(191) NULL,
    `planId` VARCHAR(191) NULL,
    `customerProfileId` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserSubscriptions` ADD CONSTRAINT `UserSubscriptions_deliveryPartnerProfileId_fkey` FOREIGN KEY (`deliveryPartnerProfileId`) REFERENCES `DeliveryPartnerProfile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserSubscriptions` ADD CONSTRAINT `UserSubscriptions_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `Plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserSubscriptions` ADD CONSTRAINT `UserSubscriptions_customerProfileId_fkey` FOREIGN KEY (`customerProfileId`) REFERENCES `CustomerProfile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
