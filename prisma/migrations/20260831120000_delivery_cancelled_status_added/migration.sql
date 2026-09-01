/*
  Warnings:

  - The values [CANCELLED] on the enum `Deliveries_status` will be added.

*/
-- AlterTable
ALTER TABLE `Deliveries` MODIFY `status` ENUM('PENDING', 'DELIVERED', 'COMPLETED', 'UNDELIVERED', 'CANCELLED') NULL;
