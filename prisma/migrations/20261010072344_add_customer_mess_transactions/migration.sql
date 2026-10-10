-- CreateTable
CREATE TABLE `CustomerMessTransaction` (
    `id` VARCHAR(191) NOT NULL,
    `customerProfileId` VARCHAR(191) NOT NULL,
    `messId` VARCHAR(191) NOT NULL,
    `subscriptionId` VARCHAR(191) NULL,
    `deliveryId` VARCHAR(191) NULL,
    `type` ENUM('DEBIT', 'CREDIT') NOT NULL,
    `reason` ENUM('MONTHLY_PLAN_CHARGE', 'DAILY_DELIVERY_CHARGE', 'PAYMENT_RECEIVED', 'REFUND_ADJUSTMENT', 'MANUAL_ADJUSTMENT') NOT NULL,
    `amount` DECIMAL(65, 30) NOT NULL,
    `balanceAfter` DECIMAL(65, 30) NOT NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `relatedTransactionId` VARCHAR(191) NULL,

    INDEX `CustomerMessTransaction_customerProfileId_messId_idx`(`customerProfileId`, `messId`),
    INDEX `CustomerMessTransaction_subscriptionId_idx`(`subscriptionId`),
    UNIQUE INDEX `CustomerMessTransaction_deliveryId_reason_key`(`deliveryId`, `reason`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CustomerMessTransaction` ADD CONSTRAINT `CustomerMessTransaction_customerProfileId_fkey` FOREIGN KEY (`customerProfileId`) REFERENCES `CustomerProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerMessTransaction` ADD CONSTRAINT `CustomerMessTransaction_messId_fkey` FOREIGN KEY (`messId`) REFERENCES `Mess`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerMessTransaction` ADD CONSTRAINT `CustomerMessTransaction_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `UserSubscriptions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerMessTransaction` ADD CONSTRAINT `CustomerMessTransaction_deliveryId_fkey` FOREIGN KEY (`deliveryId`) REFERENCES `Deliveries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerMessTransaction` ADD CONSTRAINT `CustomerMessTransaction_relatedTransactionId_fkey` FOREIGN KEY (`relatedTransactionId`) REFERENCES `CustomerMessTransaction`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
