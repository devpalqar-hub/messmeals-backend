-- AlterTable websites
ALTER TABLE `websites` 
    ADD COLUMN `provisioningStatus` ENUM('PENDING', 'RESERVED', 'ACTIVE', 'FAILED') NOT NULL DEFAULT 'PENDING',
    ADD COLUMN `subdomainReservedAt` DATETIME(3) NULL;

-- CreateTable custom_domains
CREATE TABLE `custom_domains` (
    `id` VARCHAR(191) NOT NULL,
    `websiteId` VARCHAR(191) NOT NULL,
    `domain` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'VERIFYING', 'VERIFIED', 'SSL_PENDING', 'ACTIVE', 'FAILED', 'DISCONNECTED') NOT NULL DEFAULT 'PENDING',
    `verificationTxt` VARCHAR(191) NULL,
    `verifiedAt` DATETIME(3) NULL,
    `failureReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `custom_domains_domain_key`(`domain`),
    INDEX `custom_domains_websiteId_idx`(`websiteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `custom_domains` ADD CONSTRAINT `custom_domains_websiteId_fkey` FOREIGN KEY (`websiteId`) REFERENCES `websites`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

