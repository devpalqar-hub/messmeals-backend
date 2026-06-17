/*
  Warnings:

  - A unique constraint covering the columns `[razorpayOrderId]` on the table `MessInvoice` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `BillingGlobalConfig` ADD COLUMN `defaultTrialDays` INTEGER NOT NULL DEFAULT 30;

-- AlterTable
ALTER TABLE `MessInvoice` ADD COLUMN `paymentProcessedAt` DATETIME(3) NULL,
    ADD COLUMN `razorpayOrderId` VARCHAR(191) NULL,
    ADD COLUMN `razorpayPaymentId` VARCHAR(191) NULL,
    ADD COLUMN `razorpayPaymentMeta` JSON NULL,
    ADD COLUMN `razorpaySignature` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `MessInvoice_razorpayOrderId_key` ON `MessInvoice`(`razorpayOrderId`);
