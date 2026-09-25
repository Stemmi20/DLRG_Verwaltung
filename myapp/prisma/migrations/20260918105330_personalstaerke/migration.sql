/*
  Warnings:

  - You are about to drop the column `zusatzFuehrer` on the `personalstaerke` table. All the data in the column will be lost.
  - You are about to drop the column `zusatzMannschaft` on the `personalstaerke` table. All the data in the column will be lost.
  - You are about to drop the column `zusatzUnterfuehrer` on the `personalstaerke` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "personalstaerke" DROP COLUMN "zusatzFuehrer",
DROP COLUMN "zusatzMannschaft",
DROP COLUMN "zusatzUnterfuehrer",
ADD COLUMN     "GruppenFuehrer" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "mannschaft" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "zugFuehrer" INTEGER NOT NULL DEFAULT 0;
