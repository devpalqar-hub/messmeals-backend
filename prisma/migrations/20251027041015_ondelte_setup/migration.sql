-- DropForeignKey
ALTER TABLE `Deliveries` DROP FOREIGN KEY `Deliveries_planId_fkey`;

-- DropIndex
DROP INDEX `Deliveries_planId_fkey` ON `Deliveries`;

-- AddForeignKey
ALTER TABLE `Deliveries` ADD CONSTRAINT `Deliveries_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `Plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
