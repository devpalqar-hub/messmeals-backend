-- AlterTable
ALTER TABLE `Expense` ADD COLUMN `status` ENUM('PENDING', 'UNPAID', 'PAID') NOT NULL DEFAULT 'UNPAID',
    ADD COLUMN `paidAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `Expense_messId_status_idx` ON `Expense`(`messId`, `status`);
