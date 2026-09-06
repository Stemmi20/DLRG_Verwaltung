/**
 * Legt die Fahrzeuge und die Boote an.
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

const boote = [
	{
		id: 'pelikan-3-94-1',
		funkname: 'Pelikan Bodensee 3/94-1',
		liegeort: null,
		maschinen: ['Hauptmaschine']
	},
	{
		id: 'pelikan-3-94-2',
		funkname: 'Pelikan Bodensee 3/94-2',
		liegeort: null,
		// Zwei Motoren mit getrennten Betriebsstunden.
		maschinen: ['Backbord', 'Steuerbord']
	},
	{
		id: 'pelikan-3-94-3',
		funkname: 'Pelikan Bodensee 3/94-3',
		liegeort: null,
		maschinen: ['Hauptmaschine']
	},
	{
		id: 'pelikan-bw-1-94-1',
		funkname: 'Pelikan Baden-Württemberg 1/94-1',
		liegeort: null,
		maschinen: ['Hauptmaschine']
	}
];

/** "Backbord" → "backbord", damit daraus eine brauchbare id wird. */
function slug(text: string): string {
	return text
		.toLowerCase()
		.replaceAll('ä', 'ae')
		.replaceAll('ö', 'oe')
		.replaceAll('ü', 'ue')
		.replaceAll('ß', 'ss')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

for (const f of fahrzeuge) {
	await prisma.fahrzeug.upsert({ where: { id: f.id }, update: f, create: f });
	console.log('Fahrzeug:', f.funkrufname);
}

for (const { maschinen, ...b } of boote) {
	// liegeort nicht mit update überschreiben – der wird in der App gepflegt.
	await prisma.boot.upsert({
		where: { id: b.id },
		update: { funkname: b.funkname },
		create: b
	});

	for (const [position, bezeichnung] of maschinen.entries()) {
		const id = `${b.id}-${slug(bezeichnung)}`;
		await prisma.maschine.upsert({
			where: { id },
			update: { bezeichnung, position },
			create: { id, bootId: b.id, bezeichnung, position }
		});
	}

	console.log('Boot:', b.funkname, '·', maschinen.join(', '));
}

await prisma.$disconnect();