/*
  Warnings:

  - Added the required column `name` to the `trackerposition` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "trackerposition" ADD COLUMN     "name" TEXT NOT NULL;
