import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { sendeMail } from '$lib/server/mail';
import type { RequestHandler } from './$types';

/*
 * Fehlermeldung / Verbesserungsvorschlag aus der Navigationsleiste.
 *
 * Empfänger: BUG_MAIL in der .env (mehrere mit Komma). Fehlt die Variable,
 * geht die Meldung an das Absender-Postfach (SMTP_FROM bzw. SMTP_USER).
 */

const ARTEN = { fehler: 'Fehler', idee: 'Verbesserungsvorschlag', frage: 'Frage' } as const;
const BILD_MAX = 5 * 1024 * 1024;
const BILD_TYPEN = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

/** Höchstens 5 Meldungen pro Person und Stunde – gegen versehentliches Dauerklicken. */
const LIMIT = 5;
const verlauf = new Map<string, number[]>();

function escapeHtml(s: string): string {
	return s.replace(/[&<>"']/g, (z) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[z]!);
}

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) return json({ fehler: 'Bitte zuerst anmelden.' }, { status: 401 });

	const jetzt = Date.now();
	const meine = (verlauf.get(locals.user.id) ?? []).filter((t) => jetzt - t < 3600_000);
	if (meine.length >= LIMIT) {
		return json({ fehler: 'Du hast in der letzten Stunde schon mehrere Meldungen geschickt. Bitte später noch einmal.' }, { status: 429 });
	}

	const f = await request.formData();
	const artSchluessel = String(f.get('art') ?? 'fehler') as keyof typeof ARTEN;
	const art = ARTEN[artSchluessel] ?? ARTEN.fehler;
	const titel = String(f.get('titel') ?? '').trim().slice(0, 120);
	const beschreibung = String(f.get('beschreibung') ?? '').trim().slice(0, 5000);
	const seite = String(f.get('seite') ?? '').trim().slice(0, 500);
	const antwortAn = String(f.get('antwortAn') ?? '').trim().slice(0, 200);
	const bild = f.get('bild');

	if (!titel) return json({ fehler: 'Bitte einen kurzen Titel angeben.' }, { status: 400 });
	if (beschreibung.length < 10) return json({ fehler: 'Bitte beschreib kurz, was passiert ist.' }, { status: 400 });
	if (antwortAn && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(antwortAn)) {
		return json({ fehler: 'Die E-Mail-Adresse für die Rückmeldung sieht nicht richtig aus.' }, { status: 400 });
	}

	const anhaenge: { dateiname: string; inhalt: Buffer; typ: string }[] = [];
	if (bild instanceof File && bild.size > 0) {
		if (!BILD_TYPEN.includes(bild.type)) return json({ fehler: 'Als Screenshot bitte PNG, JPG, WebP oder GIF.' }, { status: 400 });
		if (bild.size > BILD_MAX) return json({ fehler: 'Der Screenshot darf höchstens 5 MB groß sein.' }, { status: 400 });
		anhaenge.push({ dateiname: bild.name || 'screenshot.png', inhalt: Buffer.from(await bild.arrayBuffer()), typ: bild.type });
	}

	const u = locals.user;
	const wer = `${u.vorname} ${u.nachname}`.trim() || 'Unbekannt';
	const browser = request.headers.get('user-agent') ?? 'unbekannt';
	const zeit = new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' });

	const zeilen: [string, string][] = [
		['Art', art],
		['Von', `${wer}${u.ortsgruppe ? ` (${u.ortsgruppe})` : ''}`],
		['Rückmeldung an', antwortAn || '–'],
		['Seite', seite || '–'],
		['Zeit', zeit],
		['Browser', browser],
	];

	const an = env.BUG_MAIL || env.SMTP_FROM || env.SMTP_USER;

	try {
		await sendeMail({
			an,
			anVariable: env.BUG_MAIL ? 'BUG_MAIL' : 'SMTP_FROM (BUG_MAIL fehlt)',
			betreff: `[Portal] ${art}: ${titel}`,
			antwortAn: antwortAn || undefined,
			anhaenge,
			text:
				`${art}: ${titel}\n\n${beschreibung}\n\n` +
				zeilen.map(([k, v]) => `${k}: ${v}`).join('\n') +
				(anhaenge.length ? `\n\nScreenshot im Anhang.` : ''),
			html: `<div style="font-family:Arial,sans-serif;color:#333;max-width:640px">
<p style="margin:0 0 4px;color:#e30613;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:1px">${escapeHtml(art)} · DLRG Verwaltungsportal</p>
<h2 style="margin:0 0 14px">${escapeHtml(titel)}</h2>
<p style="white-space:pre-wrap;margin:0 0 18px">${escapeHtml(beschreibung)}</p>
<table style="border-collapse:collapse;font-size:13px">${zeilen
				.map(([k, v]) => `<tr><td style="padding:3px 14px 3px 0;color:#888;vertical-align:top">${escapeHtml(k)}</td><td style="padding:3px 0">${escapeHtml(v)}</td></tr>`)
				.join('')}</table>
${anhaenge.length ? '<p style="color:#888;font-size:13px">Screenshot im Anhang.</p>' : ''}
</div>`,
		});
	} catch {
		// Details stehen mit [mail] im Server-Log.
		return json({ fehler: 'Die Meldung konnte gerade nicht verschickt werden. Bitte später noch einmal versuchen.' }, { status: 502 });
	}

	meine.push(jetzt);
	verlauf.set(u.id, meine);
	return json({ ok: true });
};
