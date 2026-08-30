-- AlterTable
ALTER TABLE `Mess` ADD COLUMN `slug` VARCHAR(191) NULL,
    ADD COLUMN `isListed` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `isFeatured` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX `Mess_slug_key` ON `Mess`(`slug`);
