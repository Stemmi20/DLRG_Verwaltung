import { GridFSBucket, ObjectId, type Document, type Filter } from 'mongodb';
import { createHash, randomBytes } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { db } from './database';
import { collection as mitglieder } from './usedata';
import { sendeMail } from './mail';
import {
	CHECKLISTE,
	ABSCHLUSSPUNKTE,
	MINDESTALTER,
	alterAm,
	datumDe,
	fortschritt,
	heuteISO,
	istDatum,
	pflichtEinheiten,
	type Abschlusspunkte,
	type AntragAnsicht,
	type Checkliste,
	type DokumentArt,
	type Fahrzeug,
	type Klasse,
	type Nachweis,
	type Person,
	type Pruefstufe,
	type Status
} from '$lib/kfausb';

/*
 * Kraftfahrer-Ausbildung als Ticket:
 *
 *   eingereicht ──Ortsgruppe──▶ og_befuerwortet ──Bezirk──▶ in_ausbildung
 *        │                            │                          │ Ausbilder zeichnen ab
 *        ▼                            ▼                          ▼
 *    abgelehnt                    abgelehnt             ausbildung_fertig ──Bezirk──▶ abgeschlossen
 *                                                               │
 *                                                               └── zurück in die Ausbildung
 *
 * Ortsgruppe und Bezirk entscheiden über einen Link aus der Mail, ohne Konto.
 * Jeder Link gilt für genau eine Entscheidung und läuft nach 30 Tagen ab.
 */

// ─────────────────────────────────────────────────── Felder im Mitgliedsdatensatz

/**
 * Wo die Funktionen im Mitgliedsdatensatz stehen. Liegen sie bei euch auf
 * oberster Ebene statt unter `funktionen`, hier einfach das Präfix entfernen.
 */
export const FELD = {
	kf: 'funktionen.kf',
	kfausbilder: 'funktionen.kfausbilder',
	inkfausb: 'funktionen.inkfausb'
} as const;
type Funktion = keyof typeof FELD;

function wertAmPfad(doc: Document | null, pfad: string): unknown {
	let wert: unknown = doc;
	for (const teil of pfad.split('.')) {
		if (!wert || typeof wert !== 'object') return undefined;
		wert = (wert as Record<string, unknown>)[teil];
	}
	return wert;
}

/** Liest erst am eingestellten Pfad, dann auf oberster Ebene. */
export function hatFunktion(doc: Document | null, funktion: Funktion): boolean {
	return wertAmPfad(doc, FELD[funktion]) === true || wertAmPfad(doc, funktion) === true;
}

function mitgliedFilter(id: string): Filter<Document> {
	// Je nachdem, wer den Datensatz angelegt hat, ist die _id eine ObjectId oder ein String.
	const kandidaten = ObjectId.isValid(id) && id.length === 24 ? [new ObjectId(id), id] : [id];
	return { _id: { $in: kandidaten } } as Filter<Document>;
}

export function mitgliedLaden(id: string) {
	return mitglieder.findOne(mitgliedFilter(id));
}

async function funktionenSetzen(userId: string, werte: Partial<Record<Funktion, boolean>>) {
	const set: Record<string, boolean> = {};
	for (const [name, wert] of Object.entries(werte)) set[FELD[name as Funktion]] = Boolean(wert);
	await mitglieder.updateOne(mitgliedFilter(userId), { $set: set });
}

// ──────────────────────────────────────────────────────────────────── Antrag

interface Dokument {
	/** ObjectId der Datei in GridFS, als Hex-String. */
	id: string;
	art: DokumentArt;
	name: string;
	typ: string;
	groesse: number;
}

interface Pruefung {
	stufe: Pruefstufe;
	/** Nur der Hash liegt in der Datenbank – wer sie liest, kann keinen Link nachbauen. */
	tokenHash: string;
	gueltigBis: Date;
	/** null, solange die Mail nicht zugestellt werden konnte. */
	gesendetAm: Date | null;
}

interface AntragDoc {
	_id: ObjectId;
	userId: string;
	eingegangenAm: Date;
	status: Status;
	person: Person;
	klassen: { klasse: Klasse; seit: string }[];
	fahrzeuge: Fahrzeug[];
	/** Mindestens 10.000 km Fahrerfahrung und weniger als 4 Punkte. */
	bestaetigtKmPunkte: boolean;
	dokumente: Dokument[];
	og: { befuerwortet: boolean; am: Date; bemerkung: string | null } | null;
	bezirk: {
		genehmigt: boolean;
		am: Date;
		bemerkung: string | null;
		checkliste: Checkliste;
		vorlageAm: string | null;
		vorlageBei: string | null;
	} | null;
	nachweise: Nachweis[];
	abschluss: {
		am: Date;
		fahrzeugeErteilt: Fahrzeug[];
		punkte: Abschlusspunkte;
		bemerkung: string | null;
	} | null;
	pruefung: Pruefung | null;
	verlauf: { am: Date; text: string }[];
}

type Ergebnis<T = object> = ({ ok: true } & T) | { ok: false; fehler: string };
const fehler = (text: string) => ({ ok: false as const, fehler: text });

const antraege = () => db.collection<AntragDoc>('kfausb_antraege');
const dateiablage = () => new GridFSBucket(db, { bucketName: 'kfausb_dokumente' });

let indizesAngelegt = false;
async function sammlung() {
	if (!indizesAngelegt) {
		await Promise.all([
			antraege().createIndex({ userId: 1, eingegangenAm: -1 }),
			antraege().createIndex({ 'pruefung.tokenHash': 1 }),
			antraege().createIndex({ status: 1 })
		]);
		indizesAngelegt = true;
	}
	return antraege();
}

export async function aktuellerAntrag(userId: string): Promise<AntragDoc | null> {
	const col = await sammlung();
	return col.find({ userId }).sort({ eingegangenAm: -1 }).limit(1).next();
}

export async function antragPerId(id: string): Promise<AntragDoc | null> {
	if (!ObjectId.isValid(id) || id.length !== 24) return null;
	return (await sammlung()).findOne({ _id: new ObjectId(id) });
}

const ERINNERUNG_NACH_MS = 24 * 60 * 60 * 1000;

/** Alles, was die Seiten brauchen – Datumswerte als Strings, damit es serialisierbar ist. */
export function ansicht(a: AntragDoc): AntragAnsicht {
	const gesendet = a.pruefung?.gesendetAm;
	const erinnerungAb =
		gesendet && Date.now() - gesendet.getTime() < ERINNERUNG_NACH_MS
			? new Date(gesendet.getTime() + ERINNERUNG_NACH_MS).toISOString()
			: null;

	return {
		id: a._id.toHexString(),
		status: a.status,
		eingegangenAm: a.eingegangenAm.toISOString(),
		person: a.person,
		alter: alterAm(a.person.geburtsdatum),
		klassen: a.klassen,
		fahrzeuge: a.fahrzeuge,
		dokumente: a.dokumente.map(({ id, art, name, typ, groesse }) => ({ id, art, name, typ, groesse })),
		og: a.og && { ...a.og, am: a.og.am.toISOString() },
		bezirk: a.bezirk && { ...a.bezirk, am: a.bezirk.am.toISOString() },
		abschluss: a.abschluss && { ...a.abschluss, am: a.abschluss.am.toISOString() },
		fortschritt: fortschritt(a.fahrzeuge, a.nachweise),
		wartetAuf: a.pruefung?.stufe ?? null,
		erinnerungAb,
		verlauf: a.verlauf.map((v) => ({ am: v.am.toISOString(), text: v.text })).reverse()
	};
}

// ─────────────────────────────────────────────────────────── Links und Mails

const LINK_GUELTIG_TAGE = 30;

function tokenHash(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

function neuePruefung(stufe: Pruefstufe): { token: string; pruefung: Pruefung } {
	const token = randomBytes(32).toString('base64url');
	return {
		token,
		pruefung: {
			stufe,
			tokenHash: tokenHash(token),
			gueltigBis: new Date(Date.now() + LINK_GUELTIG_TAGE * 24 * 60 * 60 * 1000),
			gesendetAm: null
		}
	};
}

export async function antragPerToken(token: string): Promise<AntragDoc | null> {
	if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
	const a = await (await sammlung()).findOne({ 'pruefung.tokenHash': tokenHash(token) });
	if (!a?.pruefung || a.pruefung.gueltigBis.getTime() < Date.now()) return null;
	return a;
}

const EMPFAENGER: Record<Pruefstufe, 'KF_MAIL_OG' | 'KF_MAIL_BEZIRK'> = {
	og: 'KF_MAIL_OG',
	bezirk: 'KF_MAIL_BEZIRK',
	abschluss: 'KF_MAIL_BEZIRK'
};

const AUFGABE: Record<Pruefstufe, { betreff: string; text: string; knopf: string }> = {
	og: {
		betreff: 'Befürwortung der Ortsgruppe erbeten',
		text: 'hat die Kraftfahrer-Ausbildung beantragt. Bitte prüfe als Leiter Einsatz der Ortsgruppe die Angaben und Nachweise und befürworte den Antrag oder lehne ihn ab.',
		knopf: 'Antrag prüfen'
	},
	bezirk: {
		betreff: 'Genehmigung durch den Bezirk erbeten',
		text: 'hat die Kraftfahrer-Ausbildung beantragt, die Ortsgruppe hat befürwortet. Bitte prüfe die Voraussetzungen und genehmige die Ausbildung oder lehne sie ab.',
		knopf: 'Antrag prüfen'
	},
	abschluss: {
		betreff: 'Abnahme der Ausbildung erbeten',
		text: 'hat alle Einheiten der Kraftfahrer-Ausbildung erbracht. Bitte prüfe den Ausbildungsnachweis und bestätige den Abschluss.',
		knopf: 'Ausbildung abnehmen'
	}
};

function html(text: string): string {
	return text.replace(
		/[&<>"]/g,
		(z) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[z] ?? z
	);
}

/** Verschickt den Prüf-Link. Scheitert die Mail, bleibt der Antrag trotzdem gültig. */
async function pruefungMailen(a: AntragDoc, pruefung: Pruefung, token: string, basisUrl: string) {
	const aufgabe = AUFGABE[pruefung.stufe];
	const variable = EMPFAENGER[pruefung.stufe];
	const name = `${a.person.vorname} ${a.person.name}`;
	const basis = (env.APP_URL || basisUrl).replace(/\/+$/, '');
	const link = `${basis}/kfausb/pruefung/${token}`;
	const bis = datumDe(pruefung.gueltigBis.toISOString());

	try {
		await sendeMail({
			an: env[variable],
			anVariable: variable,
			betreff: `Kraftfahrer-Ausbildung ${name}: ${aufgabe.betreff}`,
			text:
				`${name} (${a.person.einsatzgruppe}) ${aufgabe.text}\n\n` +
				`Fahrzeuge: ${a.fahrzeuge.join(', ')}\n\n` +
				`${aufgabe.knopf}: ${link}\n\n` +
				`Der Link gilt bis ${bis} und nur für diese eine Entscheidung. Bitte nicht weiterleiten.`,
			html: `<!doctype html><html lang="de"><body style="margin:0;padding:24px;background:#f1f1ef;font-family:Arial,sans-serif;color:#575756">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden">
<div style="background:#e30613;border-bottom:5px solid #ffed00;padding:18px 24px;color:#fff">
<div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;opacity:.8">DLRG · Kraftfahrer-Ausbildung</div>
<div style="font-size:20px;font-weight:bold;margin-top:4px">${html(aufgabe.betreff)}</div></div>
<div style="padding:24px;font-size:14px;line-height:1.55">
<p style="margin:0 0 14px"><b>${html(name)}</b> (${html(a.person.einsatzgruppe)}) ${html(aufgabe.text)}</p>
<p style="margin:0 0 22px">Fahrzeuge: <b>${html(a.fahrzeuge.join(', '))}</b></p>
<a href="${link}" style="display:inline-block;background:#e30613;color:#fff;text-decoration:none;font-weight:bold;padding:13px 22px;border-radius:6px">${html(aufgabe.knopf)}</a>
<p style="margin:22px 0 0;font-size:12px;color:#888">Der Link gilt bis ${bis} und nur für diese eine Entscheidung. Bitte nicht weiterleiten – wer ihn hat, kann entscheiden.</p>
</div></div></body></html>`
		});
		await antraege().updateOne(
			{ _id: a._id, 'pruefung.tokenHash': pruefung.tokenHash },
			{ $set: { 'pruefung.gesendetAm': new Date() } }
		);
		return true;
	} catch (e) {
		console.error('[kfausb] Mail an Prüfer fehlgeschlagen', e);
		return false;
	}
}

// ──────────────────────────────────────────────────────────── Antrag stellen

export interface Datei {
	art: DokumentArt;
	name: string;
	typ: string;
	daten: Buffer;
}

function hochladen(ablage: GridFSBucket, d: Datei): Promise<ObjectId> {
	return new Promise((fertig, abbruch) => {
		const strom = ablage.openUploadStream(d.name, { metadata: { art: d.art, typ: d.typ } });
		strom.once('finish', () => fertig(strom.id));
		strom.once('error', abbruch);
		strom.end(d.daten);
	});
}

export async function antragAnlegen(
	eingabe: {
		userId: string;
		person: Person;
		klassen: { klasse: Klasse; seit: string }[];
		fahrzeuge: Fahrzeug[];
	},
	dateien: Datei[],
	basisUrl: string
): Promise<{ mailOk: boolean }> {
	const col = await sammlung();
	const ablage = dateiablage();
	const { token, pruefung } = neuePruefung('og');
	const jetzt = new Date();

	const antrag: AntragDoc = {
		_id: new ObjectId(),
		...eingabe,
		eingegangenAm: jetzt,
		status: 'eingereicht',
		bestaetigtKmPunkte: true,
		dokumente: [],
		og: null,
		bezirk: null,
		nachweise: [],
		abschluss: null,
		pruefung,
		verlauf: [{ am: jetzt, text: 'Antrag eingereicht' }]
	};

	const hochgeladen: ObjectId[] = [];
	try {
		for (const d of dateien) {
			const id = await hochladen(ablage, d);
			hochgeladen.push(id);
			antrag.dokumente.push({ id: id.toHexString(), art: d.art, name: d.name, typ: d.typ, groesse: d.daten.length });
		}
		await col.insertOne(antrag);
	} catch (e) {
		// Ohne Antrag keine verwaisten Ausweiskopien in der Datenbank lassen.
		await Promise.all(hochgeladen.map((id) => ablage.delete(id).catch(() => {})));
		throw e;
	}

	await funktionenSetzen(eingabe.userId, { inkfausb: true });
	return { mailOk: await pruefungMailen(antrag, pruefung, token, basisUrl) };
}

/** Prüf-Link erneut verschicken – höchstens einmal am Tag, der alte Link verfällt. */
export async function erinnern(userId: string, basisUrl: string): Promise<Ergebnis> {
	const a = await aktuellerAntrag(userId);
	if (!a?.pruefung) return fehler('Gerade wartet niemand auf eine Entscheidung.');
	if (ansicht(a).erinnerungAb) return fehler('Eine Erinnerung ist nur einmal am Tag möglich.');

	const { token, pruefung } = neuePruefung(a.pruefung.stufe);
	const r = await antraege().updateOne(
		{ _id: a._id, 'pruefung.tokenHash': a.pruefung.tokenHash },
		{ $set: { pruefung } }
	);
	if (r.modifiedCount === 0) return fehler('Der Antrag wurde inzwischen bearbeitet. Bitte Seite neu laden.');

	if (!(await pruefungMailen(a, pruefung, token, basisUrl))) {
		return fehler('Die Mail konnte nicht verschickt werden. Bitte später noch einmal versuchen.');
	}
	await antraege().updateOne(
		{ _id: a._id },
		{ $push: { verlauf: { am: new Date(), text: 'Erinnerung verschickt' } } }
	);
	return { ok: true };
}

// ────────────────────────────────────────────────────────── Entscheidungen

/**
 * Setzt den Status nur, wenn der Antrag noch im erwarteten Zustand ist und
 * der Link noch gilt. Ein doppelter Klick oder ein zweites Fenster ändert so nichts.
 */
async function uebergang(
	a: AntragDoc,
	von: Status,
	set: Partial<AntragDoc>,
	text: string
): Promise<boolean> {
	const r = await antraege().updateOne(
		{ _id: a._id, status: von, 'pruefung.tokenHash': a.pruefung?.tokenHash ?? null },
		{ $set: set, $push: { verlauf: { am: new Date(), text } } }
	);
	return r.modifiedCount === 1;
}

const VERALTET = 'Über diesen Antrag wurde bereits entschieden. Bitte Seite neu laden.';

export async function ogEntscheiden(
	token: string,
	befuerwortet: boolean,
	bemerkung: string | null,
	basisUrl: string
): Promise<Ergebnis> {
	const a = await antragPerToken(token);
	if (!a || a.pruefung?.stufe !== 'og' || a.status !== 'eingereicht') return fehler(VERALTET);
	if (!befuerwortet && !bemerkung) return fehler('Bitte kurz begründen, warum der Antrag abgelehnt wird.');

	const og = { befuerwortet, am: new Date(), bemerkung };

	if (!befuerwortet) {
		const ok = await uebergang(a, 'eingereicht', { status: 'abgelehnt', og, pruefung: null }, `Von der Ortsgruppe abgelehnt: ${bemerkung}`);
		if (!ok) return fehler(VERALTET);
		await funktionenSetzen(a.userId, { inkfausb: false });
		return { ok: true };
	}

	const { token: neu, pruefung } = neuePruefung('bezirk');
	const ok = await uebergang(a, 'eingereicht', { status: 'og_befuerwortet', og, pruefung }, 'Von der Ortsgruppe befürwortet');
	if (!ok) return fehler(VERALTET);
	await pruefungMailen(a, pruefung, neu, basisUrl);
	return { ok: true };
}

export async function bezirkEntscheiden(
	token: string,
	eingabe: {
		genehmigt: boolean;
		checkliste: Checkliste;
		vorlageAm: string | null;
		vorlageBei: string | null;
		bemerkung: string | null;
	}
): Promise<Ergebnis> {
	const a = await antragPerToken(token);
	if (!a || a.pruefung?.stufe !== 'bezirk' || a.status !== 'og_befuerwortet') return fehler(VERALTET);

	if (eingabe.genehmigt) {
		const offen = CHECKLISTE.filter((p) => !eingabe.checkliste[p.schluessel]);
		if (offen.length) return fehler(`Zum Genehmigen fehlt noch: ${offen.map((p) => p.text).join(', ')}.`);
		if (alterAm(a.person.geburtsdatum) < MINDESTALTER) {
			return fehler(`Die Einsatzkraft ist jünger als ${MINDESTALTER} Jahre.`);
		}
	} else if (!eingabe.bemerkung) {
		return fehler('Bitte kurz begründen, warum der Antrag abgelehnt wird.');
	}
	if (eingabe.vorlageAm && !istDatum(eingabe.vorlageAm)) return fehler('„Vorlage am" ist kein gültiges Datum.');

	const bezirk = { ...eingabe, am: new Date() };

	if (!eingabe.genehmigt) {
		const ok = await uebergang(a, 'og_befuerwortet', { status: 'abgelehnt', bezirk, pruefung: null }, `Vom Bezirk abgelehnt: ${eingabe.bemerkung}`);
		if (!ok) return fehler(VERALTET);
		await funktionenSetzen(a.userId, { inkfausb: false });
		return { ok: true };
	}

	const ok = await uebergang(
		a,
		'og_befuerwortet',
		{ status: 'in_ausbildung', bezirk, pruefung: null },
		'Vom Bezirk genehmigt – die Ausbildung kann beginnen'
	);
	return ok ? { ok: true } : fehler(VERALTET);
}

export async function abschlussEntscheiden(
	token: string,
	eingabe: {
		bestaetigt: boolean;
		fahrzeugeErteilt: Fahrzeug[];
		punkte: Abschlusspunkte;
		bemerkung: string | null;
	}
): Promise<Ergebnis> {
	const a = await antragPerToken(token);
	if (!a || a.pruefung?.stufe !== 'abschluss' || a.status !== 'ausbildung_fertig') return fehler(VERALTET);

	if (!eingabe.bestaetigt) {
		if (!eingabe.bemerkung) return fehler('Bitte angeben, was in der Ausbildung noch fehlt.');
		const ok = await uebergang(
			a,
			'ausbildung_fertig',
			{ status: 'in_ausbildung', pruefung: null },
			`Zurück in die Ausbildung: ${eingabe.bemerkung}`
		);
		return ok ? { ok: true } : fehler(VERALTET);
	}

	const stand = fortschritt(a.fahrzeuge, a.nachweise);
	if (!stand.fertig) return fehler('Es sind noch nicht alle Ausbildungseinheiten abgezeichnet.');

	const erteilt = eingabe.fahrzeugeErteilt.filter((f) => a.fahrzeuge.includes(f));
	if (erteilt.length === 0) return fehler('Bitte mindestens ein Fahrzeug auswählen, für das die Berechtigung gilt.');

	const offen = ABSCHLUSSPUNKTE.filter((p) => !eingabe.punkte[p.schluessel]);
	if (offen.length) return fehler(`Zum Abschließen fehlt noch: ${offen.map((p) => p.text).join(', ')}.`);

	const ok = await uebergang(
		a,
		'ausbildung_fertig',
		{
			status: 'abgeschlossen',
			pruefung: null,
			abschluss: { am: new Date(), fahrzeugeErteilt: erteilt, punkte: eingabe.punkte, bemerkung: eingabe.bemerkung }
		},
		`Ausbildung abgeschlossen – Fahrberechtigung für ${erteilt.join(', ')}`
	);
	if (!ok) return fehler(VERALTET);

	await funktionenSetzen(a.userId, { kf: true, inkfausb: false });
	return { ok: true };
}

// ──────────────────────────────────────────────────────────── Ausbilder

export async function offeneAusbildungen(ausbilderId: string) {
	const liste = await (await sammlung())
		.find({ status: { $in: ['in_ausbildung', 'ausbildung_fertig'] }, userId: { $ne: ausbilderId } })
		.sort({ eingegangenAm: 1 })
		.toArray();

	return liste.map((a) => {
		const f = fortschritt(a.fahrzeuge, a.nachweise);
		return {
			id: a._id.toHexString(),
			name: `${a.person.vorname} ${a.person.name}`,
			einsatzgruppe: a.person.einsatzgruppe,
			fahrzeuge: a.fahrzeuge,
			status: a.status,
			erledigt: f.erledigt,
			gesamt: f.gesamt,
			ueOffen: f.ueOffen
		};
	});
}

/**
 * Sind alle Einheiten erbracht, geht die Abnahme-Anfrage an den Bezirk.
 * Läuft nach jedem Eintrag; der bedingte Update sorgt dafür, dass bei zwei
 * gleichzeitigen Einträgen nur eine Mail rausgeht.
 */
export async function abnahmeAnstossen(antragId: ObjectId, basisUrl: string): Promise<boolean> {
	const a = await antraege().findOne({ _id: antragId });
	if (!a || a.status !== 'in_ausbildung' || !fortschritt(a.fahrzeuge, a.nachweise).fertig) return false;

	const { token, pruefung } = neuePruefung('abschluss');
	const ok = await uebergang(
		a,
		'in_ausbildung',
		{ status: 'ausbildung_fertig', pruefung },
		'Alle Ausbildungseinheiten erbracht – Abnahme beim Bezirk angefragt'
	);
	if (ok) await pruefungMailen(a, pruefung, token, basisUrl);
	return ok;
}

export async function nachweisEintragen(
	antragId: string,
	ausbilder: { id: string; name: string },
	einheitId: string,
	datum: string,
	ue: number,
	basisUrl: string
): Promise<Ergebnis<{ abnahme: boolean }>> {
	const a = await antragPerId(antragId);
	if (!a || a.status !== 'in_ausbildung') {
		return fehler('Für diese Ausbildung lassen sich gerade keine Einheiten eintragen.');
	}
	if (a.userId === ausbilder.id) return fehler('Die eigene Ausbildung kann nicht selbst abgezeichnet werden.');

	const einheit = pflichtEinheiten(a.fahrzeuge).find((e) => e.id === einheitId);
	if (!einheit) return fehler('Diese Einheit gehört nicht zur Ausbildung.');
	if (!istDatum(datum) || datum > heuteISO()) return fehler('Bitte ein Datum bis heute wählen.');
	if (!Number.isInteger(ue) || ue < einheit.ue || ue > 20) {
		return fehler(`Bitte mindestens ${einheit.ue} UE eintragen.`);
	}

	const r = await antraege().updateOne(
		{ _id: a._id, status: 'in_ausbildung', 'nachweise.einheitId': { $ne: einheitId } },
		{
			$push: {
				nachweise: { einheitId, datum, ue, ausbilderId: ausbilder.id, ausbilderName: ausbilder.name }
			}
		}
	);
	if (r.modifiedCount === 0) return fehler('Diese Einheit wurde inzwischen schon abgezeichnet.');

	return { ok: true, abnahme: await abnahmeAnstossen(a._id, basisUrl) };
}

export async function nachweisEntfernen(
	antragId: string,
	ausbilderId: string,
	einheitId: string
): Promise<Ergebnis> {
	const a = await antragPerId(antragId);
	if (!a || a.status !== 'in_ausbildung') return fehler('Einträge lassen sich gerade nicht ändern.');

	const eintrag = a.nachweise.find((n) => n.einheitId === einheitId && n.ausbilderId === ausbilderId);
	if (!eintrag) return fehler('Zurücknehmen lassen sich nur eigene Einträge.');

	// Den gespeicherten Eintrag vollständig angeben – das funktioniert in jeder MongoDB-Version gleich.
	const r = await antraege().updateOne(
		{ _id: a._id, status: 'in_ausbildung' },
		{ $pull: { nachweise: eintrag } }
	);
	return r.modifiedCount ? { ok: true } : fehler('Der Eintrag wurde inzwischen geändert. Bitte Seite neu laden.');
}

// ──────────────────────────────────────────────────────────── Dokumente

export async function dokumentLesen(a: AntragDoc, dokumentId: string) {
	const d = a.dokumente.find((x) => x.id === dokumentId);
	if (!d) return null;
	const teile: Buffer[] = [];
	for await (const teil of dateiablage().openDownloadStream(new ObjectId(d.id))) teile.push(teil as Buffer);
	return { name: d.name, typ: d.typ, daten: Buffer.concat(teile) };
}
