-- AlterTable
ALTER TABLE `UserSubscriptions` ADD COLUMN `userAddressId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `UserAddress` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `street` VARCHAR(191) NOT NULL,
    `townOrcity` VARCHAR(191) NOT NULL,
    `country` VARCHAR(191) NULL,
    `postcode` VARCHAR(191) NOT NULL,
    `landmark` VARCHAR(191) NULL,
    `latitudeLogitude` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `profileId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserSubscriptions` ADD CONSTRAINT `UserSubscriptions_userAddressId_fkey` FOREIGN KEY (`userAddressId`) REFERENCES `UserAddress`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserAddress` ADD CONSTRAINT `UserAddress_profileId_fkey` FOREIGN KEY (`profileId`) REFERENCES `CustomerProfile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
