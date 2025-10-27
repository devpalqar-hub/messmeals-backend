-- AlterTable
ALTER TABLE `CustomerProfile` ADD COLUMN `current_location` VARCHAR(191) NULL,
    ADD COLUMN `latitude_logitude` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `UserSubscriptions` ADD COLUMN `discount` DECIMAL(65, 30) NOT NULL DEFAULT 0.00,
    ADD COLUMN `discountedPrice` DECIMAL(65, 30) NOT NULL DEFAULT 0.00,
    ADD COLUMN `totalPrice` DECIMAL(65, 30) NOT NULL DEFAULT 0.00;
