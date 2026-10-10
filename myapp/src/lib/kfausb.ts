/**
 * Kraftfahrer-Ausbildung – gemeinsame Definitionen für Server und Browser.
 *
 * Liegt bewusst NICHT unter $lib/server/: Die Seiten zeigen den Fortschritt
 * im Browser an und brauchen dafür dieselben Einheiten und Regeln wie der
 * Server. So gibt es genau eine Stelle, an der festgelegt ist, was zur
 * Ausbildung gehört.
 */

// ─────────────────────────────────────────────────────────────── Stammdaten

/** Die Fahrzeuge aus dem Ausbildungsnachweis (Seite 3 des Formulars). */
export const FAHRZEUGE = ['1/10-1', '1/91-1', '1/91-2', '1/91-4', '5/91-1'] as const;
export type Fahrzeug = (typeof FAHRZEUGE)[number];

export const KLASSEN = ['B', 'BE', 'C1', 'C1E', 'C', 'CE'] as const;
export type Klasse = (typeof KLASSEN)[number];

export const SAN_STUFEN = ['SAN A', 'SAN B', 'Rettungssanitäter oder höher'] as const;

/** Die Kopien, die laut Formular beizulegen sind. */
export const DOKUMENTE = [
	{ art: 'fuehrerschein', label: 'Führerschein', hinweis: 'Vorder- und Rückseite' },
	{ art: 'bos', label: 'BOS-Sprechfunker', hinweis: 'Nachweis inkl. Digitalfunk' },
	{ art: 'san', label: 'Sanitätsausbildung', hinweis: 'mindestens SAN A' }
] as const;
export type DokumentArt = (typeof DOKUMENTE)[number]['art'];

export const MINDESTALTER = 19;

export function istFahrzeug(wert: string): wert is Fahrzeug {
	return (FAHRZEUGE as readonly string[]).includes(wert);
}
export function istKlasse(wert: string): wert is Klasse {
	return (KLASSEN as readonly string[]).includes(wert);
}

// ─────────────────────────────────────────────────────────────────── Status

export type Status =
	| 'eingereicht' // wartet auf Leiter Einsatz der Ortsgruppe
	| 'og_befuerwortet' // wartet auf Leitung Einsatz im Bezirk
	| 'in_ausbildung' // Ausbilder zeichnen die Einheiten ab
	| 'ausbildung_fertig' // alle Einheiten erbracht, wartet auf Abnahme im Bezirk
	| 'abgeschlossen'
	| 'abgelehnt';

export const STATUS_TEXT: Record<Status, string> = {
	eingereicht: 'Wartet auf Befürwortung der Ortsgruppe',
	og_befuerwortet: 'Wartet auf Genehmigung durch den Bezirk',
	in_ausbildung: 'In Ausbildung',
	ausbildung_fertig: 'Wartet auf Abnahme durch den Bezirk',
	abgeschlossen: 'Abgeschlossen',
	abgelehnt: 'Abgelehnt'
};

/** Wer über den Link in der Mail gerade entscheiden darf. */
export type Pruefstufe = 'og' | 'bezirk' | 'abschluss';

// ───────────────────────────────────────────────────── Ausbildungseinheiten

export type Gruppe = 'einfuehrung' | 'sonderrechte' | 'fahrzeug';

export interface Einheit {
	/** Stabil, wird in der Datenbank gespeichert – nie umbenennen. */
	id: string;
	titel: string;
	details?: string[];
	/** Mindestdauer in Unterrichtseinheiten. Ausbilder dürfen mehr eintragen. */
	ue: number;
	gruppe: Gruppe;
	fahrzeug?: Fahrzeug;
}

const GRUNDEINHEITEN: Einheit[] = [
	{
		id: 'theorie1',
		titel: 'Theorie I',
		details: [
			'Grundlagen der Richtlinie zur Führung von Kraftfahrzeugen in der DLRG',
			'Recht (Führerscheinrecht, §31, §9 StVO, §7, §21 StVG, §15d StVZO)',
			'Fahrzeugpapiere und Fahrtenbuch',
			'Fahrzeugbesatzung',
			'Versicherung'
		],
		ue: 2,
		gruppe: 'einfuehrung'
	},
	{
		id: 'theorie2',
		titel: 'Theorie II',
		details: ['Sicherheitsmaßnahmen', 'Funk (Funkrufnamen, FMS usw.)'],
		ue: 2,
		gruppe: 'einfuehrung'
	},
	{ id: 'sonderrechte', titel: 'Einweisung Fahren mit Sonderrechten', ue: 2, gruppe: 'sonderrechte' }
];

const JE_FAHRZEUG: { schluessel: string; titel: (f: Fahrzeug) => string }[] = [
	{ schluessel: 'kennenlernen', titel: (f) => `Kennenlernen des Fahrzeuges ${f}` },
	{ schluessel: 'solo', titel: (f) => `Fahren mit Fahrzeug ${f} solo` },
	{ schluessel: 'anhaenger', titel: (f) => `Fahren mit Fahrzeug ${f} mit Anhänger` },
	{ schluessel: 'rueckwaerts', titel: (f) => `Rückwärtsfahren mit und ohne Anhänger ${f}` }
];

/**
 * Pflichteinheiten für die beantragten Fahrzeuge: Theorie und Sonderrechte
 * immer, dazu je Fahrzeug Kennenlernen, Solo, mit Anhänger, Rückwärts.
 */
export function pflichtEinheiten(fahrzeuge: readonly string[]): Einheit[] {
	const gewaehlt = FAHRZEUGE.filter((f) => fahrzeuge.includes(f));
	return [
		...GRUNDEINHEITEN,
		...gewaehlt.flatMap((f) =>
			JE_FAHRZEUG.map((e) => ({
				id: `${e.schluessel}:${f}`,
				titel: e.titel(f),
				ue: 1,
				gruppe: 'fahrzeug' as const,
				fahrzeug: f
			}))
		)
	];
}

export interface Nachweis {
	einheitId: string;
	/** JJJJ-MM-TT */
	datum: string;
	ue: number;
	ausbilderId: string;
	ausbilderName: string;
}

export type EinheitMitNachweis = Einheit & { nachweis: Nachweis | null };

export interface Fortschritt {
	einheiten: EinheitMitNachweis[];
	erledigt: number;
	gesamt: number;
	ueSoll: number;
	/** Tatsächlich erbrachte UE – kann über dem Soll liegen. */
	ueIst: number;
	/** Mindest-UE der noch offenen Einheiten. */
	ueOffen: number;
	fertig: boolean;
	/** Die drei Punkte, die im Formular auf Seite 2 abgehakt werden. */
	einfuehrung: boolean;
	sonderrechte: boolean;
	einweisung: Record<string, boolean>;
}

export function fortschritt(fahrzeuge: readonly string[], nachweise: readonly Nachweis[]): Fortschritt {
	const nachId = new Map(nachweise.map((n) => [n.einheitId, n]));
	const einheiten = pflichtEinheiten(fahrzeuge).map((e) => ({ ...e, nachweis: nachId.get(e.id) ?? null }));
	const offen = einheiten.filter((e) => !e.nachweis);
	const erledigtIn = (filter: (e: EinheitMitNachweis) => boolean) =>
		einheiten.filter(filter).every((e) => e.nachweis);

	const einweisung: Record<string, boolean> = {};
	for (const f of FAHRZEUGE) {
		if (fahrzeuge.includes(f)) einweisung[f] = erledigtIn((e) => e.fahrzeug === f);
	}

	return {
		einheiten,
		erledigt: einheiten.length - offen.length,
		gesamt: einheiten.length,
		ueSoll: einheiten.reduce((s, e) => s + e.ue, 0),
		ueIst: einheiten.reduce((s, e) => s + (e.nachweis?.ue ?? 0), 0),
		ueOffen: offen.reduce((s, e) => s + e.ue, 0),
		fertig: offen.length === 0,
		einfuehrung: erledigtIn((e) => e.gruppe === 'einfuehrung'),
		sonderrechte: erledigtIn((e) => e.gruppe === 'sonderrechte'),
		einweisung
	};
}

// ─────────────────────────────────────────────── Prüfpunkte (Formular Seite 2)

/** Vom Bezirk vor Beginn der Ausbildung abzuhaken. Das Alter prüft die Seite selbst. */
export const CHECKLISTE = [
	{ schluessel: 'befuerwortung', text: 'Befürwortung durch LE Bezirk, dass die Einsatzkraft Kraftfahrer wird' },
	{ schluessel: 'geeignet', text: 'Person geeignet' },
	{ schluessel: 'fuehrerschein', text: 'Einsatzkraft hat gültigen Führerschein' },
	{ schluessel: 'km', text: 'Mindestens 10.000 Kilometer Fahrerfahrung' },
	{ schluessel: 'san', text: 'Nachweis gültiger SAN-A' },
	{ schluessel: 'bos', text: 'Nachweis BOS-Sprechfunker inkl. Digitalfunk' }
] as const;
export type Checkliste = Record<(typeof CHECKLISTE)[number]['schluessel'], boolean>;

/** Vom Bezirk beim Abschluss abzuhaken. */
export const ABSCHLUSSPUNKTE = [
	{ schluessel: 'hiorg', text: 'Einsatzkraft als Kraftfahrer und Führerschein im HiOrg hinterlegt' },
	{ schluessel: 'ausgegeben', text: 'Berechtigung schriftlich an Einsatzkraft ausgegeben' },
	{ schluessel: 'abgelegt', text: 'Antrag abgelegt' }
] as const;
export type Abschlusspunkte = Record<(typeof ABSCHLUSSPUNKTE)[number]['schluessel'], boolean>;

// ─────────────────────────────────────────────── Antrag, wie die Seiten ihn sehen

export interface Person {
	name: string;
	vorname: string;
	geburtsdatum: string;
	einsatzgruppe: string;
	strasse: string;
	plzOrt: string;
	telefon: string;
	mobil: string;
	bosAm: string;
	sanAm: string;
	sanStufe: string;
}

export interface AntragAnsicht {
	id: string;
	status: Status;
	eingegangenAm: string;
	person: Person;
	alter: number;
	klassen: { klasse: Klasse; seit: string }[];
	fahrzeuge: Fahrzeug[];
	dokumente: { id: string; art: DokumentArt; name: string; typ: string; groesse: number }[];
	og: { befuerwortet: boolean; am: string; bemerkung: string | null } | null;
	bezirk: {
		genehmigt: boolean;
		am: string;
		bemerkung: string | null;
		checkliste: Checkliste;
		vorlageAm: string | null;
		vorlageBei: string | null;
	} | null;
	abschluss: {
		am: string;
		fahrzeugeErteilt: Fahrzeug[];
		punkte: Abschlusspunkte;
		bemerkung: string | null;
	} | null;
	fortschritt: Fortschritt;
	/** Welche Prüfstufe gerade per Mail-Link entscheiden soll – oder niemand. */
	wartetAuf: Pruefstufe | null;
	/** Ab wann der Antragsteller eine Erinnerung schicken darf (ISO) – null heißt sofort. */
	erinnerungAb: string | null;
	/** Neueste zuerst. */
	verlauf: { am: string; text: string }[];
}

// ──────────────────────────────────────────────────────────────── Datum

/** Heute in deutscher Zeit als JJJJ-MM-TT – auch wenn der Server in UTC läuft. */
export function heuteISO(jetzt = new Date()): string {
	return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(jetzt);
}

export function istDatum(wert: string): boolean {
	return /^\d{4}-\d{2}-\d{2}$/.test(wert) && !Number.isNaN(Date.parse(wert));
}

export function alterAm(geburtsdatum: string, stichtag = heuteISO()): number {
	if (!istDatum(geburtsdatum)) return 0;
	const [gj, gm, gt] = geburtsdatum.split('-').map(Number);
	const [j, m, t] = stichtag.split('-').map(Number);
	return j - gj - (m < gm || (m === gm && t < gt) ? 1 : 0);
}

/** JJJJ-MM-TT oder ISO-Zeitstempel → TT.MM.JJJJ */
export function datumDe(wert: string | null | undefined): string {
	if (!wert) return '–';
	const tag = wert.length === 10 ? `${wert}T12:00:00` : wert;
	return new Date(tag).toLocaleDateString('de-DE', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		timeZone: 'Europe/Berlin'
	});
}
