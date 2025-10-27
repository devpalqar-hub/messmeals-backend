/*
  Warnings:

  - Made the column `planId` on table `UserSubscriptions` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE `UserSubscriptions` DROP FOREIGN KEY `UserSubscriptions_planId_fkey`;

-- DropIndex
DROP INDEX `UserSubscriptions_planId_fkey` ON `UserSubscriptions`;

-- AlterTable
ALTER TABLE `UserSubscriptions` MODIFY `planId` VARCHAR(191) NOT NULL;

-- AddForeignKey
ALTER TABLE `UserSubscriptions` ADD CONSTRAINT `UserSubscriptions_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `Plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
