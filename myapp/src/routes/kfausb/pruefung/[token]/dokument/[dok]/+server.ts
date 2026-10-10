import { error } from '@sveltejs/kit';
import { antragPerToken, dokumentLesen } from '$lib/server/kfausb';
import type { RequestHandler } from './$types';

/** Gibt eine hochgeladene Kopie aus – nur mit gültigem Prüf-Link des zugehörigen Antrags. */
export const GET: RequestHandler = async ({ params }) => {
	const antrag = await antragPerToken(params.token);
	if (!antrag) error(410, 'Dieser Link ist nicht mehr gültig.');

	const datei = await dokumentLesen(antrag, params.dok);
	if (!datei) error(404, 'Dokument nicht gefunden.');

	return new Response(new Uint8Array(datei.daten), {
		headers: {
			'content-type': datei.typ,
			'content-length': String(datei.daten.length),
			// Im Browser anzeigen, aber nie als etwas anderes behandeln als den beim Hochladen
			// geprüften Typ (JPG, PNG oder PDF).
			'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(datei.name)}`,
			'x-content-type-options': 'nosniff',
			'cache-control': 'private, no-store',
			'referrer-policy': 'no-referrer'
		}
	});
};
