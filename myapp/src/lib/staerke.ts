/**
 * Stärkemeldung – wird von Server und Browser gemeinsam benutzt.
 * Deshalb liegt die Datei NICHT unter $lib/server/: dort darf Client-Code
 * nicht importieren, und die Seite rechnet die Stärke beim Tippen mit.
 */

export type Funktion = 'zugfuehrer' | 'gruppenfuehrer' | 'mannschaft';

export const FUNKTIONEN: { wert: Funktion; label: string; kurz: string }[] = [
	{ wert: 'zugfuehrer', label: 'Zugführer', kurz: 'ZF' },
	{ wert: 'gruppenfuehrer', label: 'Gruppenführer', kurz: 'GF' },
	{ wert: 'mannschaft', label: 'Mannschaft', kurz: 'Ma' }
];

export interface Kraft {
	userId: string;
	name: string;
	funktion: Funktion;
}

export interface Staerke {
	zugfuehrer: number;
	gruppenfuehrer: number;
	mannschaft: number;
	gesamt: number;
	/** Die übliche Schreibweise, z. B. "1/2/9/12". */
	text: string;
}

/** Zählt namentliche Kräfte und Zusatzzahlen zur Stärkemeldung zusammen. */
export function staerkeRechnen(
	kraefte: { funktion: string }[],
	zusatz: { zugfuehrer: number; gruppenfuehrer: number; mannschaft: number }
): Staerke {
	const zaehle = (f: Funktion) => kraefte.filter((k) => k.funktion === f).length;

	const zugfuehrer = zaehle('zugfuehrer') + zusatz.zugfuehrer;
	const gruppenfuehrer = zaehle('gruppenfuehrer') + zusatz.gruppenfuehrer;
	const mannschaft = zaehle('mannschaft') + zusatz.mannschaft;
	const gesamt = zugfuehrer + gruppenfuehrer + mannschaft;

	return {
		zugfuehrer,
		gruppenfuehrer,
		mannschaft,
		gesamt,
		text: `${zugfuehrer}/${gruppenfuehrer}/${mannschaft}/${gesamt}`
	};
}