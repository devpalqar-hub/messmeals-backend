-- AlterTable
ALTER TABLE `UserSubscriptions` ADD COLUMN `userId` VARCHAR(191) NULL,
    ADD COLUMN `userProfileId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `UserSubscriptions_userProfileId_idx` ON `UserSubscriptions`(`userProfileId`);

-- CreateIndex
CREATE INDEX `UserSubscriptions_userId_idx` ON `UserSubscriptions`(`userId`);
