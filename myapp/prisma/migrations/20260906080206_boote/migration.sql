/*
  Warnings:

  - You are about to drop the column `fahrzeugId` on the `bootstagebuch` table. All the data in the column will be lost.
  - Added the required column `bootId` to the `bootstagebuch` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "bootstagebuch" DROP CONSTRAINT "bootstagebuch_fahrzeugId_fkey";

-- DropIndex
DROP INDEX "bootstagebuch_funkname_datum_idx";

-- AlterTable
ALTER TABLE "bootstagebuch" DROP COLUMN "fahrzeugId",
ADD COLUMN     "bootId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "boot" (
    "id" TEXT NOT NULL,
    "funkname" TEXT NOT NULL,
    "liegeort" TEXT,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "boot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "boot_funkname_key" ON "boot"("funkname");

-- CreateIndex
CREATE INDEX "bootstagebuch_bootId_datum_idx" ON "bootstagebuch"("bootId", "datum");

-- AddForeignKey
ALTER TABLE "bootstagebuch" ADD CONSTRAINT "bootstagebuch_bootId_fkey" FOREIGN KEY ("bootId") REFERENCES "boot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
