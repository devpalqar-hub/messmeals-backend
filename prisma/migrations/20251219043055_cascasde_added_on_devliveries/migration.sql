-- DropForeignKey
ALTER TABLE `Deliveries` DROP FOREIGN KEY `Deliveries_customerId_fkey`;

-- DropIndex
DROP INDEX `Deliveries_customerId_fkey` ON `Deliveries`;

-- AddForeignKey
ALTER TABLE `Deliveries` ADD CONSTRAINT `Deliveries_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `CustomerProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
