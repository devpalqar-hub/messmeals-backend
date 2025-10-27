/*
  Warnings:

  - You are about to drop the column `planId` on the `Variation` table. All the data in the column will be lost.
  - You are about to drop the column `timeRange` on the `Variation` table. All the data in the column will be lost.
  - You are about to drop the `variation_images` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `Variation` DROP FOREIGN KEY `Variation_planId_fkey`;

-- DropForeignKey
ALTER TABLE `variation_images` DROP FOREIGN KEY `variation_images_variationId_fkey`;

-- DropIndex
DROP INDEX `Variation_planId_fkey` ON `Variation`;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `Variation` DROP COLUMN `planId`,
    DROP COLUMN `timeRange`;

-- DropTable
DROP TABLE `variation_images`;

-- CreateTable
CREATE TABLE `_PlansToVariation` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_PlansToVariation_AB_unique`(`A`, `B`),
    INDEX `_PlansToVariation_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `_PlansToVariation` ADD CONSTRAINT `_PlansToVariation_A_fkey` FOREIGN KEY (`A`) REFERENCES `Plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_PlansToVariation` ADD CONSTRAINT `_PlansToVariation_B_fkey` FOREIGN KEY (`B`) REFERENCES `Variation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
