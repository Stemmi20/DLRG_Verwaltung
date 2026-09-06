import { error, fail, redirect } from '@sveltejs/kit';
import {
	blaetter,
	blattAnlegen,
	blattLoeschen,
	boot,
	letzterBetriebsstand
} from '$lib/server/bootstagebuch';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) throw redirect(303, `/login?weiter=/bootstagebuch/${params.boot}`);

	const b = await boot(params.boot);
	if (!b) throw error(404, 'Boot nicht gefunden');

	const [liste, staende] = await Promise.all([
		blaetter(b.id),
		Promise.all(b.maschinen.map((m) => letzterBetriebsstand(m.id)))
	]);

	return {
		boot: { id: b.id, funkname: b.funkname, liegeort: b.liegeort },
		blaetter: liste,
		maschinen: b.maschinen.map((m, i) => ({
			id: m.id,
			bezeichnung: m.bezeichnung,
			betriebsstunden: staende[i]
		}))
	};
};

export const actions: Actions = {
	anlegen: async ({ request, params, locals }) => {
		if (!locals.user) throw error(401, 'Nicht angemeldet');

		const b = await boot(params.boot);
		if (!b) throw error(404, 'Boot nicht gefunden');

		const daten = await request.formData();
		const wert = (feld: string) => String(daten.get(feld) ?? '').trim();

		const liegeort = wert('liegeort');
		const datumRoh = wert('datum');

		const felder: Record<string, string> = {};
		if (!liegeort) felder.liegeort = 'Bitte den Liegeort eintragen.';
		if (!datumRoh) felder.datum = 'Bitte das Datum eintragen.';

		if (Object.keys(felder).length > 0) {
			return fail(400, {
				fehler: 'Bitte prüfe die markierten Felder.',
				felder,
				werte: { liegeort, datum: datumRoh }
			});
		}

		const neu = await blattAnlegen({
			bootId: b.id,
			// Schnappschuss des Funknamens, siehe Kommentar im Schema.
			funkname: b.funkname,
			liegeort,
			datum: new Date(datumRoh),
			erstelltVonId: locals.user.id,
			erstelltVonName: `${locals.user.vorname} ${locals.user.nachname}`.trim(),
			// Je Maschine eine Zeile, Anfangsstand aus dem letzten Blatt.
			maschinen: await Promise.all(
				b.maschinen.map(async (m, position) => ({
					maschineId: m.id,
					bezeichnung: m.bezeichnung,
					betriebsstundenAnfang: await letzterBetriebsstand(m.id),
					position
				}))
			)
		});

		throw redirect(303, `/bootstagebuch/${b.id}/${neu.id}`);
	},

	loeschen: async ({ request, locals }) => {
		if (!locals.user?.istAdmin) throw error(403, 'Nur Administratoren dürfen Blätter löschen');
		const daten = await request.formData();
		await blattLoeschen(Number(daten.get('id')));
		return { geloescht: true };
	}
};