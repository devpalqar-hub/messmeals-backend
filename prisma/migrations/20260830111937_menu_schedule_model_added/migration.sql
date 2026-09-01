-- DropForeignKey
ALTER TABLE `Menu` DROP FOREIGN KEY `Menu_variationId_fkey`;

-- DropIndex
DROP INDEX `Menu_variationId_idx` ON `Menu`;

-- AlterTable
ALTER TABLE `Menu`
    DROP COLUMN `variationId`,
    DROP COLUMN `days`,
    DROP COLUMN `items`,
    ADD COLUMN `schedule` JSON NOT NULL,
    MODIFY `name` VARCHAR(191) NOT NULL;
