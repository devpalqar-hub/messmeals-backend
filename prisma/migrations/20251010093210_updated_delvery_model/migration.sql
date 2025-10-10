-- DropForeignKey
ALTER TABLE `Deliveries` DROP FOREIGN KEY `Deliveries_partnerId_fkey`;

-- DropIndex
DROP INDEX `Deliveries_partnerId_fkey` ON `Deliveries`;

-- AlterTable
ALTER TABLE `Deliveries` MODIFY `status` ENUM('PLACED', 'DISPATCHED', 'COMPLETED', 'RETURNED', 'PACKDAMAGED') NULL,
    MODIFY `partnerId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `Deliveries` ADD CONSTRAINT `Deliveries_partnerId_fkey` FOREIGN KEY (`partnerId`) REFERENCES `DeliveryPartnerProfile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
