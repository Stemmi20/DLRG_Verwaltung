import { prisma, mitgliederliste, type Mitglied } from './fahrtenbuch';
import { staerkeRechnen, type Funktion, type Kraft, type Staerke } from '$lib/staerke';

/*
 * Der Prisma-Client und die Mitgliederliste kommen aus fahrtenbuch.ts –
 * so gibt es nur einen Verbindungspool und eine Stelle, die MongoDB kennt.
 */

export interface MeldungAnzeige {
	id: number;
	einsatzZeit: string;
	stichwort: string | null;
	einsatzort: string | null;
	gemeldetVonName: string;
	bemerkung: string | null;
	kraefte: Kraft[];
	zusatz: { fuehrer: number; unterfuehrer: number; mannschaft: number };
	staerke: Staerke;
}

/** Zählt namentliche Kräfte und Zusatzzahlen zur Stärkemeldung zusammen. */
export function staerkeRechnen(
	kraefte: { funktion: string }[],
	zusatz: { fuehrer: number; unterfuehrer: number; mannschaft: number }
): Staerke {
	const zaehle = (f: Funktion) => kraefte.filter((k) => k.funktion === f).length;

	const fuehrer = zaehle('fuehrer') + zusatz.fuehrer;
	const unterfuehrer = zaehle('unterfuehrer') + zusatz.unterfuehrer;
	const mannschaft = zaehle('mannschaft') + zusatz.mannschaft;
	const gesamt = fuehrer + unterfuehrer + mannschaft;

	return {
		fuehrer,
		unterfuehrer,
		mannschaft,
		gesamt,
		text: `${fuehrer}/${unterfuehrer}/${mannschaft}/${gesamt}`
	};
}

export async function meldungen(anzahl = 40): Promise<MeldungAnzeige[]> {
	const eintraege = await prisma.personalstaerke.findMany({
		orderBy: [{ einsatzZeit: 'desc' }, { id: 'desc' }],
		take: anzahl,
		include: { kraefte: { orderBy: { name: 'asc' } } }
	});

	return eintraege.map((m): MeldungAnzeige => {
		const kraefte: Kraft[] = m.kraefte.map((k) => ({
			userId: k.userId,
			name: k.name,
			funktion: k.funktion as Funktion
		}));
		const zusatz = {
			fuehrer: m.zusatzFuehrer,
			unterfuehrer: m.zusatzUnterfuehrer,
			mannschaft: m.zusatzMannschaft
		};

		return {
			id: m.id,
			einsatzZeit: m.einsatzZeit.toISOString(),
			stichwort: m.stichwort,
			einsatzort: m.einsatzort,
			gemeldetVonName: m.gemeldetVonName,
			bemerkung: m.bemerkung,
			kraefte,
			zusatz,
			staerke: staerkeRechnen(kraefte, zusatz)
		};
	});
}

export interface MeldungEingabe {
	einsatzZeit: Date;
	stichwort: string | null;
	einsatzort: string | null;
	zusatzFuehrer: number;
	zusatzUnterfuehrer: number;
	zusatzMannschaft: number;
	gemeldetVonId: string;
	gemeldetVonName: string;
	bemerkung: string | null;
	kraefte: Kraft[];
}

export async function meldungAnlegen(eingabe: MeldungEingabe) {
	const { kraefte, ...meldung } = eingabe;
	return prisma.personalstaerke.create({
		data: { ...meldung, kraefte: { create: kraefte } }
	});
}

export async function meldungLoeschen(id: number): Promise<void> {
	// Kräfte gehen über onDelete: Cascade automatisch mit.
	await prisma.personalstaerke.delete({ where: { id } });
}

export { mitgliederliste, type Mitglied };
export type { Funktion, Kraft, Staerke };