/*
  Warnings:

  - Added the required column `end_date` to the `CustomerProfile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `start_date` to the `CustomerProfile` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `CustomerProfile` ADD COLUMN `end_date` DATETIME(3) NOT NULL,
    ADD COLUMN `start_date` DATETIME(3) NOT NULL;
