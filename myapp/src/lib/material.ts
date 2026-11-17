/**
 * Einsatzmaterial – gemeinsam für Server und Seite.
 *
 * Jeder Eintrag gehört fest zu einem Standort (meist einem Fahrzeug) und hat
 * eine Anzahl. `bestand` sagt, wie viele davon gerade in welchem Zustand sind;
 * die Summe ist immer die Anzahl. Ein Einzelstück ist einfach Anzahl 1.
 */

/** Wo das Material hingehört. Neuer Standort = eine Zeile ergänzen. */
export const STANDORTE = [
	'3/94-1 Hugo',
	'3/94-2 FP',
	'3/94-3 Brig',
	'3/19-1 MTW',
	'1/11-1 ELW',
	'3/91-1 GW-W',
	'3/93-1 BGF',
	'1/94-1 HWB',
	'Wachstation / Lager',
] as const;

export const ZUSTAENDE = ['BEREIT', 'TROCKEN', 'DEFEKT', 'SONSTIGES'] as const;
export type Zustand = (typeof ZUSTAENDE)[number];

export const ZUSTAND_TEXT: Record<Zustand, string> = {
	BEREIT: 'Einsatzbereit',
	TROCKEN: 'Trockenplatz',
	DEFEKT: 'Beschädigt / Reparatur',
	SONSTIGES: 'Sonstiges',
};

/** Kurzform für die Zählerchips. */
export const ZUSTAND_KURZ: Record<Zustand, string> = {
	BEREIT: 'bereit',
	TROCKEN: 'trocknet',
	DEFEKT: 'defekt',
	SONSTIGES: 'sonstiges',
};

export type Bestand = Record<Zustand, number>;

export const NAME_MAX = 80;
export const NOTIZ_MAX = 300;
export const ANZAHL_MAX = 999;

export interface MaterialAnsicht {
	id: string;
	name: string;
	/** z. B. Inventar- oder Größennummer, nur bei Einzelstücken üblich. */
	nummer: string;
	kategorie: string;
	standort: string;
	anzahl: number;
	bestand: Bestand;
	/** Was mit dem nicht einsatzbereiten Teil ist – leer, wenn alles bereit ist. */
	notiz: string;
	geaendertAm: string;
	/** Neueste zuerst, höchstens 20. */
	verlauf: { am: string; text: string }[];
}

export function nichtBereit(b: Bestand): number {
	return b.TROCKEN + b.DEFEKT + b.SONSTIGES;
}

export function zeitDe(iso: string): string {
	return new Date(iso).toLocaleString('de-DE', {
		timeZone: 'Europe/Berlin',
		day: '2-digit',
		month: '2-digit',
		year: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
	});
}
