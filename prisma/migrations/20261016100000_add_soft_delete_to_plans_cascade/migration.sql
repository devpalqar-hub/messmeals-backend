-- =================================================================
-- Soft-delete migration: add deletedAt to Plans cascade chain.
-- Also creates CustomerMessTransaction if it doesn't exist yet
-- (the previous migration was marked applied but never actually ran).
-- =================================================================

-- 1. Create CustomerMessTransaction (with deletedAt already included)
CREATE TABLE IF NOT EXISTS `customermesstransaction` (
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
    `deletedAt` DATETIME(3) NULL,
    `relatedTransactionId` VARCHAR(191) NULL,

    INDEX `CustomerMessTransaction_customerProfileId_messId_idx`(`customerProfileId`, `messId`),
    INDEX `CustomerMessTransaction_subscriptionId_idx`(`subscriptionId`),
    UNIQUE INDEX `CustomerMessTransaction_deliveryId_reason_key`(`deliveryId`, `reason`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Foreign keys for CustomerMessTransaction (IF NOT EXISTS not supported in older MySQL, use CREATE TABLE IF NOT EXISTS above)
ALTER TABLE `customermesstransaction` ADD CONSTRAINT `CustomerMessTransaction_customerProfileId_fkey` FOREIGN KEY (`customerProfileId`) REFERENCES `customerprofile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `customermesstransaction` ADD CONSTRAINT `CustomerMessTransaction_messId_fkey` FOREIGN KEY (`messId`) REFERENCES `mess`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `customermesstransaction` ADD CONSTRAINT `CustomerMessTransaction_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `usersubscriptions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `customermesstransaction` ADD CONSTRAINT `CustomerMessTransaction_deliveryId_fkey` FOREIGN KEY (`deliveryId`) REFERENCES `deliveries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `customermesstransaction` ADD CONSTRAINT `CustomerMessTransaction_relatedTransactionId_fkey` FOREIGN KEY (`relatedTransactionId`) REFERENCES `customermesstransaction`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- 2. Add deletedAt to plans
ALTER TABLE `plans` ADD COLUMN `deletedAt` DATETIME(3) NULL;
CREATE INDEX `Plans_deletedAt_idx` ON `plans`(`deletedAt`);

-- 3. Add deletedAt to plan_images
ALTER TABLE `plan_images` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- 4. Add deletedAt to usersubscriptions
ALTER TABLE `usersubscriptions` ADD COLUMN `deletedAt` DATETIME(3) NULL;
CREATE INDEX `UserSubscriptions_deletedAt_idx` ON `usersubscriptions`(`deletedAt`);

-- 5. Add deletedAt to deliveries
ALTER TABLE `deliveries` ADD COLUMN `deletedAt` DATETIME(3) NULL;
CREATE INDEX `Deliveries_deletedAt_idx` ON `deliveries`(`deletedAt`);

-- 6. Add deletedAt to deliveryvariation
ALTER TABLE `deliveryvariation` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- 7. Add deletedAt to payments
ALTER TABLE `payments` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- 8. Add deletedAt to enquiry
ALTER TABLE `enquiry` ADD COLUMN `deletedAt` DATETIME(3) NULL;
