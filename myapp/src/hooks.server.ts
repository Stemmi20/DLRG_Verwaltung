// src/hooks.server.ts
import { redirect, type Handle } from '@sveltejs/kit';
import { sitzungPruefen } from '$lib/server/auth';
import { starteMqtt } from '$lib/server/mqtt';

// Beim Start der Serverinstanz, nicht erst beim ersten Kartenaufruf: sonst
// wird nur aufgezeichnet, solange irgendwo ein Browser die Karte offen hat.
starteMqtt();

// Alles unter diesen Pfaden erfordert eine Anmeldung
const GESCHUETZT = [
	'/boteinsatzgruppe', //  '/admin', '/fleetmanager', '/kfausb', '/fahrtenbuch'
];

export const handle: Handle = async ({ event, resolve }) => {
	const sitzungsId = event.cookies.get('session');
	const sitzung = sitzungsId ? await sitzungPruefen(sitzungsId) : null;

	if (sitzungsId && !sitzung) {
		event.cookies.delete('session', { path: '/' });
	}

	// Quelle der Wahrheit: Die Benutzerdaten kommen aus der Datenbank.
	event.locals.user = sitzung
		? {
				id: sitzung.benutzer._id.toString(),
				vorname: sitzung.benutzer.vorname ?? '',
				nachname: sitzung.benutzer.nachname ?? '',
				ortsgruppe: sitzung.benutzer.ortsgruppe ?? '',
				istAdmin: sitzung.benutzer.ortsgruppe_admin === true
			}
		: null;

	event.locals.userId = event.locals.user?.id ?? null;

	const pfad = event.url.pathname;
	const brauchtAnmeldung = GESCHUETZT.some(
		(p) => pfad === p || pfad.startsWith(p + '/')
	);

	if (brauchtAnmeldung && !event.locals.user) {
		redirect(303, `/login?weiter=${encodeURIComponent(pfad)}`);
	}

	// Wichtig: Die Anfrage muss weiter an SvelteKit übergeben werden.
	return await resolve(event);
};