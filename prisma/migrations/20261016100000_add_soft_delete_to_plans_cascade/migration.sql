-- Soft-delete support: add deletedAt to all tables in the Plans cascade chain

-- Plans
ALTER TABLE `Plans` ADD COLUMN `deletedAt` DATETIME(3) NULL;
CREATE INDEX `Plans_deletedAt_idx` ON `Plans`(`deletedAt`);

-- plan_images (PlanImages)
ALTER TABLE `plan_images` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- UserSubscriptions
ALTER TABLE `UserSubscriptions` ADD COLUMN `deletedAt` DATETIME(3) NULL;
CREATE INDEX `UserSubscriptions_deletedAt_idx` ON `UserSubscriptions`(`deletedAt`);

-- Deliveries
ALTER TABLE `Deliveries` ADD COLUMN `deletedAt` DATETIME(3) NULL;
CREATE INDEX `Deliveries_deletedAt_idx` ON `Deliveries`(`deletedAt`);

-- DeliveryVariation
ALTER TABLE `DeliveryVariation` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- Payments
ALTER TABLE `Payments` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- CustomerMessTransaction
ALTER TABLE `CustomerMessTransaction` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- Enquiry
ALTER TABLE `Enquiry` ADD COLUMN `deletedAt` DATETIME(3) NULL;
