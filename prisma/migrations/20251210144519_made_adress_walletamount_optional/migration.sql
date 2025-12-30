-- AlterTable
ALTER TABLE `CustomerProfile` MODIFY `walletAmount` DECIMAL(65, 30) NULL DEFAULT 0.00,
    MODIFY `address` LONGTEXT NULL;
