/*
  Warnings:

  - You are about to drop the column `betriebsstundenAnfang` on the `bootstagebuch` table. All the data in the column will be lost.
  - You are about to drop the column `betriebsstundenEnde` on the `bootstagebuch` table. All the data in the column will be lost.
  - You are about to drop the column `maschineAbOrt` on the `bootstagebuch` table. All the data in the column will be lost.
  - You are about to drop the column `maschineAbUhrzeit` on the `bootstagebuch` table. All the data in the column will be lost.
  - You are about to drop the column `maschineAnOrt` on the `bootstagebuch` table. All the data in the column will be lost.
  - You are about to drop the column `maschineAnUhrzeit` on the `bootstagebuch` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "bootstagebuch" DROP COLUMN "betriebsstundenAnfang",
DROP COLUMN "betriebsstundenEnde",
DROP COLUMN "maschineAbOrt",
DROP COLUMN "maschineAbUhrzeit",
DROP COLUMN "maschineAnOrt",
DROP COLUMN "maschineAnUhrzeit";

-- CreateTable
CREATE TABLE "maschine" (
    "id" TEXT NOT NULL,
    "bootId" TEXT NOT NULL,
    "bezeichnung" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "maschine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bootstagebuchMaschine" (
    "id" SERIAL NOT NULL,
    "tagebuchId" INTEGER NOT NULL,
    "maschineId" TEXT NOT NULL,
    "bezeichnung" TEXT NOT NULL,
    "anUhrzeit" TEXT,
    "anOrt" TEXT,
    "abUhrzeit" TEXT,
    "abOrt" TEXT,
    "betriebsstundenAnfang" DOUBLE PRECISION,
    "betriebsstundenEnde" DOUBLE PRECISION,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "bootstagebuchMaschine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "maschine_bootId_position_idx" ON "maschine"("bootId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "maschine_bootId_bezeichnung_key" ON "maschine"("bootId", "bezeichnung");

-- CreateIndex
CREATE INDEX "bootstagebuchMaschine_tagebuchId_position_idx" ON "bootstagebuchMaschine"("tagebuchId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "bootstagebuchMaschine_tagebuchId_maschineId_key" ON "bootstagebuchMaschine"("tagebuchId", "maschineId");

-- AddForeignKey
ALTER TABLE "maschine" ADD CONSTRAINT "maschine_bootId_fkey" FOREIGN KEY ("bootId") REFERENCES "boot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bootstagebuchMaschine" ADD CONSTRAINT "bootstagebuchMaschine_tagebuchId_fkey" FOREIGN KEY ("tagebuchId") REFERENCES "bootstagebuch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bootstagebuchMaschine" ADD CONSTRAINT "bootstagebuchMaschine_maschineId_fkey" FOREIGN KEY ("maschineId") REFERENCES "maschine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
