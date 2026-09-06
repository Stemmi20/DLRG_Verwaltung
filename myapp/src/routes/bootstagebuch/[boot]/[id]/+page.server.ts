import { error, fail, redirect } from '@sveltejs/kit';
import type { alarmierungsweg, bootsfunktion, einsatzart, kontrollpunkt } from '@prisma/client';
import {
	betriebsstundenDifferenz,
	blatt,
	blattSpeichern,
	blattUnterschreiben,
	gesamtdienstzeit
} from '$lib/server/bootstagebuch';
import { mitgliederliste } from '$lib/server/fahrtenbuch';
import { ALARMIERUNG, EINSATZARTEN, FUNKTIONEN, KONTROLLPUNKTE_LINKS, KONTROLLPUNKTE_RECHTS } from '$lib/bootstagebuch/felder';
import type { Actions, PageServerLoad } from './$types';

const KONTROLL_IDS = [...KONTROLLPUNKTE_LINKS, ...KONTROLLPUNKTE_RECHTS].map((k) => k.id) as string[];
const ALARM_IDS = ALARMIERUNG.map((a) => a.id) as string[];
const EINSATZ_IDS = EINSATZARTEN.map((e) => e.id) as string[];
const FUNKTION_IDS = FUNKTIONEN.map((f) => f.id) as string[];

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user)
		throw redirect(303, `/login?weiter=/bootstagebuch/${params.boot}/${params.id}`);

	const id = Number(params.id);
	if (!Number.isInteger(id)) throw error(404, 'Blatt nicht gefunden');

	const b = await blatt(id);
	if (!b) throw error(404, 'Blatt nicht gefunden');
	// Verhindert, dass ein Blatt unter dem Pfad eines anderen Boots auftaucht.
	if (b.bootId !== params.boot) throw error(404, 'Blatt nicht gefunden');

	const mitglieder = await mitgliederliste();

	return {
		boot: { id: b.bootId, funkname: b.funkname },
		blatt: {
			...b,
			datum: b.datum.toISOString().slice(0, 10),
			angelegtAm: b.angelegtAm.toISOString(),
			geaendertAm: b.geaendertAm.toISOString(),
			unterschriebenAm: b.unterschriebenAm?.toISOString() ?? null,
			getanktBetrag: b.getanktBetrag ? Number(b.getanktBetrag) : null,
			maschinen: b.maschinen.map((m) => ({
				...m,
				differenz: betriebsstundenDifferenz(m.betriebsstundenAnfang, m.betriebsstundenEnde)
			}))
		},
		gesamtdienstzeit: gesamtdienstzeit(b.besatzung),
		mitgliedernamen: mitglieder.map((m) => m.name)
	};
};

export const actions: Actions = {
	speichern: async ({ request, params, locals }) => {
		if (!locals.user) throw error(401, 'Nicht angemeldet');

		const id = Number(params.id);
		const daten = await request.formData();

		const text = (feld: string) => String(daten.get(feld) ?? '').trim();
		/** Leerer Text bedeutet „nicht ausgefüllt", nicht 0. */
		const optText = (feld: string) => text(feld) || null;
		const zahl = (feld: string) => {
			const roh = text(feld);
			if (roh === '') return null;
			const n = Number(roh.replace(',', '.'));
			return Number.isFinite(n) ? n : null;
		};
		const jaNein = (feld: string) => {
			const roh = text(feld);
			return roh === 'ja' ? true : roh === 'nein' ? false : null;
		};
		const auswahl = (feld: string, erlaubt: string[]) =>
			daten.getAll(feld).map(String).filter((v) => erlaubt.includes(v));

		const liegeort = text('liegeort');
		const funkname = text('funkname');
		const datumRoh = text('datum');

		const felder: Record<string, string> = {};
		if (!liegeort) felder.liegeort = 'Bitte den Liegeort eintragen.';
		if (!funkname) felder.funkname = 'Bitte den Funknamen eintragen.';
		if (!datumRoh) felder.datum = 'Bitte das Datum eintragen.';

		// Maschinen: gleich lange Listen, weil jede Zeile alle Felder rendert.
		const mIds = daten.getAll('maschineId').map(String);
		const mBezeichnung = daten.getAll('maschineBezeichnung').map(String);
		const mAnUhrzeit = daten.getAll('maschineAnUhrzeit').map(String);
		const mAnOrt = daten.getAll('maschineAnOrt').map(String);
		const mAbUhrzeit = daten.getAll('maschineAbUhrzeit').map(String);
		const mAbOrt = daten.getAll('maschineAbOrt').map(String);
		const mAnfang = daten.getAll('maschineAnfang').map(String);
		const mEnde = daten.getAll('maschineEnde').map(String);

		const kommazahl = (roh: string | undefined) => {
			const t = (roh ?? '').trim();
			if (t === '') return null;
			const n = Number(t.replace(',', '.'));
			return Number.isFinite(n) ? n : null;
		};

		const maschinen = mIds.map((maschineId, i) => ({
			maschineId,
			bezeichnung: mBezeichnung[i]?.trim() || 'Maschine',
			anUhrzeit: mAnUhrzeit[i]?.trim() || null,
			anOrt: mAnOrt[i]?.trim() || null,
			abUhrzeit: mAbUhrzeit[i]?.trim() || null,
			abOrt: mAbOrt[i]?.trim() || null,
			betriebsstundenAnfang: kommazahl(mAnfang[i]),
			betriebsstundenEnde: kommazahl(mEnde[i])
		}));

		for (const m of maschinen) {
			const { betriebsstundenAnfang: a, betriebsstundenEnde: e } = m;
			if (a !== null && e !== null && e < a) {
				felder[`maschine_${m.maschineId}`] =
					`${m.bezeichnung}: Der Endstand liegt unter dem Anfangsstand.`;
			}
		}

		// Tankanzeige ist ein Prozentwert.
		const tankBeginn = zahl('tankBeginn');
		const tankEnde = zahl('tankEnde');
		for (const [feld, wert] of [
			['tankBeginn', tankBeginn],
			['tankEnde', tankEnde]
		] as const) {
			if (wert !== null && (wert < 0 || wert > 100)) {
				felder[feld] = 'Bitte einen Wert zwischen 0 und 100 eintragen.';
			}
		}

		// Besatzung: die Spalten kommen als gleich lange Listen an, weil jede
		// Zeile im Formular alle Felder rendert.
		const bNamen = daten.getAll('besatzungName').map(String);
		const bOrg = daten.getAll('besatzungOrganisation').map(String);
		const bFunktion = daten.getAll('besatzungFunktion').map(String);
		const bVon = daten.getAll('besatzungVon').map(String);
		const bBis = daten.getAll('besatzungBis').map(String);
		const bStd = daten.getAll('besatzungStd').map(String);

		const besatzung = bNamen
			.map((name, i) => ({
				name: name.trim(),
				organisation: bOrg[i]?.trim() || null,
				funktion: (FUNKTION_IDS.includes(bFunktion[i]) ? bFunktion[i] : 'WRH') as bootsfunktion,
				von: bVon[i]?.trim() || null,
				bis: bBis[i]?.trim() || null,
				dienstzeitStd: (() => {
					const roh = bStd[i]?.trim() ?? '';
					if (roh === '') return null;
					const n = Number(roh.replace(',', '.'));
					return Number.isFinite(n) ? n : null;
				})()
			}))
			// Leere Zeilen verwerfen – das Formular schickt immer alle mit.
			.filter((b) => b.name !== '');

		const dUhrzeit = daten.getAll('dienstUhrzeit').map(String);
		const dOrt = daten.getAll('dienstOrt').map(String);
		const dAnlass = daten.getAll('dienstAnlass').map(String);

		const dienstangabe = dUhrzeit
			.map((uhrzeit, i) => ({
				uhrzeit: uhrzeit.trim() || null,
				ort: dOrt[i]?.trim() || null,
				anlass: dAnlass[i]?.trim() || null
			}))
			.filter((d) => d.uhrzeit || d.ort || d.anlass);

		if (Object.keys(felder).length > 0) {
			return fail(400, { fehler: 'Bitte prüfe die markierten Felder.', felder });
		}

		await blattSpeichern(id, {
			funkname,
			liegeort,
			datum: new Date(datumRoh),

			kontrolle: auswahl('kontrolle', KONTROLL_IDS) as kontrollpunkt[],
			schaeden: optText('schaeden'),
			reparaturen: optText('reparaturen'),

			tankBeginn,
			tankEnde,
			getanktLiter: zahl('getanktLiter'),
			getanktBetrag: zahl('getanktBetrag'),
			tankort: optText('tankort'),

			grundDerFahrt: optText('grundDerFahrt'),
			bereich: optText('bereich'),

			alarmierung: auswahl('alarmierung', ALARM_IDS) as alarmierungsweg[],
			patientUebergeben: daten.get('patientUebergeben') !== null,
			mitNotarzt: daten.get('mitNotarzt') !== null,
			mitReanimation: daten.get('mitReanimation') !== null,
			einsatzarten: auswahl('einsatzarten', EINSATZ_IDS) as einsatzart[],
			einsatzprotokollWeitergeleitet: jaNein('einsatzprotokollWeitergeleitet'),
			rueckmeldungWeitergeleitet: jaNein('rueckmeldungWeitergeleitet'),

			bootsfuehrerName: optText('bootsfuehrerName'),
			bootssteuererName: optText('bootssteuererName'),

			wetter: (['vormittag', 'nachmittag'] as const).map((zeitraum) => ({
				zeitraum,
				windstaerke: optText(`${zeitraum}_windstaerke`),
				windrichtung: optText(`${zeitraum}_windrichtung`),
				seegang: optText(`${zeitraum}_seegang`),
				wetter: optText(`${zeitraum}_wetter`),
				lufttemp: optText(`${zeitraum}_lufttemp`),
				wassertemp: optText(`${zeitraum}_wassertemp`)
			})),

			maschinen,
			besatzung,
			dienstangabe
		});

		return { erfolg: true };
	},

	unterschreiben: async ({ params, locals }) => {
		if (!locals.user) throw error(401, 'Nicht angemeldet');
		await blattUnterschreiben(Number(params.id));
		return { unterschrieben: true };
	}
};