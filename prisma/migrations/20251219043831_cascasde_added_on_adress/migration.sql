-- DropForeignKey
ALTER TABLE `UserAddress` DROP FOREIGN KEY `UserAddress_profileId_fkey`;

-- DropIndex
DROP INDEX `UserAddress_profileId_fkey` ON `UserAddress`;

-- AddForeignKey
ALTER TABLE `UserAddress` ADD CONSTRAINT `UserAddress_profileId_fkey` FOREIGN KEY (`profileId`) REFERENCES `CustomerProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
