-- CreateTable
CREATE TABLE `Menu` (
    `id` VARCHAR(191) NOT NULL,
    `messId` VARCHAR(191) NOT NULL,
    `variationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `days` JSON NOT NULL,
    `items` TEXT NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Menu_messId_idx`(`messId`),
    INDEX `Menu_variationId_idx`(`variationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_MenuToPlans` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_MenuToPlans_AB_unique`(`A`, `B`),
    INDEX `_MenuToPlans_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Menu` ADD CONSTRAINT `Menu_messId_fkey` FOREIGN KEY (`messId`) REFERENCES `Mess`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Menu` ADD CONSTRAINT `Menu_variationId_fkey` FOREIGN KEY (`variationId`) REFERENCES `Variation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_MenuToPlans` ADD CONSTRAINT `_MenuToPlans_A_fkey` FOREIGN KEY (`A`) REFERENCES `Menu`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_MenuToPlans` ADD CONSTRAINT `_MenuToPlans_B_fkey` FOREIGN KEY (`B`) REFERENCES `Plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
