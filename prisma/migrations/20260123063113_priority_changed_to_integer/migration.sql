/*
  Warnings:

  - You are about to alter the column `deliveryPriority` on the `UserSubscriptions` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Int`.

*/
-- AlterTable
ALTER TABLE `UserSubscriptions` MODIFY `deliveryPriority` INTEGER NULL;
