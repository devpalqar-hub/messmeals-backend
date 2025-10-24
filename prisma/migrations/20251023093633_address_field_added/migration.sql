/*
  Warnings:

  - You are about to drop the column `password` on the `User` table. All the data in the column will be lost.
  - Added the required column `address` to the `CustomerProfile` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `CustomerProfile` ADD COLUMN `address` LONGTEXT NOT NULL,
    ADD COLUMN `deliveryPartnerProfileId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `DeliveryPartnerProfile` ADD COLUMN `address` LONGTEXT NULL;

-- AlterTable
ALTER TABLE `User` DROP COLUMN `password`,
    ADD COLUMN `expiresAt` DATETIME(3) NULL,
    ADD COLUMN `is_verified` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `otp` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `CustomerProfile` ADD CONSTRAINT `CustomerProfile_deliveryPartnerProfileId_fkey` FOREIGN KEY (`deliveryPartnerProfileId`) REFERENCES `DeliveryPartnerProfile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
