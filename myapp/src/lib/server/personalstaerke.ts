import { prisma, mitgliederliste } from './fahrtenbuch';
import { staerkeRechnen, type Funktion, type Kraft, type Staerke } from '$lib/staerke';

/*
 * Der Prisma-Client und die Mitgliederliste kommen aus fahrtenbuch.ts –
 * so gibt es nur einen Verbindungspool und eine Stelle, die MongoDB kennt.
 */

/*
 * Ältere Meldungen speichern die Funktionen noch als "fuehrer"/"unterfuehrer".
 * Beim Lesen werden sie auf die neuen Namen abgebildet, die Datenbank bleibt unverändert.
 */
const ALT_ZU_NEU: Record<string, Funktion> = {
	fuehrer: 'zugfuehrer',
	unterfuehrer: 'gruppenfuehrer'
};
const neueFunktion = (f: string): Funktion => ALT_ZU_NEU[f] ?? (f as Funktion);

export interface MeldungAnzeige {
	id: number;
	einsatzZeit: string;
	stichwort: string | null;
	einsatzort: string | null;
	gemeldetVonName: string;
	bemerkung: string | null;
	kraefte: Kraft[];
	zusatz: { zugfuehrer: number; gruppenfuehrer: number; mannschaft: number };
	staerke: Staerke;
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
			funktion: neueFunktion(k.funktion)
		}));
		const zusatz = {
			zugfuehrer: m.zugFuehrer ?? 0,
			gruppenfuehrer: m.GruppenFuehrer ?? 0,
			mannschaft: m.mannschaft ?? 0
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

export { mitgliederliste };
export type { Funktion, Kraft, Staerke };