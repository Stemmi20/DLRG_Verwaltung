import { fail, redirect } from '@sveltejs/kit';
import {
	aktuellerAntrag,
	ansicht,
	antragAnlegen,
	erinnern,
	hatFunktion,
	mitgliedLaden,
	offeneAusbildungen,
	type Datei
} from '$lib/server/bfausb';
import {
	DOKUMENTE,
	DRSA_STUFEN,
	SAN_STUFEN,
	heuteISO,
	istDatum,
	istBoot,
	istSchein,
	type Person
} from '$lib/bfausb';
import type { Actions, PageServerLoad } from './$types';

type Modus = 'formular' | 'status' | 'abgeschlossen';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(303, '/login?weiter=/bfausb');

	const [mitglied, antrag] = await Promise.all([
		mitgliedLaden(locals.user.id),
		aktuellerAntrag(locals.user.id)
	]);

	const istAusbilder = hatFunktion(mitglied, 'bfausbilder');
	const abgeschlossen = hatFunktion(mitglied, 'bf') || antrag?.status === 'abgeschlossen';
	const laeuft = !abgeschlossen && antrag !== null && antrag.status !== 'abgelehnt';
	const modus: Modus = abgeschlossen ? 'abgeschlossen' : laeuft ? 'status' : 'formular';

	return {
		modus,
		antrag: antrag ? ansicht(antrag) : null,
		vorlage: vorlageAus(mitglied, locals.user),
		istAusbilder,
		ausbildungen: istAusbilder ? await offeneAusbildungen(locals.user.id) : []
	};
};

/**
 * Füllt das Formular mit dem vor, was schon in der Mitgliederverwaltung steht.
 * Die Feldnamen sind über die Jahre gewachsen, deshalb je Feld mehrere Schreibweisen.
 */
function vorlageAus(
	mitglied: Record<string, unknown> | null,
	user: { vorname: string; nachname: string; ortsgruppe: string }
): Person {
	const text = (...schluessel: string[]) => {
		for (const s of schluessel) {
			const wert = mitglied?.[s];
			if (typeof wert === 'string' && wert.trim()) return wert.trim();
			if (typeof wert === 'number') return String(wert);
		}
		return '';
	};
	const datum = (...schluessel: string[]) => {
		for (const s of schluessel) {
			const wert = mitglied?.[s];
			if (wert instanceof Date) return heuteISO(wert);
			if (typeof wert === 'string' && istDatum(wert.slice(0, 10))) return wert.slice(0, 10);
			if (typeof wert === 'string' && /^\d{2}\.\d{2}\.\d{4}$/.test(wert)) {
				const [t, m, j] = wert.split('.');
				return `${j}-${m}-${t}`;
			}
		}
		return '';
	};

	return {
		name: user.nachname || text('nachname', 'name', 'lastname'),
		vorname: user.vorname || text('vorname', 'firstname'),
		geburtsdatum: datum('geburtsdatum', 'geburtstag', 'birthday'),
		einsatzgruppe: text('einsatzgruppe') || user.ortsgruppe,
		strasse: text('strasse', 'straße', 'adresse', 'street'),
		plzOrt: [text('plz', 'PLZ'), text('ort', 'wohnort', 'Ort')].filter(Boolean).join(' '),
		telefon: text('telefon', 'festnetz', 'phone'),
		mobil: text('mobil', 'handy', 'mobile'),
		bosAm: '',
		sanAm: '',
		sanStufe: 'SAN A',
		drsaStufe: 'DRSA Silber',
		drsaAm: ''
	};
}

// ─────────────────────────────────────────────────────────── Dateiprüfung

const MAX_JE_DATEI = 5 * 1024 * 1024;
const MAX_GESAMT = 20 * 1024 * 1024;
const MAX_DATEIEN_JE_ART = 3;

/**
 * Am Dateiinhalt erkennen, was es ist – die Angabe des Browsers lässt sich
 * fälschen. Die Prüfer öffnen diese Dateien später im Browser.
 */
function dateityp(daten: Buffer): string | null {
	if (daten.subarray(0, 4).toString('latin1') === '%PDF') return 'application/pdf';
	if (daten[0] === 0x89 && daten.subarray(1, 4).toString('latin1') === 'PNG') return 'image/png';
	if (daten[0] === 0xff && daten[1] === 0xd8 && daten[2] === 0xff) return 'image/jpeg';
	return null;
}

// ──────────────────────────────────────────────────────────────── Actions

const TEXTFELDER = [
	'name',
	'vorname',
	'geburtsdatum',
	'einsatzgruppe',
	'strasse',
	'plzOrt',
	'telefon',
	'mobil',
	'bosAm',
	'sanAm',
	'sanStufe',
	'drsaStufe',
	'drsaAm'
] as const;

export const actions: Actions = {
	beantragen: async ({ request, locals, url }) => {
		if (!locals.user) redirect(303, '/login?weiter=/bfausb');

		const [mitglied, laufend] = await Promise.all([
			mitgliedLaden(locals.user.id),
			aktuellerAntrag(locals.user.id)
		]);
		if (hatFunktion(mitglied, 'bf')) return fail(409, { fehler: 'Du bist bereits Bootsführer.' });
		if (laufend && laufend.status !== 'abgelehnt') {
			return fail(409, { fehler: 'Du hast bereits einen laufenden Antrag.' });
		}

		const form = await request.formData();
		const text = (feld: string) => {
			const wert = form.get(feld);
			return typeof wert === 'string' ? wert.trim() : '';
		};

		const werte: Record<string, string> = {};
		for (const feld of TEXTFELDER) werte[feld] = text(feld);

		const boote = form.getAll('boot').map(String).filter(istBoot);
		const scheine = form
			.getAll('schein')
			.map(String)
			.filter(istSchein)
			.map((schein) => ({ schein, seit: text(`seit_${schein}`) }));
		for (const k of scheine) werte[`seit_${k.schein}`] = k.seit;
		const bestaetigt = text('bestaetigung') === 'ja';

		const heute = heuteISO();
		const felder: Record<string, string> = {};
		const pflicht: [string, string][] = [
			['name', 'Bitte den Nachnamen eintragen.'],
			['vorname', 'Bitte den Vornamen eintragen.'],
			['einsatzgruppe', 'Bitte die Einsatzgruppe eintragen.'],
			['strasse', 'Bitte Straße und Hausnummer eintragen.'],
			['plzOrt', 'Bitte PLZ und Ort eintragen.'],
			['mobil', 'Bitte eine Handynummer eintragen.']
		];
		for (const [feld, meldung] of pflicht) if (!werte[feld]) felder[feld] = meldung;

		const datumFeld = (feld: string, bezeichnung: string) => {
			if (!istDatum(werte[feld])) felder[feld] = `Bitte ${bezeichnung} eintragen.`;
			else if (werte[feld] > heute) felder[feld] = 'Das Datum liegt in der Zukunft.';
		};
		datumFeld('geburtsdatum', 'das Geburtsdatum');
		datumFeld('bosAm', 'das Datum des BOS-Sprechfunkerlehrgangs');
		datumFeld('sanAm', 'das Datum der Sanitätsausbildung');
		if (!(SAN_STUFEN as readonly string[]).includes(werte.sanStufe)) {
			felder.sanStufe = 'Bitte die Stufe der Sanitätsausbildung wählen.';
		}
		datumFeld('drsaAm', 'das Datum des Rettungsschwimmabzeichens');
		if (!(DRSA_STUFEN as readonly string[]).includes(werte.drsaStufe)) {
			felder.drsaStufe = 'Bitte das Rettungsschwimmabzeichen wählen.';
		}

		if (boote.length === 0) felder.boote = 'Bitte mindestens ein Boot auswählen.';
		if (scheine.length === 0) felder.scheine = 'Bitte mindestens einen Bootsführerschein angeben.';
		for (const k of scheine) {
			if (!istDatum(k.seit)) felder[`seit_${k.schein}`] = 'Seit wann? Bitte Datum eintragen.';
			else if (k.seit > heute) felder[`seit_${k.schein}`] = 'Das Datum liegt in der Zukunft.';
		}
		if (!bestaetigt) felder.bestaetigung = 'Ohne diese Bestätigung kann der Antrag nicht gestellt werden.';

		// Dokumente
		const dateien: Datei[] = [];
		let gesamt = 0;
		for (const d of DOKUMENTE) {
			const liste = form
				.getAll(`dok_${d.art}`)
				.filter((f): f is File => f instanceof File && f.size > 0);
			if (liste.length === 0) {
				felder[`dok_${d.art}`] = `Bitte eine Kopie hochladen (${d.hinweis}).`;
				continue;
			}
			if (liste.length > MAX_DATEIEN_JE_ART) {
				felder[`dok_${d.art}`] = `Höchstens ${MAX_DATEIEN_JE_ART} Dateien.`;
				continue;
			}
			for (const f of liste) {
				gesamt += f.size;
				if (f.size > MAX_JE_DATEI) {
					felder[`dok_${d.art}`] = `„${f.name}" ist größer als 5 MB.`;
					break;
				}
				const daten = Buffer.from(await f.arrayBuffer());
				const typ = dateityp(daten);
				if (!typ) {
					felder[`dok_${d.art}`] = `„${f.name}" ist kein JPG, PNG oder PDF.`;
					break;
				}
				dateien.push({ art: d.art, name: f.name.slice(0, 120), typ, daten });
			}
		}
		if (gesamt > MAX_GESAMT) felder.dokumente = 'Alle Dateien zusammen dürfen höchstens 20 MB groß sein.';

		if (Object.keys(felder).length > 0) {
			return fail(400, {
				fehler: 'Bitte prüfe die markierten Felder. Hochgeladene Dateien müssen neu ausgewählt werden.',
				felder,
				werte,
				boote: boote as string[],
				scheine: scheine.map((k) => k.schein as string),
				bestaetigt
			});
		}

		const person: Person = {
			name: werte.name,
			vorname: werte.vorname,
			geburtsdatum: werte.geburtsdatum,
			einsatzgruppe: werte.einsatzgruppe,
			strasse: werte.strasse,
			plzOrt: werte.plzOrt,
			telefon: werte.telefon,
			mobil: werte.mobil,
			bosAm: werte.bosAm,
			sanAm: werte.sanAm,
			sanStufe: werte.sanStufe,
			drsaStufe: werte.drsaStufe,
			drsaAm: werte.drsaAm
		};

		try {
			const { mailOk } = await antragAnlegen(
				{ userId: locals.user.id, person, scheine, boote },
				dateien,
				url.origin
			);
			return { eingereicht: true, mailOk };
		} catch (e) {
			console.error('[bfausb] Antrag konnte nicht gespeichert werden', e);
			return fail(500, {
				fehler: 'Der Antrag konnte nicht gespeichert werden. Bitte später noch einmal versuchen.',
				werte,
				boote: boote as string[],
				scheine: scheine.map((k) => k.schein as string),
				bestaetigt
			});
		}
	},

	erinnern: async ({ locals, url }) => {
		if (!locals.user) redirect(303, '/login?weiter=/bfausb');
		const r = await erinnern(locals.user.id, url.origin);
		return r.ok ? { erinnert: true } : fail(400, { fehler: r.fehler });
	}
};
