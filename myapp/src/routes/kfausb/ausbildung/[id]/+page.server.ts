import { error, fail, redirect } from '@sveltejs/kit';
import {
	abnahmeAnstossen,
	ansicht,
	antragPerId,
	hatFunktion,
	mitgliedLaden,
	nachweisEintragen,
	nachweisEntfernen
} from '$lib/server/kfausb';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

/** Nur wer in der Mitgliederverwaltung als Kraftfahrer-Ausbilder geführt ist. */
async function ausbilder(event: RequestEvent | Parameters<PageServerLoad>[0]) {
	const user = event.locals.user;
	if (!user) redirect(303, `/login?weiter=${encodeURIComponent(event.url.pathname)}`);
	if (!hatFunktion(await mitgliedLaden(user.id), 'kfausbilder')) {
		error(403, 'Diese Seite ist nur für Kraftfahrer-Ausbilder.');
	}
	return { id: user.id, name: `${user.vorname} ${user.nachname}`.trim() };
}

export const load: PageServerLoad = async (event) => {
	const ich = await ausbilder(event);
	const antrag = await antragPerId(event.params.id);
	if (!antrag || !['in_ausbildung', 'ausbildung_fertig', 'abgeschlossen'].includes(antrag.status)) {
		error(404, 'Diese Ausbildung gibt es nicht oder sie hat noch nicht begonnen.');
	}
	if (antrag.userId === ich.id) error(403, 'Die eigene Ausbildung kann nicht selbst abgezeichnet werden.');

	return { antrag: ansicht(antrag), ichId: ich.id };
};

export const actions: Actions = {
	eintragen: async (event) => {
		const ich = await ausbilder(event);
		const form = await event.request.formData();
		const einheitId = String(form.get('einheit') ?? '');
		const r = await nachweisEintragen(
			event.params.id,
			ich,
			einheitId,
			String(form.get('datum') ?? ''),
			Number(form.get('ue')),
			event.url.origin
		);
		return r.ok ? { eingetragen: einheitId, abnahme: r.abnahme } : fail(400, { fehler: r.fehler, einheit: einheitId });
	},

	entfernen: async (event) => {
		const ich = await ausbilder(event);
		const form = await event.request.formData();
		const einheitId = String(form.get('einheit') ?? '');
		const r = await nachweisEntfernen(event.params.id, ich.id, einheitId);
		return r.ok ? { entfernt: einheitId } : fail(400, { fehler: r.fehler, einheit: einheitId });
	},

	/** Nach einer Rückgabe durch den Bezirk: erneut zur Abnahme melden. */
	abnahme: async (event) => {
		await ausbilder(event);
		const antrag = await antragPerId(event.params.id);
		if (!antrag) error(404);
		const ok = await abnahmeAnstossen(antrag._id, event.url.origin);
		return ok ? { abnahme: true } : fail(400, { fehler: 'Es sind noch nicht alle Einheiten abgezeichnet.' });
	}
};
