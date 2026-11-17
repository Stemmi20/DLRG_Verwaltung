/**
 * Alle Menüpunkte des Portals – an genau einer Stelle.
 *
 * Die Startseite (Kacheln) und die Navigationsleiste links bauen sich beide
 * hieraus. Neuer Punkt = ein Eintrag hier, dann erscheint er überall.
 * `href: null` heißt „kommt noch": wird angezeigt, ist aber nicht klickbar.
 */

export type Icon =
	| 'karte'
	| 'protokoll'
	| 'personen'
	| 'auto'
	| 'boot'
	| 'ausweis'
	| 'aufgaben'
	| 'kiste'
	| 'zahnrad'
	| 'anker'
	| 'lenkrad';

export interface Menuepunkt {
	titel: string;
	beschreibung: string;
	href: string | null;
	icon: Icon;
	/** Zwei Buchstaben für die eingeklappte Leiste, falls jemand das Icon nicht erkennt. */
	kurz: string;
}

export interface Bereich {
	titel: string;
	farbe: 'rot' | 'blau' | 'gruen';
	punkte: Menuepunkt[];
}

export const MENUE: Bereich[] = [
	{
		titel: 'Einsatz',
		farbe: 'rot',
		punkte: [
			{ titel: 'Flotten Manager', beschreibung: 'Lokalisierung von Einsatzfahrzeugen', href: '/fleetmanager', icon: 'karte', kurz: 'FM' },
			{ titel: 'Einsatzprotokoll', beschreibung: '', href: null, icon: 'protokoll', kurz: 'EP' },
			{ titel: 'Personalstärke', beschreibung: 'Eingabe der Personalstärke', href: '/personalstaerke', icon: 'personen', kurz: 'PS' },
		],
	},
	{
		titel: 'Verwaltung',
		farbe: 'blau',
		punkte: [
			{ titel: 'Fahrtenbuch', beschreibung: 'Verwaltung von Fahrten und Kilometerständen', href: '/fahrtenbuch', icon: 'auto', kurz: 'FB' },
			{ titel: 'Bootstagebuch', beschreibung: 'Verwaltung von Bootsfahrten', href: '/bootstagebuch', icon: 'boot', kurz: 'BT' },
			{ titel: 'Einsatzpersonal', beschreibung: 'Verwaltung von Qualifikationen und Rollen', href: '/boteinsatzgruppe', icon: 'ausweis', kurz: 'EP' },
			{ titel: 'RWS Aufgaben', beschreibung: 'Übersicht von Aufgaben der RWS', href: '/aufgaben', icon: 'aufgaben', kurz: 'RA' },
			{ titel: 'Einsatzmaterial', beschreibung: 'Was ist auf welchem Fahrzeug', href: '/einsatzmaterial', icon: 'kiste', kurz: 'EM' },
			{ titel: 'Verwaltung RWS', beschreibung: '', href: null, icon: 'zahnrad', kurz: 'VR' },
		],
	},
	{
		titel: 'Ausbildung',
		farbe: 'gruen',
		punkte: [
			{ titel: 'Bootsführer Ausbildung', beschreibung: 'Antrag, Ausbildungsnachweis und Abnahme', href: '/bfausb', icon: 'anker', kurz: 'BF' },
			{ titel: 'Kraftfahrer Ausbildung', beschreibung: 'Antrag, Ausbildungsnachweis und Abnahme', href: '/kfausb', icon: 'lenkrad', kurz: 'KF' },
		],
	},
];

/** Ist dieser Punkt (oder eine Unterseite davon) gerade offen? */
export function istAktiv(href: string | null, pfad: string): boolean {
	if (!href) return false;
	return pfad === href || pfad.startsWith(href + '/');
}
