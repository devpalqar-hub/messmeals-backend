-- CreateTable
CREATE TABLE `delivery_stop_notes` (
    `id` VARCHAR(191) NOT NULL,
    `deliveryId` VARCHAR(191) NOT NULL,
    `deliveryVariationId` VARCHAR(191) NOT NULL,
    `variationId` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NULL,
    `partnerId` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'DELIVERED', 'COMPLETED', 'UNDELIVERED', 'CANCELLED') NOT NULL,
    `note` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `delivery_stop_notes_deliveryVariationId_key`(`deliveryVariationId`),
    INDEX `delivery_stop_notes_deliveryId_idx`(`deliveryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
