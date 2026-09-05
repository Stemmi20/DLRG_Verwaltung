-- AlterTable
ALTER TABLE "fahrt" ALTER COLUMN "kraftstoff" DROP DEFAULT;

-- CreateTable
CREATE TABLE "tracker" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "fahrzeugId" TEXT,
    "letzteLat" DOUBLE PRECISION,
    "letzteLng" DOUBLE PRECISION,
    "letzteMeldung" TIMESTAMP(3),

    CONSTRAINT "tracker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trackerposition" (
    "id" SERIAL NOT NULL,
    "trackerId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "speed" DOUBLE PRECISION,
    "course" DOUBLE PRECISION,
    "sats" INTEGER,
    "batt" DOUBLE PRECISION,
    "am" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trackerposition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trackerposition_trackerId_am_idx" ON "trackerposition"("trackerId", "am");

-- AddForeignKey
ALTER TABLE "tracker" ADD CONSTRAINT "tracker_fahrzeugId_fkey" FOREIGN KEY ("fahrzeugId") REFERENCES "fahrzeug"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trackerposition" ADD CONSTRAINT "trackerposition_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "tracker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
