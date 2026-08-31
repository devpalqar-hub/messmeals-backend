/*
  Warnings:

  - The values [CANCELLED] on the enum `DeliveryVariation_status` will be added.

*/
-- AlterTable
ALTER TABLE `DeliveryVariation` MODIFY `status` ENUM('PENDING', 'DELIVERED', 'COMPLETED', 'UNDELIVERED', 'CANCELLED') NOT NULL DEFAULT 'PENDING';
