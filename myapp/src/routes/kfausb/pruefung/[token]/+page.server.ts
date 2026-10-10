import { fail } from '@sveltejs/kit';
import {
	abschlussEntscheiden,
	ansicht,
	antragPerToken,
	bezirkEntscheiden,
	ogEntscheiden
} from '$lib/server/kfausb';
import { ABSCHLUSSPUNKTE, CHECKLISTE, istFahrzeug, type Abschlusspunkte, type Checkliste } from '$lib/kfausb';
import type { Actions, PageServerLoad } from './$types';

/*
 * Prüfseite für Ortsgruppe und Bezirk. Erreichbar ohne Anmeldung – der Link
 * aus der Mail ist der Schlüssel. Deshalb muss /kfausb/pruefung in
 * hooks.server.ts unter den öffentlichen Pfaden stehen.
 */

export const load: PageServerLoad = async ({ params, setHeaders }) => {
	// Personendaten: nicht zwischenspeichern, nicht indexieren, den Link nicht als Referrer weitergeben.
	setHeaders({ 'cache-control': 'no-store', 'x-robots-tag': 'noindex', 'referrer-policy': 'no-referrer' });

	const antrag = await antragPerToken(params.token);
	if (!antrag?.pruefung) return { gueltig: false as const };

	return {
		gueltig: true as const,
		stufe: antrag.pruefung.stufe,
		gueltigBis: antrag.pruefung.gueltigBis.toISOString(),
		antrag: ansicht(antrag)
	};
};

function text(form: FormData, feld: string): string | null {
	const wert = form.get(feld);
	return typeof wert === 'string' && wert.trim() ? wert.trim().slice(0, 1000) : null;
}
const ja = (form: FormData, feld: string) => form.get(feld) === 'ja';

export const actions: Actions = {
	entscheiden: async ({ request, params, url }) => {
		const antrag = await antragPerToken(params.token);
		if (!antrag?.pruefung) {
			return fail(410, { fehler: 'Dieser Link ist nicht mehr gültig.' });
		}

		const form = await request.formData();
		const zustimmung = form.get('entscheidung') === 'ja';
		const bemerkung = text(form, 'bemerkung');

		switch (antrag.pruefung.stufe) {
			case 'og': {
				const r = await ogEntscheiden(params.token, zustimmung, bemerkung, url.origin);
				return r.ok
					? { erledigt: zustimmung ? 'Antrag befürwortet. Die Leitung Einsatz im Bezirk wird benachrichtigt.' : 'Antrag abgelehnt.' }
					: fail(400, { fehler: r.fehler });
			}
			case 'bezirk': {
				const checkliste = Object.fromEntries(
					CHECKLISTE.map((p) => [p.schluessel, ja(form, p.schluessel)])
				) as Checkliste;
				const r = await bezirkEntscheiden(params.token, {
					genehmigt: zustimmung,
					checkliste,
					vorlageAm: text(form, 'vorlageAm'),
					vorlageBei: text(form, 'vorlageBei'),
					bemerkung
				});
				return r.ok
					? { erledigt: zustimmung ? 'Ausbildung genehmigt. Die Ausbilder können jetzt Einheiten abzeichnen.' : 'Antrag abgelehnt.' }
					: fail(400, { fehler: r.fehler, checkliste });
			}
			case 'abschluss': {
				const punkte = Object.fromEntries(
					ABSCHLUSSPUNKTE.map((p) => [p.schluessel, ja(form, p.schluessel)])
				) as Abschlusspunkte;
				const r = await abschlussEntscheiden(params.token, {
					bestaetigt: zustimmung,
					fahrzeugeErteilt: form.getAll('fahrzeug').map(String).filter(istFahrzeug),
					punkte,
					bemerkung
				});
				return r.ok
					? { erledigt: zustimmung ? 'Ausbildung abgeschlossen. Die Einsatzkraft ist jetzt als Kraftfahrer eingetragen.' : 'Zurück in die Ausbildung gegeben.' }
					: fail(400, { fehler: r.fehler, punkte });
			}
		}
	}
};
