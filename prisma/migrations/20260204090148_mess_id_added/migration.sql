-- AlterTable
ALTER TABLE `Enquiry` ADD COLUMN `messId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `Enquiry` ADD CONSTRAINT `Enquiry_messId_fkey` FOREIGN KEY (`messId`) REFERENCES `Mess`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
