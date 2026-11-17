/**
 * RWS-Aufgaben – gemeinsam für Server und Seite.
 *
 * Die Status-Werte schreibt auch der Telegram-Bot, deshalb genau so wie dort
 * in Großbuchstaben.
 */
export const STATUS = ['OPEN', 'TAKEN', 'PENDING', 'DONE'] as const;
export type AufgabeStatus = (typeof STATUS)[number];

export const STATUS_TEXT: Record<AufgabeStatus, string> = {
	OPEN: 'Offen',
	PENDING: 'Zurückgegeben',
	TAKEN: 'In Bearbeitung',
	DONE: 'Erledigt',
};

/** Aufgaben in diesem Status kann sich jemand nehmen. */
export const FREI: readonly AufgabeStatus[] = ['OPEN', 'PENDING'];

/** Filter oben auf der Seite, steht in der URL als ?filter=… */
export const FILTER = {
	offen: { text: 'Offen', status: ['OPEN', 'PENDING'] },
	bearbeitung: { text: 'In Bearbeitung', status: ['TAKEN'] },
	erledigt: { text: 'Erledigt', status: ['DONE'] },
	alle: { text: 'Alle', status: [...STATUS] },
} as const satisfies Record<string, { text: string; status: readonly AufgabeStatus[] }>;
export type FilterName = keyof typeof FILTER;

/**
 * Wofür die Aufgabe ist – Pflichtauswahl beim Anlegen.
 * Neuer Eintrag = eine Zeile ergänzen. Gespeichert wird der Text so, wie er
 * hier steht, im Feld `bereich`.
 */
export const BEREICHE = [
	'3/94-1 Hugo',
	'3/94-2 FP',
	'3/94-3 Brig',
	'3/19-1 MTW',
	'1/11-1 ELW',
	'3/91-1 GW-W',
	'3/93-1 BGF',
	'1/94-1 HWB',
	'SR / Neopren Material',
	'Wachstation (Lampen, Türen, etc.)',
	'Sonstiges',
] as const;

export const KURZ_MAX = 120;
export const LANG_MAX = 4000;

/** So bekommt die Seite eine Aufgabe – ohne Telegram-Interna. */
export interface AufgabeAnsicht {
	aufgabenID: number;
	kurz: string;
	lang: string;
	/** Fehlt bei Aufgaben, die der Bot ohne Bereich angelegt hat. */
	bereich: string | null;
	status: AufgabeStatus;
	/** Vor- und Nachname, falls jemand sie übernommen hat. */
	bearbeiter: string | null;
	/** Habe ich sie übernommen? */
	meine: boolean;
	erstelltAm: string;
	/** Neueste zuerst. */
	verlauf: { am: string; text: string }[];
}

export interface Statistik {
	offen: number;
	/** Teil von `offen`: wurden schon einmal abgegeben. */
	zurueckgegeben: number;
	bearbeitung: number;
	erledigt: number;
	/** Davon in Bearbeitung bei mir. */
	meine: number;
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
