import { fail, redirect } from '@sveltejs/kit';
import {
	anlegen,
	bearbeiten,
	kategorien,
	liste,
	loeschen,
	zustandSetzen,
	type Ergebnis,
	type Handelnder,
	type Stammdaten,
} from '$lib/server/material';
import type { Actions, PageServerLoad } from './$types';

function handelnder(locals: App.Locals, pfad: string): Handelnder {
	if (!locals.user) redirect(303, `/login?weiter=${encodeURIComponent(pfad)}`);
	return {
		name: `${locals.user.vorname} ${locals.user.nachname}`.trim() || 'Unbekannt',
		ortsgruppe: locals.user.ortsgruppe,
		istAdmin: locals.user.istAdmin,
	};
}

function stammdaten(f: FormData): Stammdaten {
	return {
		name: String(f.get('name') ?? '').trim(),
		nummer: String(f.get('nummer') ?? '').trim(),
		kategorie: String(f.get('kategorie') ?? '').trim(),
		standort: String(f.get('standort') ?? ''),
		anzahl: Number(f.get('anzahl')),
	};
}

/** Antwort an die Seite: bei Fehler mit der ID, damit er am richtigen Eintrag steht. */
function antwort(r: Ergebnis, id: string | null, extra: Record<string, unknown> = {}) {
	return r.ok ? { ok: true as const, id, ...extra } : fail(400, { fehler: r.fehler, id, ...extra });
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const ich = handelnder(locals, url.pathname);
	const [eintraege, kats] = await Promise.all([liste(ich), kategorien(ich)]);
	return { eintraege, kategorien: kats, istAdmin: ich.istAdmin, ortsgruppe: ich.ortsgruppe };
};

export const actions: Actions = {
	zustand: async ({ request, locals, url }) => {
		const ich = handelnder(locals, url.pathname);
		const f = await request.formData();
		const id = String(f.get('id') ?? '');
		const r = await zustandSetzen(
			ich,
			id,
			String(f.get('von') ?? ''),
			String(f.get('nach') ?? ''),
			Number(f.get('anzahl') ?? 1),
			String(f.get('notiz') ?? ''),
		);
		return antwort(r, id);
	},
	anlegen: async ({ request, locals, url }) => {
		const ich = handelnder(locals, url.pathname);
		const d = stammdaten(await request.formData());
		return antwort(await anlegen(ich, d), null, { neu: true, werte: d });
	},
	bearbeiten: async ({ request, locals, url }) => {
		const ich = handelnder(locals, url.pathname);
		const f = await request.formData();
		const id = String(f.get('id') ?? '');
		return antwort(await bearbeiten(ich, id, stammdaten(f), String(f.get('stand') ?? '')), id, {
			bearbeitet: true,
		});
	},
	loeschen: async ({ request, locals, url }) => {
		const ich = handelnder(locals, url.pathname);
		const id = String((await request.formData()).get('id') ?? '');
		return antwort(await loeschen(ich, id), id);
	},
};
