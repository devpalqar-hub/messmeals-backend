/*
  Splits customer (role='USER') accounts out of `User` into a new dedicated `Customer`
  identity table. `CustomerProfile.userId` is repointed to `Customer` instead of `User`.

  Row `id`s are preserved on copy, so no FK value remapping is needed — only the FK's
  target table changes.

  IMPORTANT — run this against a staging copy first, and take a full backup before
  running it against production. Step 5 (deleting the migrated rows out of `User`) is
  destructive and only safe to run after steps 1-4 have been verified to have completed
  successfully (in particular: confirm `SELECT COUNT(*) FROM Customer` matches
  `SELECT COUNT(*) FROM User WHERE role = 'USER'` taken before this migration ran).
*/

-- 1) CreateTable — structural twin of the `User` columns relevant to a customer account.
CREATE TABLE `Customer` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `otp` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NULL,
    `is_verified` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `password` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Customer_phone_key`(`phone`),
    UNIQUE INDEX `Customer_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2) Copy existing customer rows across, preserving `id` (and therefore every existing
--    `CustomerProfile.userId` value continues to be valid once the FK below is repointed).
INSERT INTO `Customer` (`id`, `name`, `phone`, `email`, `otp`, `expiresAt`, `is_verified`, `is_active`, `password`, `createdAt`, `updatedAt`)
SELECT `id`, `name`, `phone`, `email`, `otp`, `expiresAt`, `is_verified`, `is_active`, `password`, `createdAt`, `updatedAt`
FROM `User`
WHERE `role` = 'USER';

-- 3) Repoint `CustomerProfile.userId` from `User` to `Customer`.
ALTER TABLE `CustomerProfile` DROP FOREIGN KEY `CustomerProfile_userId_fkey`;

ALTER TABLE `CustomerProfile` ADD CONSTRAINT `CustomerProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- 4) (Verification checkpoint — run manually before step 5)
--    SELECT COUNT(*) FROM `Customer`;
--    SELECT COUNT(*) FROM `User` WHERE `role` = 'USER';
--    These two counts must match before proceeding.

-- 5) Remove the now-migrated rows from `User`. Safe only now that step 3 has moved the
--    FK off of `User` — deleting these rows earlier would have cascaded through the
--    entire customer data graph (subscriptions, deliveries, wallet, addresses,
--    testimonials).
DELETE FROM `User` WHERE `role` = 'USER';
