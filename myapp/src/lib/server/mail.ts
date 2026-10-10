import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '$env/dynamic/private';

/*
 * Mailversand für die ganze Seite.
 *
 * Solange SMTP_HOST in der .env fehlt, wird nichts verschickt, sondern die Mail
 * samt Link in der Serverkonsole ausgegeben. So lässt sich der komplette Ablauf
 * lokal durchklicken, ohne einen Mailserver einzurichten.
 */

let transport: Transporter | null = null;

function versand(): Transporter {
	if (!transport) {
		const port = Number(env.SMTP_PORT || 587);
		transport = nodemailer.createTransport({
			host: env.SMTP_HOST,
			port,
			// 465 spricht direkt TLS, 587 handelt es über STARTTLS aus.
			secure: port === 465,
			auth: env.SMTP_USER ? { user: env.SMTP_USER } : undefined
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
}

export function mailAktiv(): boolean {
	return Boolean(env.SMTP_HOST);
}

export async function sendeMail(mail: Mail): Promise<void> {
	if (!mailAktiv()) {
		console.info(
			`\n[mail] SMTP_HOST fehlt – Mail wird nur hier ausgegeben.\n` +
				`  An:      ${mail.an ?? `(${mail.anVariable ?? 'Empfänger'} nicht gesetzt)`}\n` +
				`  Betreff: ${mail.betreff}\n\n${mail.text}\n`
		);
		return;
	}
	if (!mail.an) {
		throw new Error(`Kein Empfänger: ${mail.anVariable ?? 'Adresse'} fehlt in der .env`);
	}
	await versand().sendMail({
		from: env.SMTP_FROM || env.SMTP_USER,
		to: mail.an,
		subject: mail.betreff,
		text: mail.text,
		html: mail.html
	});
}
