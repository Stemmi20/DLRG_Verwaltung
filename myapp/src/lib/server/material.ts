import { ObjectId } from 'mongodb';
import { db } from './database';
import {
	ANZAHL_MAX,
	NAME_MAX,
	NOTIZ_MAX,
	STANDORTE,
	ZUSTAENDE,
	ZUSTAND_TEXT,
	nichtBereit,
	type Bestand,
	type MaterialAnsicht,
	type Zustand,
} from '$lib/material';

/**
 * Einsatzmaterial in MongoDB, Collection „Material" in der Datenbank aus
 * MONGODB_URI (dieselbe wie die RWS-Aufgaben). Die Collection legt MongoDB
 * beim ersten Eintrag selbst an.
 */
export interface MaterialDoc {
	_id?: ObjectId;
	ortsgruppe: string;
	name: string;
	nummer: string;
	kategorie: string;
	standort: string;
	anzahl: number;
	bestand: Bestand;
	notiz: string;
	geaendertAm: Date;
	verlauf: { am: Date; text: string }[];
}

const material = db.collection<MaterialDoc>('Material');

export interface Handelnder {
	name: string;
	ortsgruppe: string;
	istAdmin: boolean;
}

export type Ergebnis = { ok: true } | { ok: false; fehler: string };

/** Verlauf wächst nicht endlos – die letzten 50 Einträge reichen. */
function verlauf(text: string) {
	return { verlauf: { $each: [{ am: new Date(), text }], $slice: -50 } };
}

function istZustand(z: string): z is Zustand {
	return (ZUSTAENDE as readonly string[]).includes(z);
}

function leererBestand(anzahl: number): Bestand {
	return { BEREIT: anzahl, TROCKEN: 0, DEFEKT: 0, SONSTIGES: 0 };
}

function idOderNull(id: string): ObjectId | null {
	return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

// ------------------------------------------------------------------ Lesen

export async function liste(ich: Handelnder): Promise<MaterialAnsicht[]> {
	const docs = await material.find({ ortsgruppe: ich.ortsgruppe }).limit(2000).toArray();
	const reihenfolge = (s: string) => {
		const i = (STANDORTE as readonly string[]).indexOf(s);
		return i === -1 ? STANDORTE.length : i;
	};
	return docs
		.map((d) => {
			// Fehlende Zähler (z. B. von Hand angelegt) als 0 lesen.
			const bestand = leererBestand(0);
			for (const z of ZUSTAENDE) bestand[z] = Math.max(0, Number(d.bestand?.[z]) || 0);
			return {
				id: d._id!.toString(),
				name: d.name ?? '',
				nummer: d.nummer ?? '',
				kategorie: d.kategorie ?? '',
				standort: d.standort ?? '',
				anzahl: Number(d.anzahl) || 0,
				bestand,
				notiz: d.notiz ?? '',
				geaendertAm: (d.geaendertAm ?? new Date(0)).toISOString(),
				verlauf: (d.verlauf ?? [])
					.slice(-20)
					.reverse()
					.map((v) => ({ am: new Date(v.am).toISOString(), text: v.text })),
			};
		})
		.sort(
			(a, b) =>
				reihenfolge(a.standort) - reihenfolge(b.standort) ||
				a.standort.localeCompare(b.standort, 'de') ||
				a.kategorie.localeCompare(b.kategorie, 'de') ||
				a.name.localeCompare(b.name, 'de') ||
				a.nummer.localeCompare(b.nummer, 'de', { numeric: true }),
		);
}

export async function kategorien(ich: Handelnder): Promise<string[]> {
	const k = await material.distinct('kategorie', { ortsgruppe: ich.ortsgruppe });
	return k.filter((x): x is string => typeof x === 'string' && x.trim() !== '').sort((a, b) => a.localeCompare(b, 'de'));
}

// ----------------------------------------------------- Stammdaten (Admins)

export interface Stammdaten {
	name: string;
	nummer: string;
	kategorie: string;
	standort: string;
	anzahl: number;
}

function pruefen(d: Stammdaten): string | null {
	if (!d.name) return 'Bitte eine Bezeichnung angeben.';
	if (d.name.length > NAME_MAX) return `Die Bezeichnung darf höchstens ${NAME_MAX} Zeichen haben.`;
	if (d.nummer.length > 30 || d.kategorie.length > 40) return 'Nummer oder Kategorie ist zu lang.';
	if (!(STANDORTE as readonly string[]).includes(d.standort)) return 'Bitte einen Standort auswählen.';
	if (!Number.isInteger(d.anzahl) || d.anzahl < 1 || d.anzahl > ANZAHL_MAX) {
		return `Die Anzahl muss zwischen 1 und ${ANZAHL_MAX} liegen.`;
	}
	return null;
}

export async function anlegen(ich: Handelnder, d: Stammdaten): Promise<Ergebnis> {
	if (!ich.istAdmin) return { ok: false, fehler: 'Material anlegen dürfen nur Admins.' };
	if (!ich.ortsgruppe) return { ok: false, fehler: 'Deinem Konto ist keine Ortsgruppe zugeordnet.' };
	const fehler = pruefen(d);
	if (fehler) return { ok: false, fehler };

	await material.insertOne({
		ortsgruppe: ich.ortsgruppe,
		...d,
		bestand: leererBestand(d.anzahl),
		notiz: '',
		geaendertAm: new Date(),
		verlauf: [{ am: new Date(), text: `${ich.name} hat das Material angelegt (${d.anzahl}× auf ${d.standort})` }],
	});
	return { ok: true };
}

/**
 * Bezeichnung, Standort oder Anzahl ändern. Die Anzahl darf nicht kleiner
 * werden als das, was gerade trocknet/defekt/unterwegs ist – der Rest zählt
 * als einsatzbereit. `stand` ist geaendertAm beim Laden der Seite: hat
 * inzwischen jemand anderes etwas geändert, wird abgebrochen statt überschrieben.
 */
export async function bearbeiten(ich: Handelnder, id: string, d: Stammdaten, stand: string): Promise<Ergebnis> {
	if (!ich.istAdmin) return { ok: false, fehler: 'Material bearbeiten dürfen nur Admins.' };
	const _id = idOderNull(id);
	if (!_id) return { ok: false, fehler: 'Unbekanntes Material.' };
	const fehler = pruefen(d);
	if (fehler) return { ok: false, fehler };

	const alt = await material.findOne({ _id, ortsgruppe: ich.ortsgruppe });
	if (!alt) return { ok: false, fehler: 'Das Material gibt es nicht mehr.' };
	if (alt.geaendertAm.toISOString() !== stand) {
		return { ok: false, fehler: 'Inzwischen hat jemand anderes etwas geändert – bitte neu laden.' };
	}
	const weg = nichtBereit({ ...leererBestand(0), ...alt.bestand });
	if (d.anzahl < weg) {
		return { ok: false, fehler: `Gerade sind ${weg} Stück nicht einsatzbereit – die Anzahl kann nicht kleiner sein.` };
	}

	const aenderungen = [
		alt.name !== d.name && `Bezeichnung „${alt.name}" → „${d.name}"`,
		alt.nummer !== d.nummer && `Nummer „${alt.nummer || '–'}" → „${d.nummer || '–'}"`,
		alt.kategorie !== d.kategorie && `Kategorie „${alt.kategorie || '–'}" → „${d.kategorie || '–'}"`,
		alt.standort !== d.standort && `Standort ${alt.standort} → ${d.standort}`,
		alt.anzahl !== d.anzahl && `Anzahl ${alt.anzahl} → ${d.anzahl}`,
	].filter(Boolean);
	if (!aenderungen.length) return { ok: true };

	const r = await material.updateOne(
		{ _id, ortsgruppe: ich.ortsgruppe, geaendertAm: alt.geaendertAm },
		{
			$set: { ...d, 'bestand.BEREIT': d.anzahl - weg, geaendertAm: new Date() },
			$push: verlauf(`${ich.name}: ${aenderungen.join(', ')}`),
		},
	);
	return r.matchedCount
		? { ok: true }
		: { ok: false, fehler: 'Inzwischen hat jemand anderes etwas geändert – bitte neu laden.' };
}

export async function loeschen(ich: Handelnder, id: string): Promise<Ergebnis> {
	if (!ich.istAdmin) return { ok: false, fehler: 'Material löschen dürfen nur Admins.' };
	const _id = idOderNull(id);
	if (!_id) return { ok: false, fehler: 'Unbekanntes Material.' };
	await material.deleteOne({ _id, ortsgruppe: ich.ortsgruppe });
	return { ok: true };
}

// ------------------------------------------------ Zustand (alle Angemeldeten)

/**
 * `anzahl` Stück von einem Zustand in einen anderen setzen, z. B. 2 Westen
 * von „Einsatzbereit" auf „Trockenplatz". Die Bedingung „so viele sind
 * überhaupt da" steckt im Filter – zwei gleichzeitige Klicks können den
 * Bestand also nicht ins Minus treiben.
 */
export async function zustandSetzen(
	ich: Handelnder,
	id: string,
	von: string,
	nach: string,
	anzahl: number,
	notiz: string,
): Promise<Ergebnis> {
	const _id = idOderNull(id);
	if (!_id) return { ok: false, fehler: 'Unbekanntes Material.' };
	if (!istZustand(von) || !istZustand(nach)) return { ok: false, fehler: 'Unbekannter Zustand.' };
	if (von === nach) return { ok: false, fehler: 'Bitte einen anderen Zustand wählen.' };
	if (!Number.isInteger(anzahl) || anzahl < 1) return { ok: false, fehler: 'Bitte eine Anzahl angeben.' };
	notiz = notiz.trim().slice(0, NOTIZ_MAX);
	if ((nach === 'DEFEKT' || nach === 'SONSTIGES') && !notiz) {
		return { ok: false, fehler: `Bitte kurz notieren, was los ist (${ZUSTAND_TEXT[nach]}).` };
	}

	const r = await material.updateOne(
		{ _id, ortsgruppe: ich.ortsgruppe, [`bestand.${von}`]: { $gte: anzahl } },
		{
			$inc: { [`bestand.${von}`]: -anzahl, [`bestand.${nach}`]: anzahl },
			$set: { geaendertAm: new Date(), ...(notiz && nach !== 'BEREIT' ? { notiz } : {}) },
			$push: verlauf(
				`${ich.name}: ${anzahl}× ${ZUSTAND_TEXT[von]} → ${ZUSTAND_TEXT[nach]}${notiz ? ` („${notiz}")` : ''}`,
			),
		},
	);
	if (!r.matchedCount) {
		return { ok: false, fehler: `So viele sind gerade nicht „${ZUSTAND_TEXT[von]}" – bitte neu laden.` };
	}

	// Ist alles wieder einsatzbereit, hat sich die Notiz erledigt.
	await material.updateOne(
		{ _id, 'bestand.TROCKEN': 0, 'bestand.DEFEKT': 0, 'bestand.SONSTIGES': 0 },
		{ $set: { notiz: '' } },
	);
	return { ok: true };
}
