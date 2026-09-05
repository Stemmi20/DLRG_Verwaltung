import { distanceMeters } from '$lib/fleet/position';
import { SPURLAENGE, type Fahrzeug } from '$lib/types/tracker';
import { prisma } from './prisma';

/**
 * Schreibt die MQTT-Meldungen der Tracker nach Postgres.
 *
 * Der Stammsatz je Tracker wird bei jeder Meldung aktualisiert – das ist eine
 * einzelne Zeile und kostet nichts. Der Verlauf wird dagegen ausgedünnt: ein
 * Fahrzeug steht die meiste Zeit auf dem Hof, und ein GPS-Empfänger im Stand
 * wandert trotzdem ein paar Meter hin und her. Ohne Filter wären das pro
 * Tracker und Tag mehrere zehntausend nutzlose Zeilen.
 */

/** Unter dieser Strecke gilt der Tracker als stehend. */
const MIN_METER = 25;

/** Steht er länger, wird trotzdem ein Punkt geschrieben – als Lebenszeichen. */
const MAX_PAUSE_MS = 5 * 60_000;

export interface Positionsmeldung {
	/** Aus dem Topic: tracker/<id>/position */
	id: string;
	name: string;
	lat: number;
	lng: number;
	speed: number | null;
	course: number | null;
	sats: number | null;
	batt: number | null;
}

/** Was zuletzt tatsächlich in der Verlaufstabelle gelandet ist. */
const zuletztGeschrieben = new Map<string, { lat: number; lng: number; am: number }>();

function lohntSichEinPunkt(meldung: Positionsmeldung): boolean {
	const vorher = zuletztGeschrieben.get(meldung.id);
	if (!vorher) return true;
	if (Date.now() - vorher.am >= MAX_PAUSE_MS) return true;
	return distanceMeters(vorher, { lat: meldung.lat, lng: meldung.lng }) >= MIN_METER;
}

export async function positionSpeichern(meldung: Positionsmeldung): Promise<void> {
	const am = new Date();

	const stamm = {
		name: meldung.name,
		letzteLat: meldung.lat,
		letzteLng: meldung.lng,
		letzteMeldung: am
	};

	await prisma.tracker.upsert({
		where: { id: meldung.id },
		create: { id: meldung.id, ...stamm },
		update: stamm
	});

	if (!lohntSichEinPunkt(meldung)) return;

	await prisma.trackerposition.create({
		data: {
			trackerId: meldung.id,
			name: meldung.name,
			lat: meldung.lat,
			lng: meldung.lng,
			speed: meldung.speed,
			course: meldung.course,
			sats: meldung.sats,
			batt: meldung.batt,
			am
		}
	});

	zuletztGeschrieben.set(meldung.id, { lat: meldung.lat, lng: meldung.lng, am: am.getTime() });
}

/**
 * Der gespeicherte Stand für die Vorbelegung nach einem Neustart – sonst
 * bleibt die Karte leer, bis der erste Tracker wieder sendet.
 */
export async function gespeicherteFahrzeuge(): Promise<Fahrzeug[]> {
	const eintraege = await prisma.tracker.findMany({
		where: { aktiv: true },
		include: { positionen: { orderBy: { am: 'desc' }, take: SPURLAENGE } }
	});

	return eintraege
		.filter((t) => t.positionen.length > 0)
		.map((t) => ({
			id: t.id,
			// Der Stammsatz gewinnt: er trägt den aktuellen Namen, die
			// Positionszeilen den zum Zeitpunkt der Fahrt.
			name: t.name,
			spur: t.positionen.map((p) => ({
				lat: p.lat,
				lng: p.lng,
				am: p.am.toISOString(),
				speed: p.speed,
				course: p.course
			})),
			sats: t.positionen[0]?.sats ?? null,
			batt: t.positionen[0]?.batt ?? null
		}));
}

/**
 * Der Verlauf eines Trackers, älteste zuerst – als Grundlage für eine
 * Streckenanzeige oder einen Export.
 */
export async function verlauf(trackerId: string, von: Date, bis: Date) {
	return prisma.trackerposition.findMany({
		where: { trackerId, am: { gte: von, lte: bis } },
		orderBy: { am: 'asc' }
	});
}