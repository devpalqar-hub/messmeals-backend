-- AlterTable
ALTER TABLE `UserSubscriptions` ADD COLUMN `address` LONGTEXT NULL,
    ADD COLUMN `latitude_logitude` VARCHAR(191) NULL;
