import { error, fail, redirect } from '@sveltejs/kit';
import {
	fahrten,
	fahrtAnlegen,
	fahrtLoeschen,
	fahrzeug,
	letzterKmStand,
	mitgliederliste
} from '$lib/server/fahrtenbuch';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) throw redirect(303, `/login?weiter=/fahrtenbuch/${params.fahrzeug}`);

	const fz = await fahrzeug(params.fahrzeug);
	if (!fz) throw error(404, 'Fahrzeug nicht gefunden');

	const [eintraege, kmStand, mitglieder] = await Promise.all([
		fahrten(fz.id),
		letzterKmStand(fz.id),
		mitgliederliste()
	]);

	return {
		fahrzeug: { id: fz.id, funkrufname: fz.funkrufname, sitzplaetze: fz.sitzplaetze },
		fahrten: eintraege,
		kmStand,
		mitglieder,
		fahrer: { id: locals.user.id, name: `${locals.user.vorname} ${locals.user.nachname}`.trim() }
	};
};

export const actions: Actions = {
	anlegen: async ({ request, params, locals }) => {
		if (!locals.user) throw error(401, 'Nicht angemeldet');

		const fz = await fahrzeug(params.fahrzeug);
		if (!fz) throw error(404, 'Fahrzeug nicht gefunden');

		const daten = await request.formData();
		const wert = (feld: string) => String(daten.get(feld) ?? '').trim();

		const werte: Record<string, string> = {};
		for (const [k, v] of daten.entries()) if (typeof v === 'string') werte[k] = v;

		// Leere Streckenfelder verwerfen – das Formular schickt immer alle mit.
		const strecke = daten.getAll('strecke').map(String).map((s) => s.trim()).filter(Boolean);
		const mitfahrerIds = daten.getAll('mitfahrer').map(String).filter(Boolean);

		const felder: Record<string, string> = {};

		if (!wert('datum')) felder.datum = 'Bitte das Datum eintragen.';
		if (!wert('fahrtgrund')) felder.fahrtgrund = 'Bitte den Fahrtgrund eintragen.';
		if (strecke.length < 2) felder.strecke = 'Bitte mindestens Start und Ziel eintragen.';

		// Achtung: Number('') ist 0. Ohne die Leerprüfung würde ein leeres
		// Feld serverseitig als gültige 0 durchgehen – required greift nur
		// im Browser.
		const kmStartRoh = wert('kmStart');
		const kmEndeRoh = wert('kmEnde');
		const kmStart = Number(kmStartRoh);
		const kmEnde = Number(kmEndeRoh);

		if (kmStartRoh === '' || !Number.isInteger(kmStart) || kmStart < 0) {
			felder.kmStart = 'Bitte einen gültigen Kilometerstand eintragen.';
		}
		if (kmEndeRoh === '' || !Number.isInteger(kmEnde) || kmEnde < 0) {
			felder.kmEnde = 'Bitte einen gültigen Kilometerstand eintragen.';
		} else if (Number.isInteger(kmStart) && kmEnde < kmStart) {
			felder.kmEnde = 'Der Endstand liegt unter dem Startstand.';
		} else if (Number.isInteger(kmStart) && kmEnde - kmStart > 2000) {
			// Ein Zahlendreher fällt sonst erst auf, wenn die Statistik nicht stimmt.
			felder.kmEnde = 'Über 2.000 km in einer Fahrt – bitte prüfen.';
		}

		const kraftstoffRoh = wert('kraftstoff');
		const kraftstoff = Number(kraftstoffRoh);

		if (
			kraftstoffRoh === '' ||
			!Number.isInteger(kraftstoff) ||
			kraftstoff < 0 ||
			kraftstoff > 100
		) {
			felder.kraftstoff = 'Bitte einen Wert zwischen 0 und 100 eintragen.';
		}

		// Fahrer zählt mit: bei 5 Sitzplätzen sind 4 Mitfahrer möglich.
		if (mitfahrerIds.length + 1 > fz.sitzplaetze) {
			felder.mitfahrer = `${fz.funkrufname} hat ${fz.sitzplaetze} Sitzplätze – mit dir sind das ${mitfahrerIds.length + 1} Personen.`;
		}

		if (Object.keys(felder).length > 0) {
			return fail(400, {
				fehler: 'Bitte prüfe die markierten Felder.',
				felder,
				werte,
				strecke,
				mitfahrerIds
			});
		}

		// Namen aus der aktuellen Mitgliederliste auflösen und mitspeichern.
		const mitglieder = await mitgliederliste();
		const nachId = new Map(mitglieder.map((m) => [m.id, m.name]));

		await fahrtAnlegen({
			fahrzeugId: fz.id,
			datum: new Date(wert('datum')),
			fahrtgrund: wert('fahrtgrund'),
			strecke,
			fahrerId: locals.user.id,
			fahrerName: `${locals.user.vorname} ${locals.user.nachname}`.trim(),
			kmStart,
			kmEnde,
			kraftstoff,
			bemerkung: wert('bemerkung') || null,
			mitfahrer: mitfahrerIds
				.filter((id) => nachId.has(id))
				.map((id) => ({ userId: id, name: nachId.get(id)! }))
		});

		return { erfolg: true };
	},

	loeschen: async ({ request, locals }) => {
		if (!locals.user?.istAdmin) throw error(403, 'Nur Administratoren dürfen Fahrten löschen');
		const daten = await request.formData();
		await fahrtLoeschen(Number(daten.get('id')));
		return { geloescht: true };
	}
};