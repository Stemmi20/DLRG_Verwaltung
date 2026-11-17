import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '$env/dynamic/private';

/*
 * Mailversand für die ganze Seite.
 *
 * Solange SMTP_HOST in der .env fehlt, wird nichts verschickt, sondern die Mail
 * samt Link in der Serverkonsole ausgegeben. So lässt sich der komplette Ablauf
 * lokal durchklicken, ohne einen Mailserver einzurichten.
 *
 * Alles, was hier passiert, steht mit dem Präfix [mail] im Log:
 *   sudo docker compose logs -f | grep mail
 */

let transport: Transporter | null = null;

/** Passwort nie ins Log – nur, ob eins gesetzt ist. */
function einstellungen() {
	const port = Number(env.SMTP_PORT || 587);
	return {
		host: env.SMTP_HOST || '(fehlt)',
		port,
		secure: port === 465,
		user: env.SMTP_USER || '(fehlt)',
		passwort: env.SMTP_PASS ? 'gesetzt' : '(fehlt)',
		from: env.SMTP_FROM || env.SMTP_USER || '(fehlt)',
	};
}

function versand(): Transporter {
	if (!transport) {
		const e = einstellungen();
		console.info(
			`[mail] SMTP: ${e.host}:${e.port} (${e.secure ? 'TLS' : 'STARTTLS'}), ` +
				`Benutzer ${e.user}, Passwort ${e.passwort}, Absender ${e.from}`,
		);
		transport = nodemailer.createTransport({
			host: env.SMTP_HOST,
			port: e.port,
			// 465 spricht direkt TLS, 587 handelt es über STARTTLS aus.
			secure: e.secure,
			auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
			// Ohne Grenzen hängt eine Anfrage minutenlang, wenn der Port gesperrt ist.
			connectionTimeout: 10_000,
			greetingTimeout: 10_000,
			socketTimeout: 20_000,
		});
	}
	return transport;
}

export interface Mail {
	/** Empfänger; mehrere mit Komma getrennt. */
	an: string | undefined;
	/** Name der .env-Variable, aus der `an` stammt – für eine klare Fehlermeldung. */
	anVariable?: string;
	betreff: string;
	text: string;
	html: string;
	/** Antworten gehen an diese Adresse statt an den Absender. */
	antwortAn?: string;
	anhaenge?: { dateiname: string; inhalt: Buffer; typ: string }[];
}

export function mailAktiv(): boolean {
	return Boolean(env.SMTP_HOST);
}

/** Fehler von nodemailer so aufbereiten, dass man die Ursache sieht. */
function fehlerText(e: unknown): string {
	const f = e as { code?: string; command?: string; responseCode?: number; response?: string; message?: string };
	const teile = [
		f.code && `Code ${f.code}`,
		f.command && `bei ${f.command}`,
		f.responseCode && `Server antwortet ${f.responseCode}`,
		f.response && `„${f.response}"`,
	].filter(Boolean);
	const hinweis =
		f.code === 'ETIMEDOUT' || f.code === 'ESOCKET' || f.code === 'ECONNREFUSED'
			? ' → Server nicht erreichbar: Port gesperrt (Hoster/Firewall) oder SMTP_HOST/SMTP_PORT falsch.'
			: f.code === 'EAUTH'
				? ' → Anmeldung abgelehnt: SMTP_USER/SMTP_PASS prüfen.'
				: f.code === 'EENVELOPE'
					? ' → Absender oder Empfänger abgelehnt: SMTP_FROM bzw. Empfängeradresse prüfen.'
					: '';
	return `${f.message ?? String(e)}${teile.length ? ` (${teile.join(', ')})` : ''}${hinweis}`;
}

export async function sendeMail(mail: Mail): Promise<void> {
	const quelle = mail.anVariable ? ` (aus ${mail.anVariable})` : '';

	if (!mailAktiv()) {
		console.info(
			`\n[mail] SMTP_HOST fehlt – Mail wird NICHT verschickt, nur hier ausgegeben.\n` +
				`  An:      ${mail.an ?? `(${mail.anVariable ?? 'Empfänger'} nicht gesetzt)`}\n` +
				`  Betreff: ${mail.betreff}\n\n${mail.text}\n`,
		);
		return;
	}
	if (!mail.an) {
		console.error(`[mail] NICHT verschickt: ${mail.anVariable ?? 'Empfänger'} fehlt in der .env – „${mail.betreff}"`);
		throw new Error(`Kein Empfänger: ${mail.anVariable ?? 'Adresse'} fehlt in der .env`);
	}

	const from = env.SMTP_FROM || env.SMTP_USER;
	console.info(`[mail] sende an ${mail.an}${quelle}, von ${from}: „${mail.betreff}"`);

	const start = Date.now();
	try {
		const info = await versand().sendMail({
			from,
			to: mail.an,
			subject: mail.betreff,
			text: mail.text,
			html: mail.html,
			replyTo: mail.antwortAn || undefined,
			attachments: mail.anhaenge?.map((a) => ({ filename: a.dateiname, content: a.inhalt, contentType: a.typ })),
		});
		const abgelehnt = info.rejected?.length ? `, ABGELEHNT: ${info.rejected.join(', ')}` : '';
		console.info(
			`[mail] verschickt in ${Date.now() - start} ms an ${info.accepted?.join(', ') || mail.an}${abgelehnt} ` +
				`– Server: ${info.response}`,
		);
	} catch (e) {
		console.error(`[mail] FEHLER nach ${Date.now() - start} ms an ${mail.an}: ${fehlerText(e)}`);
		throw e;
	}
}

/**
 * Verbindung und Anmeldung testen, ohne eine Mail zu schicken.
 * Läuft einmal beim ersten Laden dieser Datei, damit das Ergebnis gleich nach
 * dem Start im Log steht.
 */
export async function mailTesten(): Promise<boolean> {
	if (!mailAktiv()) {
		console.info('[mail] SMTP_HOST fehlt – Mails werden nur im Log ausgegeben.');
		return false;
	}
	try {
		await versand().verify();
		console.info('[mail] Verbindungstest OK – Server erreichbar, Anmeldung angenommen.');
		return true;
	} catch (e) {
		console.error(`[mail] Verbindungstest FEHLGESCHLAGEN: ${fehlerText(e)}`);
		return false;
	}
}

void mailTesten();
