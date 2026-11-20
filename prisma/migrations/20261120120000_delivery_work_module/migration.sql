-- CreateTable
CREATE TABLE `delivery_route_plans` (
    `id` VARCHAR(191) NOT NULL,
    `messId` VARCHAR(191) NOT NULL,
    `partnerKey` VARCHAR(191) NOT NULL,
    `partnerId` VARCHAR(191) NULL,
    `variationId` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `fingerprint` VARCHAR(64) NOT NULL,
    `provider` ENUM('GOOGLE', 'HEURISTIC', 'MIXED') NOT NULL,
    `originLat` DOUBLE NULL,
    `originLng` DOUBLE NULL,
    `totalDistanceMeters` INTEGER NOT NULL DEFAULT 0,
    `totalDurationSeconds` INTEGER NOT NULL DEFAULT 0,
    `polylines` JSON NULL,
    `optimizedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `delivery_route_plans_partnerId_date_idx`(`partnerId`, `date`),
    UNIQUE INDEX `delivery_route_plans_messId_partnerKey_variationId_date_key`(`messId`, `partnerKey`, `variationId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `delivery_route_stops` (
    `id` VARCHAR(191) NOT NULL,
    `routePlanId` VARCHAR(191) NOT NULL,
    `deliveryId` VARCHAR(191) NOT NULL,
    `deliveryVariationId` VARCHAR(191) NOT NULL,
    `sequence` INTEGER NOT NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `routable` BOOLEAN NOT NULL DEFAULT true,
    `legDistanceMeters` INTEGER NULL,
    `legDurationSeconds` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `delivery_route_stops_routePlanId_sequence_idx`(`routePlanId`, `sequence`),
    INDEX `delivery_route_stops_deliveryId_idx`(`deliveryId`),
    UNIQUE INDEX `delivery_route_stops_routePlanId_deliveryId_key`(`routePlanId`, `deliveryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `delivery_work_sessions` (
    `id` VARCHAR(191) NOT NULL,
    `partnerId` VARCHAR(191) NOT NULL,
    `messId` VARCHAR(191) NOT NULL,
    `variationId` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `status` ENUM('IN_PROGRESS', 'COMPLETED', 'ENDED') NOT NULL DEFAULT 'IN_PROGRESS',
    `currentDeliveryId` VARCHAR(191) NULL,
    `totalStops` INTEGER NOT NULL DEFAULT 0,
    `deliveredCount` INTEGER NOT NULL DEFAULT 0,
    `undeliveredCount` INTEGER NOT NULL DEFAULT 0,
    `cancelledCount` INTEGER NOT NULL DEFAULT 0,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `delivery_work_sessions_partnerId_status_idx`(`partnerId`, `status`),
    UNIQUE INDEX `delivery_work_sessions_partnerId_variationId_date_key`(`partnerId`, `variationId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `delivery_route_stops` ADD CONSTRAINT `delivery_route_stops_routePlanId_fkey` FOREIGN KEY (`routePlanId`) REFERENCES `delivery_route_plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

