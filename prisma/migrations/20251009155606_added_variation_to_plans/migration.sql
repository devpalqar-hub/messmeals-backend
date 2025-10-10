/*
  Warnings:

  - Added the required column `planId` to the `Variation` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Variation` ADD COLUMN `planId` VARCHAR(191) NOT NULL;

-- AddForeignKey
ALTER TABLE `Variation` ADD CONSTRAINT `Variation_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `Plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
