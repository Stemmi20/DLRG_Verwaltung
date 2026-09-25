import { error, fail, redirect } from '@sveltejs/kit';
import {
	meldungen,
	meldungAnlegen,
	meldungLoeschen,
	mitgliederliste
} from '$lib/server/personalstaerke';
import { FUNKTIONEN, type Funktion, type Kraft } from '$lib/staerke';
import type { Actions, PageServerLoad } from './$types';

const ERLAUBT = FUNKTIONEN.map((f) => f.wert) as string[];

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/login?weiter=/personalstaerke');

	const [liste, mitglieder] = await Promise.all([meldungen(), mitgliederliste()]);

	return {
		meldungen: liste,
		mitglieder,
		melder: {
			id: locals.user.id,
			name: `${locals.user.vorname} ${locals.user.nachname}`.trim()
		}
	};
};

export const actions: Actions = {
	anlegen: async ({ request, locals }) => {
		if (!locals.user) throw error(401, 'Nicht angemeldet');

		const daten = await request.formData();
		const wert = (feld: string) => String(daten.get(feld) ?? '').trim();
		const zahl = (feld: string) => {
			const n = Number(wert(feld) || 0);
			return Number.isInteger(n) && n >= 0 ? n : -1;
		};

		const werte: Record<string, string> = {};
		for (const feld of [
			'einsatzZeit',
			'stichwort',
			'einsatzort',
			'zusatzFuehrer',
			'zusatzUnterfuehrer',
			'zusatzMannschaft',
			'bemerkung'
		]) {
			werte[feld] = wert(feld);
		}

		/*
		 * Das Formular schickt je gewählter Person ein Feld "kraft" mit
		 * "<userId>:<funktion>". So bleiben Person und Funktion zusammen,
		 * ohne dass zwei Listen abgeglichen werden müssen.
		 */
		const roh = daten.getAll('kraft').map(String);
		const mitglieder = await mitgliederliste();
		const nachId = new Map(mitglieder.map((m) => [m.id, m.name]));

		const kraefte: Kraft[] = [];
		const gesehen = new Set<string>();
		for (const eintrag of roh) {
			const [userId, funktion] = eintrag.split(':');
			if (!userId || !ERLAUBT.includes(funktion)) continue;
			if (!nachId.has(userId) || gesehen.has(userId)) continue;
			gesehen.add(userId);
			kraefte.push({ userId, name: nachId.get(userId)!, funktion: funktion as Funktion });
		}

		const felder: Record<string, string> = {};

		if (!wert('einsatzZeit')) {
			felder.einsatzZeit = 'Bitte Datum und Uhrzeit des Einsatzes eintragen.';
		} else if (new Date(wert('einsatzZeit')).getTime() > Date.now() + 60_000) {
			felder.einsatzZeit = 'Der Zeitpunkt liegt in der Zukunft.';
		}

		const zusatzFuehrer = zahl('zusatzFuehrer');
		const zusatzUnterfuehrer = zahl('zusatzUnterfuehrer');
		const zusatzMannschaft = zahl('zusatzMannschaft');

		for (const [feld, n] of [
			['zusatzFuehrer', zusatzFuehrer],
			['zusatzUnterfuehrer', zusatzUnterfuehrer],
			['zusatzMannschaft', zusatzMannschaft]
		] as const) {
			if (n < 0) felder[feld] = 'Bitte eine Zahl ab 0 eintragen.';
		}

		const gesamt =
			kraefte.length +
			Math.max(0, zusatzFuehrer) +
			Math.max(0, zusatzUnterfuehrer) +
			Math.max(0, zusatzMannschaft);

		if (gesamt === 0) {
			felder.kraefte = 'Bitte mindestens eine Einsatzkraft erfassen.';
		}

		if (Object.keys(felder).length > 0) {
			return fail(400, {
				fehler: 'Bitte prüfe die markierten Felder.',
				felder,
				werte,
				kraefte
			});
		}

		await meldungAnlegen({
			einsatzZeit: new Date(wert('einsatzZeit')),
			stichwort: wert('stichwort') || null,
			einsatzort: wert('einsatzort') || null,
			zusatzFuehrer,
			zusatzUnterfuehrer,
			zusatzMannschaft,
			gemeldetVonId: locals.user.id,
			gemeldetVonName: `${locals.user.vorname} ${locals.user.nachname}`.trim(),
			bemerkung: wert('bemerkung') || null,
			kraefte
		});

		return { erfolg: true };
	},

	loeschen: async ({ request, locals }) => {
		if (!locals.user?.istAdmin) throw error(403, 'Nur Administratoren dürfen Meldungen löschen');
		const daten = await request.formData();
		await meldungLoeschen(Number(daten.get('id')));
		return { geloescht: true };
	}
};