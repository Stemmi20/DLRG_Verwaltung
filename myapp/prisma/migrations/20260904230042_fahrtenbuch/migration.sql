-- CreateTable
CREATE TABLE "fahrzeug" (
    "id" TEXT NOT NULL,
    "funkrufname" TEXT NOT NULL,
    "sitzplaetze" INTEGER NOT NULL,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "fahrzeug_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fahrt" (
    "id" SERIAL NOT NULL,
    "fahrzeugId" TEXT NOT NULL,
    "datum" TIMESTAMP(3) NOT NULL,
    "fahrtgrund" TEXT NOT NULL,
    "strecke" TEXT[],
    "fahrerId" TEXT NOT NULL,
    "fahrerName" TEXT NOT NULL,
    "kmStart" INTEGER NOT NULL,
    "kmEnde" INTEGER NOT NULL,
    "bemerkung" TEXT,
    "angelegtAm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fahrt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mitfahrer" (
    "id" SERIAL NOT NULL,
    "fahrtId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "mitfahrer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fahrzeug_funkrufname_key" ON "fahrzeug"("funkrufname");

-- CreateIndex
CREATE INDEX "fahrt_fahrzeugId_datum_idx" ON "fahrt"("fahrzeugId", "datum");

-- CreateIndex
CREATE UNIQUE INDEX "mitfahrer_fahrtId_userId_key" ON "mitfahrer"("fahrtId", "userId");

-- AddForeignKey
ALTER TABLE "fahrt" ADD CONSTRAINT "fahrt_fahrzeugId_fkey" FOREIGN KEY ("fahrzeugId") REFERENCES "fahrzeug"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mitfahrer" ADD CONSTRAINT "mitfahrer_fahrtId_fkey" FOREIGN KEY ("fahrtId") REFERENCES "fahrt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
