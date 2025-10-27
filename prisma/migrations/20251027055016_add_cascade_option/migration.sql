-- DropForeignKey
ALTER TABLE `CustomerProfile` DROP FOREIGN KEY `CustomerProfile_userId_fkey`;

-- DropForeignKey
ALTER TABLE `DeliveryPartnerProfile` DROP FOREIGN KEY `DeliveryPartnerProfile_userId_fkey`;

-- DropForeignKey
ALTER TABLE `UserSubscriptions` DROP FOREIGN KEY `UserSubscriptions_customerProfileId_fkey`;

-- DropIndex
DROP INDEX `UserSubscriptions_customerProfileId_fkey` ON `UserSubscriptions`;

-- AddForeignKey
ALTER TABLE `CustomerProfile` ADD CONSTRAINT `CustomerProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserSubscriptions` ADD CONSTRAINT `UserSubscriptions_customerProfileId_fkey` FOREIGN KEY (`customerProfileId`) REFERENCES `CustomerProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeliveryPartnerProfile` ADD CONSTRAINT `DeliveryPartnerProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
