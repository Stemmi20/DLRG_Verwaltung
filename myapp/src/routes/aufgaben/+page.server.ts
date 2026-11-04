import { fail, redirect } from '@sveltejs/kit';
import { FILTER, type FilterName } from '$lib/aufgaben';
import {
	abgeben,
	erledigen,
	erstellen,
	liste,
	statistik,
	telegramIdVon,
	uebernehmen,
	type Ergebnis,
	type Handelnder,
} from '$lib/server/aufgaben';
import type { Actions, PageServerLoad } from './$types';

/** Der angemeldete Benutzer – die Telegram-ID kommt direkt aus seinem Datensatz. */
async function handelnder(locals: App.Locals, pfad: string): Promise<Handelnder> {
	if (!locals.user) redirect(303, `/login?weiter=${encodeURIComponent(pfad)}`);
	return {
		userId: locals.user.id,
		telegramID: await telegramIdVon(locals.user.id),
		name: `${locals.user.vorname} ${locals.user.nachname}`.trim() || 'Unbekannt',
		ortsgruppe: locals.user.ortsgruppe,
		istAdmin: locals.user.istAdmin,
	};
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const ich = await handelnder(locals, url.pathname);
	const roh = url.searchParams.get('filter') ?? 'offen';
	const filter: FilterName = roh in FILTER ? (roh as FilterName) : 'offen';

	const [zahlen, aufgaben] = await Promise.all([statistik(ich), liste(ich, filter)]);
	return {
		filter,
		zahlen,
		aufgaben,
		ortsgruppe: ich.ortsgruppe,
		istAdmin: ich.istAdmin,
	};
};

/** Alle Knöpfe einer Aufgabe laufen hierüber: ID lesen, ausführen, Fehler melden. */
async function mitAufgabe(
	request: Request,
	locals: App.Locals,
	pfad: string,
	tun: (ich: Handelnder, id: number) => Promise<Ergebnis>,
) {
	const ich = await handelnder(locals, pfad);
	const id = Number((await request.formData()).get('aufgabenID'));
	if (!Number.isFinite(id)) return fail(400, { fehler: 'Unbekannte Aufgabe.', aufgabenID: null });
	const r = await tun(ich, id);
	return r.ok ? { aufgabenID: id } : fail(409, { fehler: r.fehler, aufgabenID: id });
}

export const actions: Actions = {
	erstellen: async ({ request, locals, url }) => {
		const ich = await handelnder(locals, url.pathname);
		const f = await request.formData();
		const kurz = String(f.get('kurz') ?? '');
		const lang = String(f.get('lang') ?? '');
		const r = await erstellen(ich, kurz, lang);
		return r.ok
			? { erstellt: true }
			: fail(400, { fehler: r.fehler, aufgabenID: null, kurz, lang, formular: true });
	},
	uebernehmen: ({ request, locals, url }) => mitAufgabe(request, locals, url.pathname, uebernehmen),
	abgeben: ({ request, locals, url }) => mitAufgabe(request, locals, url.pathname, abgeben),
	erledigen: ({ request, locals, url }) => mitAufgabe(request, locals, url.pathname, erledigen),
};