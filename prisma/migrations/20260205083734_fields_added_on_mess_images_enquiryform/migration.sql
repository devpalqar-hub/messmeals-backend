-- AlterTable
ALTER TABLE `District` ADD COLUMN `isPopular` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `Enquiry` ADD COLUMN `planId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `mess_images` ADD COLUMN `isCover` BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE `Enquiry` ADD CONSTRAINT `Enquiry_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `Plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
