/**
 * Legt die vier Fahrzeuge an.
 *   pnpm exec tsx prisma/seed.ts
 *
 * Läuft mehrfach ohne Schaden – vorhandene Einträge werden aktualisiert.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const prisma = new PrismaClient({
	adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
});

const fahrzeuge = [
	{ id: 'adler-3-19-1', funkrufname: 'Adler Bodensee 3/19-1', sitzplaetze: 9 },
	{ id: 'pelikan-3-91-1', funkrufname: 'Pelikan Bodensee 3/91-1', sitzplaetze: 8 },
	{ id: 'pelikan-3-93-1', funkrufname: 'Pelikan Bodensee 3/93-1', sitzplaetze: 5 },
	{ id: 'pelikan-1-11-1', funkrufname: 'Pelikan Bodensee 1/11-1', sitzplaetze: 5 }
];

for (const f of fahrzeuge) {
	await prisma.fahrzeug.upsert({ where: { id: f.id }, update: f, create: f });
	console.log('angelegt:', f.funkrufname);
}

await prisma.$disconnect();