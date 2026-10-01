-- AlterTable
ALTER TABLE `Variation` ADD COLUMN `deliveryAssignmentId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `DeliveryAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `deliveryPartnerId` VARCHAR(191) NOT NULL,
    `deliveryId` VARCHAR(191) NOT NULL,
    `sequence` INTEGER NOT NULL DEFAULT 0,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `customerProfileId` VARCHAR(191) NULL,

    UNIQUE INDEX `DeliveryAssignment_deliveryId_key`(`deliveryId`),
    INDEX `DeliveryAssignment_deliveryPartnerId_idx`(`deliveryPartnerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Variation` ADD CONSTRAINT `Variation_deliveryAssignmentId_fkey` FOREIGN KEY (`deliveryAssignmentId`) REFERENCES `DeliveryAssignment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeliveryAssignment` ADD CONSTRAINT `DeliveryAssignment_deliveryPartnerId_fkey` FOREIGN KEY (`deliveryPartnerId`) REFERENCES `DeliveryPartnerProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeliveryAssignment` ADD CONSTRAINT `DeliveryAssignment_deliveryId_fkey` FOREIGN KEY (`deliveryId`) REFERENCES `Deliveries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeliveryAssignment` ADD CONSTRAINT `DeliveryAssignment_customerProfileId_fkey` FOREIGN KEY (`customerProfileId`) REFERENCES `CustomerProfile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
