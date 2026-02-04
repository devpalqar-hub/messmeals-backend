/*
  Warnings:

  - You are about to drop the column `tags` on the `Mess` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `Mess` DROP COLUMN `tags`;

-- CreateTable
CREATE TABLE `MessFoodType` (
    `id` VARCHAR(191) NOT NULL,
    `messId` VARCHAR(191) NOT NULL,
    `foodType` ENUM('VEG', 'NON_VEG', 'MIXED') NOT NULL,

    UNIQUE INDEX `MessFoodType_messId_foodType_key`(`messId`, `foodType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MessTag` (
    `id` VARCHAR(191) NOT NULL,
    `messId` VARCHAR(191) NOT NULL,
    `tag` ENUM('HOME_STYLE_FOOD', 'MONTHLY_PLANS', 'DAILY_FRESH_MEALS', 'FIXED_MENU', 'HYGIENIC_KITCHEN', 'AFFORDABLE_PRICING', 'VEG_AND_NON_VEG', 'ON_TIME_SERVING', 'QUALITY_INGREDIENTS', 'CONSISTENT_TASTE', 'STUDENT_FRIENDLY', 'FAMILY_MESS', 'FLEXIBLE_BOOKING', 'NO_HIDDEN_CHARGES', 'TRUSTED_MESS') NOT NULL,

    UNIQUE INDEX `MessTag_messId_tag_key`(`messId`, `tag`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MessFoodType` ADD CONSTRAINT `MessFoodType_messId_fkey` FOREIGN KEY (`messId`) REFERENCES `Mess`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MessTag` ADD CONSTRAINT `MessTag_messId_fkey` FOREIGN KEY (`messId`) REFERENCES `Mess`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
