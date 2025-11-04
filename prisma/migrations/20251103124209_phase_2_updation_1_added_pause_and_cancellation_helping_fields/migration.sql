-- AlterTable
ALTER TABLE `UserSubscriptions` ADD COLUMN `cancellation_end_date` DATETIME(3) NULL,
    ADD COLUMN `cancellation_start_date` DATETIME(3) NULL,
    ADD COLUMN `pause_end_date` DATETIME(3) NULL,
    ADD COLUMN `pause_start_date` DATETIME(3) NULL,
    ADD COLUMN `scheduleType` ENUM('EVERYDAY', 'CUSTOM') NOT NULL DEFAULT 'EVERYDAY',
    ADD COLUMN `selectedDays` JSON NULL;
