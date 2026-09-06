import type {
	alarmierungsweg,
	bootsfunktion,
	einsatzart,
	kontrollpunkt,
	tageszeit
} from '@prisma/client';
import { prisma } from './prisma';

// ────────────────────────────────────────────────────────────── Boote

export async function boote() {
	const alle = await prisma.boot.findMany({
		where: { aktiv: true },
		orderBy: { funkname: 'asc' },
		include: {
			maschinen: { where: { aktiv: true }, orderBy: { position: 'asc' } },
			// Nur das letzte Blatt – daraus kommt das Datum des letzten Dienstes.
			tagebuecher: {
				orderBy: [{ datum: 'desc' }, { id: 'desc' }],
				take: 1,
				select: { datum: true }
			},
			_count: { select: { tagebuecher: true } }
		}
	});

	// Betriebsstände je Maschine, nicht je Boot.
	const staende = await Promise.all(
		alle.flatMap((b) => b.maschinen.map((m) => letzterBetriebsstand(m.id)))
	);
	const nachMaschine = new Map<string, number | null>();
	let i = 0;
	for (const b of alle) for (const m of b.maschinen) nachMaschine.set(m.id, staende[i++]);

	return alle.map((b) => ({
		id: b.id,
		funkname: b.funkname,
		liegeort: b.liegeort,
		blaetter: b._count.tagebuecher,
		letzterDienst: b.tagebuecher[0]?.datum.toISOString() ?? null,
		maschinen: b.maschinen.map((m) => ({
			id: m.id,
			bezeichnung: m.bezeichnung,
			betriebsstunden: nachMaschine.get(m.id) ?? null
		}))
	}));
}

export async function boot(id: string) {
	return prisma.boot.findUnique({
		where: { id },
		include: { maschinen: { where: { aktiv: true }, orderBy: { position: 'asc' } } }
	});
}

/**
 * Der letzte Endstand einer Maschine – Vorbelegung für den Anfangsstand
 * im nächsten Blatt.
 */
export async function letzterBetriebsstand(maschineId: string): Promise<number | null> {
	const letzte = await prisma.bootstagebuchMaschine.findFirst({
		where: { maschineId, betriebsstundenEnde: { not: null } },
		orderBy: [{ tagebuch: { datum: 'desc' } }, { id: 'desc' }],
		select: { betriebsstundenEnde: true }
	});
	return letzte?.betriebsstundenEnde ?? null;
}

// ────────────────────────────────────────────────────────────── Übersicht

export async function blaetter(bootId: string, anzahl = 100) {
	const eintraege = await prisma.bootstagebuch.findMany({
		where: { bootId },
		orderBy: [{ datum: 'desc' }, { id: 'desc' }],
		take: anzahl,
		include: { besatzung: { select: { id: true } } }
	});

	return eintraege.map((b) => ({
		id: b.id,
		datum: b.datum.toISOString(),
		funkname: b.funkname,
		liegeort: b.liegeort,
		grundDerFahrt: b.grundDerFahrt,
		bootsfuehrerName: b.bootsfuehrerName,
		besatzungAnzahl: b.besatzung.length,
		unterschrieben: b.unterschriebenAm !== null
	}));
}

// ────────────────────────────────────────────────────────────── Einzelblatt

export async function blatt(id: number) {
	return prisma.bootstagebuch.findUnique({
		where: { id },
		include: {
			maschinen: { orderBy: { position: 'asc' } },
			wetter: true,
			besatzung: { orderBy: { position: 'asc' } },
			dienstangabe: { orderBy: { position: 'asc' } }
		}
	});
}

export type Blatt = NonNullable<Awaited<ReturnType<typeof blatt>>>;

export async function blattAnlegen(eingabe: {
	bootId: string;
	funkname: string;
	liegeort: string;
	datum: Date;
	erstelltVonId: string;
	erstelltVonName: string;
	/// Eine Zeile je Maschine, mit dem letzten Endstand als Anfangsstand.
	maschinen: {
		maschineId: string;
		bezeichnung: string;
		betriebsstundenAnfang: number | null;
		position: number;
	}[];
}) {
	const { maschinen, ...kopf } = eingabe;
	return prisma.bootstagebuch.create({
		data: { ...kopf, maschinen: { create: maschinen } }
	});
}

export interface BlattEingabe {
	funkname: string;
	liegeort: string;
	datum: Date;

	kontrolle: kontrollpunkt[];
	schaeden: string | null;
	reparaturen: string | null;

	tankBeginn: number | null;
	tankEnde: number | null;
	getanktLiter: number | null;
	getanktBetrag: number | null;
	tankort: string | null;

	grundDerFahrt: string | null;
	bereich: string | null;

	alarmierung: alarmierungsweg[];
	patientUebergeben: boolean;
	mitNotarzt: boolean;
	mitReanimation: boolean;
	einsatzarten: einsatzart[];
	einsatzprotokollWeitergeleitet: boolean | null;
	rueckmeldungWeitergeleitet: boolean | null;

	bootsfuehrerName: string | null;
	bootssteuererName: string | null;

	maschinen: {
		maschineId: string;
		bezeichnung: string;
		anUhrzeit: string | null;
		anOrt: string | null;
		abUhrzeit: string | null;
		abOrt: string | null;
		betriebsstundenAnfang: number | null;
		betriebsstundenEnde: number | null;
	}[];

	wetter: {
		zeitraum: tageszeit;
		windstaerke: string | null;
		windrichtung: string | null;
		seegang: string | null;
		wetter: string | null;
		lufttemp: string | null;
		wassertemp: string | null;
	}[];

	besatzung: {
		name: string;
		organisation: string | null;
		funktion: bootsfunktion;
		von: string | null;
		bis: string | null;
		dienstzeitStd: number | null;
	}[];

	dienstangabe: {
		uhrzeit: string | null;
		ort: string | null;
		anlass: string | null;
	}[];
}

/**
 * Speichert ein Blatt komplett. Die abhängigen Zeilen werden ersetzt statt
 * einzeln abgeglichen – das Formular schickt ohnehin immer den vollständigen
 * Stand, und in einer Transaktion kann dabei nichts halb ankommen.
 */
export async function blattSpeichern(id: number, eingabe: BlattEingabe) {
	const { maschinen, wetter, besatzung, dienstangabe, ...kopf } = eingabe;

	return prisma.$transaction([
		prisma.bootstagebuchMaschine.deleteMany({ where: { tagebuchId: id } }),
		prisma.bootstagebuchWetter.deleteMany({ where: { tagebuchId: id } }),
		prisma.bootstagebuchBesatzung.deleteMany({ where: { tagebuchId: id } }),
		prisma.bootstagebuchDienstangabe.deleteMany({ where: { tagebuchId: id } }),
		prisma.bootstagebuch.update({
			where: { id },
			data: {
				...kopf,
				maschinen: {
					create: maschinen.map((m, position) => ({ ...m, position }))
				},
				wetter: { create: wetter },
				besatzung: {
					create: besatzung.map((b, position) => ({ ...b, position }))
				},
				dienstangabe: {
					create: dienstangabe.map((d, position) => ({ ...d, position }))
				}
			}
		})
	]);
}

/** Setzt den Zeitstempel der Unterschriften. */
export async function blattUnterschreiben(id: number) {
	return prisma.bootstagebuch.update({
		where: { id },
		data: { unterschriebenAm: new Date() }
	});
}

export async function blattLoeschen(id: number) {
	// Wetter, Besatzung und Dienstangaben gehen über onDelete: Cascade mit.
	await prisma.bootstagebuch.delete({ where: { id } });
}

// ────────────────────────────────────────────────────────────── Berechnet

/** Differenz der Betriebsstunden – nie gespeichert, immer gerechnet. */
export function betriebsstundenDifferenz(anfang: number | null, ende: number | null) {
	if (anfang === null || ende === null) return null;
	const differenz = ende - anfang;
	return differenz >= 0 ? Math.round(differenz * 10) / 10 : null;
}

/** Gesamtdienstzeit aus den Einzelzeiten der Besatzung. */
export function gesamtdienstzeit(besatzung: { dienstzeitStd: number | null }[]) {
	const summe = besatzung.reduce((s, b) => s + (b.dienstzeitStd ?? 0), 0);
	return Math.round(summe * 100) / 100;
}