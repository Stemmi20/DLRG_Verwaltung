-- CreateTable
CREATE TABLE "personalstaerke" (
    "id" SERIAL NOT NULL,
    "einsatzZeit" TIMESTAMP(3) NOT NULL,
    "stichwort" TEXT,
    "einsatzort" TEXT,
    "zusatzFuehrer" INTEGER NOT NULL DEFAULT 0,
    "zusatzUnterfuehrer" INTEGER NOT NULL DEFAULT 0,
    "zusatzMannschaft" INTEGER NOT NULL DEFAULT 0,
    "gemeldetVonId" TEXT NOT NULL,
    "gemeldetVonName" TEXT NOT NULL,
    "bemerkung" TEXT,
    "angelegtAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personalstaerke_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "einsatzkraft" (
    "id" SERIAL NOT NULL,
    "meldungId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "funktion" TEXT NOT NULL,

    CONSTRAINT "einsatzkraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "personalstaerke_einsatzZeit_idx" ON "personalstaerke"("einsatzZeit");

-- CreateIndex
CREATE UNIQUE INDEX "einsatzkraft_meldungId_userId_key" ON "einsatzkraft"("meldungId", "userId");

-- AddForeignKey
ALTER TABLE "einsatzkraft" ADD CONSTRAINT "einsatzkraft_meldungId_fkey" FOREIGN KEY ("meldungId") REFERENCES "personalstaerke"("id") ON DELETE CASCADE ON UPDATE CASCADE;
