-- CreateEnum
CREATE TYPE "kontrollpunkt" AS ENUM ('motorenoel', 'kuehlwasser', 'motorvorwaermung', 'motorkontrollanzeige', 'sicherungen', 'gps_radar_echolot', 'stromladekontrolle', 'beleuchtung', 'scheinwerfer', 'blaulicht', 'funkgeraet_2m', 'handfunk_2m', 'funkgeraet_4m', 'intercom', 'feuerloescher');

-- CreateEnum
CREATE TYPE "alarmierungsweg" AS ENUM ('funkmeldeempfaenger', 'funk', 'eigene_beobachtung');

-- CreateEnum
CREATE TYPE "einsatzart" AS ENUM ('rettung_aus_notlagen', 'erste_hilfe_ohne_uebergabe', 'suchaktion_mit_booten', 'bergung', 'schlepphilfe', 'sicherung_veranstaltung', 'erste_hilfe_ohne_notlage');

-- CreateEnum
CREATE TYPE "bootsfunktion" AS ENUM ('BF', 'FU', 'WRH', 'EH');

-- CreateEnum
CREATE TYPE "tageszeit" AS ENUM ('vormittag', 'nachmittag');

-- CreateTable
CREATE TABLE "bootstagebuch" (
    "id" SERIAL NOT NULL,
    "liegeort" TEXT NOT NULL,
    "funkname" TEXT NOT NULL,
    "datum" TIMESTAMP(3) NOT NULL,
    "fahrzeugId" TEXT,
    "kontrolle" "kontrollpunkt"[],
    "schaeden" TEXT,
    "reparaturen" TEXT,
    "maschineAnUhrzeit" TEXT,
    "maschineAnOrt" TEXT,
    "maschineAbUhrzeit" TEXT,
    "maschineAbOrt" TEXT,
    "betriebsstundenEnde" DOUBLE PRECISION,
    "betriebsstundenAnfang" DOUBLE PRECISION,
    "tankBeginn" DOUBLE PRECISION,
    "tankEnde" DOUBLE PRECISION,
    "getanktLiter" DOUBLE PRECISION,
    "getanktBetrag" DECIMAL(8,2),
    "tankort" TEXT,
    "grundDerFahrt" TEXT,
    "bereich" TEXT,
    "alarmierung" "alarmierungsweg"[],
    "patientUebergeben" BOOLEAN NOT NULL DEFAULT false,
    "mitNotarzt" BOOLEAN NOT NULL DEFAULT false,
    "mitReanimation" BOOLEAN NOT NULL DEFAULT false,
    "einsatzarten" "einsatzart"[],
    "einsatzprotokollWeitergeleitet" BOOLEAN,
    "rueckmeldungWeitergeleitet" BOOLEAN,
    "bootsfuehrerName" TEXT,
    "bootssteuererName" TEXT,
    "unterschriebenAm" TIMESTAMP(3),
    "erstelltVonId" TEXT NOT NULL,
    "erstelltVonName" TEXT NOT NULL,
    "angelegtAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "geaendertAm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bootstagebuch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bootstagebuchWetter" (
    "id" SERIAL NOT NULL,
    "tagebuchId" INTEGER NOT NULL,
    "zeitraum" "tageszeit" NOT NULL,
    "windstaerke" TEXT,
    "windrichtung" TEXT,
    "seegang" TEXT,
    "wetter" TEXT,
    "lufttemp" TEXT,
    "wassertemp" TEXT,

    CONSTRAINT "bootstagebuchWetter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bootstagebuchBesatzung" (
    "id" SERIAL NOT NULL,
    "tagebuchId" INTEGER NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "organisation" TEXT,
    "funktion" "bootsfunktion" NOT NULL,
    "von" TEXT,
    "bis" TEXT,
    "dienstzeitStd" DOUBLE PRECISION,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "bootstagebuchBesatzung_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bootstagebuchDienstangabe" (
    "id" SERIAL NOT NULL,
    "tagebuchId" INTEGER NOT NULL,
    "uhrzeit" TEXT,
    "ort" TEXT,
    "anlass" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "bootstagebuchDienstangabe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bootstagebuch_datum_idx" ON "bootstagebuch"("datum");

-- CreateIndex
CREATE INDEX "bootstagebuch_funkname_datum_idx" ON "bootstagebuch"("funkname", "datum");

-- CreateIndex
CREATE UNIQUE INDEX "bootstagebuchWetter_tagebuchId_zeitraum_key" ON "bootstagebuchWetter"("tagebuchId", "zeitraum");

-- CreateIndex
CREATE INDEX "bootstagebuchBesatzung_tagebuchId_position_idx" ON "bootstagebuchBesatzung"("tagebuchId", "position");

-- CreateIndex
CREATE INDEX "bootstagebuchDienstangabe_tagebuchId_position_idx" ON "bootstagebuchDienstangabe"("tagebuchId", "position");

-- AddForeignKey
ALTER TABLE "bootstagebuch" ADD CONSTRAINT "bootstagebuch_fahrzeugId_fkey" FOREIGN KEY ("fahrzeugId") REFERENCES "fahrzeug"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bootstagebuchWetter" ADD CONSTRAINT "bootstagebuchWetter_tagebuchId_fkey" FOREIGN KEY ("tagebuchId") REFERENCES "bootstagebuch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bootstagebuchBesatzung" ADD CONSTRAINT "bootstagebuchBesatzung_tagebuchId_fkey" FOREIGN KEY ("tagebuchId") REFERENCES "bootstagebuch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bootstagebuchDienstangabe" ADD CONSTRAINT "bootstagebuchDienstangabe_tagebuchId_fkey" FOREIGN KEY ("tagebuchId") REFERENCES "bootstagebuch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
