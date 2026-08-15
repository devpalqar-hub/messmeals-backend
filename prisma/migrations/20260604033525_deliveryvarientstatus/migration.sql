/*
  Warnings:

  - The values [PROGRESS] on the enum `Deliveries_status` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `Deliveries` MODIFY `status` ENUM('PENDING', 'DELIVERED', 'COMPLETED', 'UNDELIVERED') NULL;

-- CreateTable
CREATE TABLE `DeliveryVariation` (
    `id` VARCHAR(191) NOT NULL,
    `deliveryId` VARCHAR(191) NOT NULL,
    `variationId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'DELIVERED', 'COMPLETED', 'UNDELIVERED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DeliveryVariation_deliveryId_idx`(`deliveryId`),
    INDEX `DeliveryVariation_variationId_idx`(`variationId`),
    UNIQUE INDEX `DeliveryVariation_deliveryId_variationId_key`(`deliveryId`, `variationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DeliveryVariation` ADD CONSTRAINT `DeliveryVariation_deliveryId_fkey` FOREIGN KEY (`deliveryId`) REFERENCES `Deliveries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeliveryVariation` ADD CONSTRAINT `DeliveryVariation_variationId_fkey` FOREIGN KEY (`variationId`) REFERENCES `Variation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
