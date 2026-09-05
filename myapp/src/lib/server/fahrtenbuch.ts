import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { DATABASE_URL } from '$env/static/private';
import { col } from './database';

/*
 * Vite lädt Servermodule bei jeder Änderung neu – ohne den Umweg über
 * globalThis entstünde im Dev-Betrieb mit jedem Speichern ein neuer Pool.
 */
const G = globalThis as typeof globalThis & { __prisma?: PrismaClient };

export const prisma =
	G.__prisma ??
	new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });

if (import.meta.env.DEV) G.__prisma = prisma;

// ────────────────────────────────────────────────────────────── Fahrzeuge

export async function fahrzeugeMitStand() {
	const fahrzeuge = await prisma.fahrzeug.findMany({
		where: { aktiv: true },
		orderBy: { funkrufname: 'asc' },
		include: {
			// Nur die letzte Fahrt – daraus kommt der aktuelle Kilometerstand.
			fahrten: { orderBy: [{ datum: 'desc' }, { id: 'desc' }], take: 1 }
		}
	});

	return fahrzeuge.map((f) => ({
		id: f.id,
		funkrufname: f.funkrufname,
		sitzplaetze: f.sitzplaetze,
		kmStand: f.fahrten[0]?.kmEnde ?? 0,
		letzteFahrt: f.fahrten[0]?.datum.toISOString() ?? null
	}));
}

export async function fahrzeug(id: string) {
	return prisma.fahrzeug.findUnique({ where: { id } });
}

/** Kilometerstand für die Vorbelegung: das Ende der letzten Fahrt. */
export async function letzterKmStand(fahrzeugId: string): Promise<number> {
	const letzte = await prisma.fahrt.findFirst({
		where: { fahrzeugId },
		orderBy: [{ datum: 'desc' }, { id: 'desc' }],
		select: { kmEnde: true }
	});
	return letzte?.kmEnde ?? 0;
}

// ────────────────────────────────────────────────────────────── Fahrten

export async function fahrten(fahrzeugId: string, anzahl = 50) {
	const eintraege = await prisma.fahrt.findMany({
		where: { fahrzeugId },
		orderBy: [{ datum: 'desc' }, { id: 'desc' }],
		take: anzahl,
		include: { mitfahrer: { orderBy: { name: 'asc' } } }
	});

	return eintraege.map((f) => ({
		id: f.id,
		datum: f.datum.toISOString(),
		fahrtgrund: f.fahrtgrund,
		strecke: f.strecke,
		fahrerName: f.fahrerName,
		kmStart: f.kmStart,
		kmEnde: f.kmEnde,
		kraftstoff: f.kraftstoff,
		// Nicht gespeichert, sondern berechnet – so kann die Differenz
		// nie von den Kilometerständen abweichen.
		gefahren: f.kmEnde - f.kmStart,
		bemerkung: f.bemerkung,
		mitfahrer: f.mitfahrer.map((m) => ({ userId: m.userId, name: m.name }))
	}));
}

export interface FahrtEingabe {
	fahrzeugId: string;
	datum: Date;
	fahrtgrund: string;
	strecke: string[];
	fahrerId: string;
	fahrerName: string;
	kmStart: number;
	kmEnde: number;
	kraftstoff: number;
	bemerkung: string | null;
	mitfahrer: { userId: string; name: string }[];
}

export async function fahrtAnlegen(eingabe: FahrtEingabe) {
	const { mitfahrer, ...fahrt } = eingabe;
	return prisma.fahrt.create({
		data: { ...fahrt, mitfahrer: { create: mitfahrer } }
	});
}

export async function fahrtLoeschen(id: number) {
	// Mitfahrer gehen über onDelete: Cascade automatisch mit.
	await prisma.fahrt.delete({ where: { id } });
}

// ────────────────────────────────────────────────────── Mitglieder (Mongo)

/**
 * Die Mitglieder kommen weiter aus der MongoDB – die Postgres-Datenbank
 * speichert nur die ID und den Namen zum Zeitpunkt der Fahrt.
 */
export async function mitgliederliste() {
	const users = await col.users();
	const alle = await users
		.find(
			{ status: 'AKTIV' },
			{ projection: { vorname: 1, nachname: 1 }, sort: { nachname: 1 } }
		)
		.toArray();

	return alle
		.map((u) => ({
			id: u._id.toHexString(),
			name: `${u.vorname ?? ''} ${u.nachname ?? ''}`.trim()
		}))
		.filter((m) => m.name.length > 0);
}