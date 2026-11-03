-- CreateTable
CREATE TABLE `business_locations` (
    `id` VARCHAR(191) NOT NULL,
    `messId` VARCHAR(191) NOT NULL,
    `country` ENUM('IN', 'AE', 'QA') NOT NULL,
    `currency` VARCHAR(191) NOT NULL,
    `timezone` VARCHAR(191) NOT NULL,
    `building` TEXT NULL,
    `area` VARCHAR(191) NULL,
    `city` VARCHAR(191) NOT NULL,
    `state` VARCHAR(191) NOT NULL,
    `postalCode` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `business_locations_messId_key`(`messId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `business_brandings` (
    `id` VARCHAR(191) NOT NULL,
    `messId` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NULL,
    `theme` ENUM('DEFAULT', 'WARM', 'COOL', 'EARTHY', 'VIBRANT', 'MINIMAL', 'CUSTOM') NOT NULL DEFAULT 'DEFAULT',
    `primaryColor` VARCHAR(191) NULL,
    `secondaryColor` VARCHAR(191) NULL,
    `logoUrl` TEXT NULL,
    `logoKey` VARCHAR(191) NULL,
    `coverUrl` TEXT NULL,
    `coverKey` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `business_brandings_messId_key`(`messId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `branding_gallery` (
    `id` VARCHAR(191) NOT NULL,
    `brandingId` VARCHAR(191) NOT NULL,
    `url` TEXT NOT NULL,
    `s3Key` VARCHAR(191) NULL,
    `altText` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `branding_gallery_brandingId_idx`(`brandingId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `website_offer_configs` (
    `id` VARCHAR(191) NOT NULL,
    `maxClaims` INTEGER NOT NULL DEFAULT 200,
    `originalPrice` DECIMAL(65, 30) NOT NULL DEFAULT 9999.00,
    `promoPrice` DECIMAL(65, 30) NOT NULL DEFAULT 0.00,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `totalClaimed` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `website_offer_claims` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `messId` VARCHAR(191) NOT NULL,
    `configId` VARCHAR(191) NOT NULL,
    `status` ENUM('CLAIMED', 'DISMISSED') NOT NULL,
    `claimedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `website_offer_claims_messId_key`(`messId`),
    INDEX `website_offer_claims_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `otp_sessions` (
    `id` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `countryCode` VARCHAR(191) NOT NULL DEFAULT 'IN',
    `sessionId` VARCHAR(191) NULL,
    `otp` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `verified` BOOLEAN NOT NULL DEFAULT false,
    `lastSentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `otp_sessions_phone_idx`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `onboarding_sessions` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `messId` VARCHAR(191) NULL,
    `currentStage` ENUM('PHONE_VERIFICATION', 'BUSINESS_DETAILS', 'LOCATION', 'WEBSITE_OFFER', 'BRANDING', 'WEBSITE_IMAGES', 'MENU_DETAILS', 'MENU_DAYS', 'DAILY_DISHES', 'PLAN_DETAILS', 'PRICING', 'AVAILABILITY', 'PLAN_CREATED', 'WEBSITE_GENERATION', 'WEBSITE_READY', 'COMPLETED') NOT NULL DEFAULT 'PHONE_VERIFICATION',
    `status` ENUM('IN_PROGRESS', 'COMPLETED', 'ABANDONED') NOT NULL DEFAULT 'IN_PROGRESS',
    `completedStages` JSON NOT NULL,
    `metadata` JSON NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `onboarding_sessions_messId_key`(`messId`),
    INDEX `onboarding_sessions_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `onboarding_events` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `stage` ENUM('PHONE_VERIFICATION', 'BUSINESS_DETAILS', 'LOCATION', 'WEBSITE_OFFER', 'BRANDING', 'WEBSITE_IMAGES', 'MENU_DETAILS', 'MENU_DAYS', 'DAILY_DISHES', 'PLAN_DETAILS', 'PRICING', 'AVAILABILITY', 'PLAN_CREATED', 'WEBSITE_GENERATION', 'WEBSITE_READY', 'COMPLETED') NOT NULL,
    `eventType` VARCHAR(191) NOT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `onboarding_events_sessionId_idx`(`sessionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `plan_pricings` (
    `id` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NOT NULL,
    `billingPeriod` ENUM('MONTHLY', 'DAILY') NOT NULL DEFAULT 'MONTHLY',
    `regularPrice` DECIMAL(65, 30) NOT NULL DEFAULT 0.00,
    `discountEnabled` BOOLEAN NOT NULL DEFAULT false,
    `discountedPrice` DECIMAL(65, 30) NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
    `savings` DECIMAL(65, 30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `plan_pricings_planId_key`(`planId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `websites` (
    `id` VARCHAR(191) NOT NULL,
    `messId` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `websiteUrl` TEXT NULL,
    `status` ENUM('DRAFT', 'GENERATING', 'GENERATED', 'PUBLISHING', 'PUBLISHED', 'FAILED') NOT NULL DEFAULT 'DRAFT',
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `websites_messId_key`(`messId`),
    UNIQUE INDEX `websites_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `website_generation_jobs` (
    `id` VARCHAR(191) NOT NULL,
    `websiteId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'GENERATING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `attempt` INTEGER NOT NULL DEFAULT 1,
    `errorMessage` TEXT NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `website_generation_jobs_websiteId_idx`(`websiteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `business_locations` ADD CONSTRAINT `business_locations_messId_fkey` FOREIGN KEY (`messId`) REFERENCES `Mess`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `business_brandings` ADD CONSTRAINT `business_brandings_messId_fkey` FOREIGN KEY (`messId`) REFERENCES `Mess`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `branding_gallery` ADD CONSTRAINT `branding_gallery_brandingId_fkey` FOREIGN KEY (`brandingId`) REFERENCES `business_brandings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `website_offer_claims` ADD CONSTRAINT `website_offer_claims_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `website_offer_claims` ADD CONSTRAINT `website_offer_claims_messId_fkey` FOREIGN KEY (`messId`) REFERENCES `Mess`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `website_offer_claims` ADD CONSTRAINT `website_offer_claims_configId_fkey` FOREIGN KEY (`configId`) REFERENCES `website_offer_configs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `onboarding_sessions` ADD CONSTRAINT `onboarding_sessions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `onboarding_sessions` ADD CONSTRAINT `onboarding_sessions_messId_fkey` FOREIGN KEY (`messId`) REFERENCES `Mess`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `onboarding_events` ADD CONSTRAINT `onboarding_events_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `onboarding_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `plan_pricings` ADD CONSTRAINT `plan_pricings_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `Plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `websites` ADD CONSTRAINT `websites_messId_fkey` FOREIGN KEY (`messId`) REFERENCES `Mess`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `website_generation_jobs` ADD CONSTRAINT `website_generation_jobs_websiteId_fkey` FOREIGN KEY (`websiteId`) REFERENCES `websites`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
