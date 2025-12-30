/*
  Warnings:

  - Added the required column `messId` to the `UserSubscriptions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `UserSubscriptions` ADD COLUMN `messId` VARCHAR(191) NOT NULL;

-- AddForeignKey
ALTER TABLE `UserSubscriptions` ADD CONSTRAINT `UserSubscriptions_messId_fkey` FOREIGN KEY (`messId`) REFERENCES `Mess`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
