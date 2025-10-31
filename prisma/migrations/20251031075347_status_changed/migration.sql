/*
  Warnings:

  - The values [PLACED,DISPATCHED,COMPLETED,RETURNED,PACKDAMAGED] on the enum `Deliveries_status` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `Deliveries` MODIFY `status` ENUM('PENDING', 'PROGRESS', 'DELIVERED') NULL;
