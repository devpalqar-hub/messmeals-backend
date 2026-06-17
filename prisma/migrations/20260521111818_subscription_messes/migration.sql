-- AlterTable
ALTER TABLE `Mess` ADD COLUMN `billingDisabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `billingDisabledAt` DATETIME(3) NULL,
    ADD COLUMN `billingReactivatesAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `BillingGlobalConfig` (
    `id` VARCHAR(191) NOT NULL,
    `defaultPerCustomerRate` DECIMAL(65, 30) NOT NULL DEFAULT 4.00,
    `dueDaysBeforePeriodEnd` INTEGER NOT NULL DEFAULT 5,
    `graceDaysAfterDue` INTEGER NOT NULL DEFAULT 5,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BillingTier` (
    `id` VARCHAR(191) NOT NULL,
    `minCustomers` INTEGER NOT NULL,
    `maxCustomers` INTEGER NULL,
    `perCustomerRate` DECIMAL(65, 30) NOT NULL DEFAULT 0.00,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BillingTier_isActive_idx`(`isActive`),
    INDEX `BillingTier_minCustomers_maxCustomers_idx`(`minCustomers`, `maxCustomers`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MessBillingConfig` (
    `id` VARCHAR(191) NOT NULL,
    `messId` VARCHAR(191) NOT NULL,
    `trialEndsAt` DATETIME(3) NULL,
    `perCustomerRateOverride` DECIMAL(65, 30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MessBillingConfig_messId_key`(`messId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MessInvoice` (
    `id` VARCHAR(191) NOT NULL,
    `messId` VARCHAR(191) NOT NULL,
    `periodStart` DATETIME(3) NOT NULL,
    `periodEnd` DATETIME(3) NOT NULL,
    `dueDate` DATETIME(3) NOT NULL,
    `customerCount` INTEGER NOT NULL,
    `rate` DECIMAL(65, 30) NOT NULL DEFAULT 0.00,
    `amount` DECIMAL(65, 30) NOT NULL DEFAULT 0.00,
    `status` ENUM('UNPAID', 'PAID', 'OVERDUE') NOT NULL DEFAULT 'UNPAID',
    `paidAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MessInvoice_messId_status_idx`(`messId`, `status`),
    INDEX `MessInvoice_dueDate_idx`(`dueDate`),
    UNIQUE INDEX `MessInvoice_messId_periodStart_periodEnd_key`(`messId`, `periodStart`, `periodEnd`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MessBillingConfig` ADD CONSTRAINT `MessBillingConfig_messId_fkey` FOREIGN KEY (`messId`) REFERENCES `Mess`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MessInvoice` ADD CONSTRAINT `MessInvoice_messId_fkey` FOREIGN KEY (`messId`) REFERENCES `Mess`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
