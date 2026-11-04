import { ObjectId, type Filter } from 'mongodb';
import { db } from './database';
import { collection as benutzer } from './usedata';
import {
	FILTER,
	FREI,
	KURZ_MAX,
	LANG_MAX,
	STATUS,
	type AufgabeAnsicht,
	type AufgabeStatus,
	type FilterName,
	type Statistik,
} from '$lib/aufgaben';

/**
 * RWS-Aufgaben in MongoDB. Dieselbe Collection füllt auch der Telegram-Bot –
 * die Felder heißen deshalb genau wie bei ihm.
 *
 * Liegt die Collection bei dir in einer anderen Datenbank, hier ändern,
 * z. B. `client.db('User').collection('Aufgaben')`.
 */
export interface AufgabeDoc {
	_id?: ObjectId;
	aufgabenID: number;
	kurzDescr: string;
	langDescr: string;
	ortsgruppe: string;
	status: AufgabeStatus;
	/** Telegram-ID dessen, der sie gerade bearbeitet (so kennt ihn der Bot). */
	ausfuehrenderID?: number | null;
	/**
	 * Benutzer-_id (als Text) dessen, der sie über die Webseite übernommen hat.
	 * Damit klappt das Zuweisen auch bei Konten ohne Telegram-ID.
	 */
	ausfuehrenderUserId?: string | null;
	/** Nachricht des Bots an den Bearbeiter – nur vom Bot gesetzt. */
	ausfuehrenderMessageID?: number | null;
	/** Zeitstempel (ms, als Text) → Eintrag. */
	log?: Record<string, string>;
	/** Telegram-ID → Nachricht des Bots. Nur vom Bot gepflegt. */
	users?: Record<string, number>;
}

const aufgaben = db.collection<AufgabeDoc>('Aufgaben');

/** Wer gerade etwas tut – kommt aus der Sitzung. */
export interface Handelnder {
	/** _id des angemeldeten Benutzers – daran erkennt die Seite, wer man ist. */
	userId: string;
	/** Zusätzlich, falls im Benutzer hinterlegt – für den Bot. */
	telegramID: number | null;
	name: string;
	ortsgruppe: string;
	istAdmin: boolean;
}

export type Ergebnis = { ok: true } | { ok: false; fehler: string };

/**
 * Bin ich der Bearbeiter? Über die Webseite übernommen → Benutzer-_id,
 * über den Bot übernommen → Telegram-ID.
 */
function vonMir(ich: Handelnder): Filter<AufgabeDoc> {
	const oder: Filter<AufgabeDoc>[] = [{ ausfuehrenderUserId: ich.userId }];
	if (ich.telegramID !== null) oder.push({ ausfuehrenderID: ich.telegramID });
	return { $or: oder };
}

/** Die Telegram-ID aus dem Benutzerdatensatz – als Zahl, egal wie gespeichert. */
export async function telegramIdVon(userId: string): Promise<number | null> {
	if (!ObjectId.isValid(userId)) return null;
	const b = await benutzer.findOne({ _id: new ObjectId(userId) }, { projection: { telegramID: 1 } });
	const tid = Number(b?.telegramID);
	return Number.isFinite(tid) && tid > 0 ? tid : null;
}

function logEintrag(text: string): Record<string, string> {
	return { [`log.${Date.now()}`]: text };
}

// ------------------------------------------------------------------ Lesen

export async function statistik(ich: Handelnder): Promise<Statistik> {
	const zahlen = await aufgaben
		.aggregate<{ _id: AufgabeStatus; n: number }>([
			{ $match: { ortsgruppe: ich.ortsgruppe } },
			{ $group: { _id: '$status', n: { $sum: 1 } } },
		])
		.toArray();
	const n = (s: AufgabeStatus) => zahlen.find((z) => z._id === s)?.n ?? 0;

	const meine = await aufgaben.countDocuments({
		ortsgruppe: ich.ortsgruppe,
		status: 'TAKEN',
		...vonMir(ich),
	});

	return {
		offen: n('OPEN') + n('PENDING'),
		zurueckgegeben: n('PENDING'),
		bearbeitung: n('TAKEN'),
		erledigt: n('DONE'),
		meine,
	};
}

export async function liste(ich: Handelnder, filter: FilterName): Promise<AufgabeAnsicht[]> {
	const docs = await aufgaben
		.find({ ortsgruppe: ich.ortsgruppe, status: { $in: [...FILTER[filter].status] } })
		.sort({ aufgabenID: -1 })
		.limit(300)
		.toArray();

	// Namen der Bearbeiter in einem Rutsch aus der Benutzer-Collection –
	// über die Benutzer-_id (Webseite) oder die Telegram-ID (Bot).
	const telegramIds = [
		...new Set(docs.map((d) => d.ausfuehrenderID).filter((id): id is number => typeof id === 'number')),
	];
	const userIds = [
		...new Set(
			docs.map((d) => d.ausfuehrenderUserId).filter((id): id is string => !!id && ObjectId.isValid(id)),
		),
	];
	const nachTelegram = new Map<number, string>();
	const nachUser = new Map<string, string>();
	if (telegramIds.length || userIds.length) {
		const leute = await benutzer
			.find(
				{
					$or: [
						{ telegramID: { $in: telegramIds } },
						{ _id: { $in: userIds.map((id) => new ObjectId(id)) } },
					],
				},
				{ projection: { telegramID: 1, vorname: 1, nachname: 1 } },
			)
			.toArray();
		for (const p of leute) {
			const name = `${p.vorname ?? ''} ${p.nachname ?? ''}`.trim() || 'Unbekannt';
			nachUser.set(p._id.toString(), name);
			if (p.telegramID !== undefined) nachTelegram.set(Number(p.telegramID), name);
		}
	}

	return docs.map((d) => {
		const status: AufgabeStatus = (STATUS as readonly string[]).includes(d.status) ? d.status : 'OPEN';
		const hatBearbeiter = status === 'TAKEN' && (!!d.ausfuehrenderUserId || typeof d.ausfuehrenderID === 'number');
		const meine =
			hatBearbeiter &&
			(d.ausfuehrenderUserId === ich.userId ||
				(ich.telegramID !== null && d.ausfuehrenderID === ich.telegramID));
		const bearbeiter = !hatBearbeiter
			? null
			: ((d.ausfuehrenderUserId && nachUser.get(d.ausfuehrenderUserId)) ||
				(typeof d.ausfuehrenderID === 'number' && nachTelegram.get(d.ausfuehrenderID)) ||
				'Unbekannt');
		return {
			aufgabenID: d.aufgabenID,
			kurz: d.kurzDescr ?? '',
			lang: d.langDescr ?? '',
			status,
			bearbeiter,
			meine,
			erstelltAm: new Date(d.aufgabenID).toISOString(),
			verlauf: Object.entries(d.log ?? {})
				.map(([zeit, text]) => ({ zeit: Number(zeit), text }))
				.filter((e) => Number.isFinite(e.zeit))
				// Der Bot schreibt die Schlüssel nicht sortiert – hier ordnen.
				.sort((a, b) => b.zeit - a.zeit)
				.map((e) => ({ am: new Date(e.zeit).toISOString(), text: e.text })),
		};
	});
}

// --------------------------------------------------------------- Schreiben

export async function erstellen(ich: Handelnder, kurz: string, lang: string): Promise<Ergebnis> {
	kurz = kurz.trim();
	lang = lang.trim();
	if (!ich.ortsgruppe) return { ok: false, fehler: 'Deinem Konto ist keine Ortsgruppe zugeordnet.' };
	if (!kurz) return { ok: false, fehler: 'Bitte einen Titel angeben.' };
	if (kurz.length > KURZ_MAX) return { ok: false, fehler: `Der Titel darf höchstens ${KURZ_MAX} Zeichen haben.` };
	if (lang.length > LANG_MAX) return { ok: false, fehler: `Die Beschreibung ist zu lang.` };

	const jetzt = Date.now();
	await aufgaben.insertOne({
		aufgabenID: jetzt,
		kurzDescr: kurz,
		langDescr: lang,
		ortsgruppe: ich.ortsgruppe,
		status: 'OPEN',
		log: { [String(jetzt)]: `Benutzer ${ich.name} hat die Aufgabe über die Webseite erstellt` },
		users: {},
	});
	return { ok: true };
}

/**
 * Sich selbst zuweisen. Die Bedingung „noch frei" steckt im Filter von
 * updateOne – klicken zwei gleichzeitig, gewinnt genau einer.
 */
export async function uebernehmen(ich: Handelnder, aufgabenID: number): Promise<Ergebnis> {
	// Die Telegram-ID nur mitschreiben, wenn es eine gibt – sonst bleibt
	// ausfuehrenderID leer und die Aufgabe gehört über die Benutzer-_id dir.
	const telegram = ich.telegramID !== null ? { ausfuehrenderID: ich.telegramID } : {};
	const r = await aufgaben.updateOne(
		{ aufgabenID, ortsgruppe: ich.ortsgruppe, status: { $in: [...FREI] } },
		{
			$set: {
				status: 'TAKEN',
				ausfuehrenderUserId: ich.userId,
				...telegram,
				...logEintrag(`Benutzer ${ich.name} hat die Aufgabe übernommen`),
			},
			// Gehört zur Bot-Nachricht bzw. zum früheren Bearbeiter.
			$unset:
				ich.telegramID !== null
					? { ausfuehrenderMessageID: '' }
					: { ausfuehrenderMessageID: '', ausfuehrenderID: '' },
		},
	);
	return r.matchedCount
		? { ok: true }
		: { ok: false, fehler: 'Die Aufgabe hat sich schon jemand anderes genommen.' };
}

/** Wieder abgeben → PENDING. Darf der Bearbeiter selbst oder ein Admin. */
export async function abgeben(ich: Handelnder, aufgabenID: number): Promise<Ergebnis> {
	const freigeben = (wer: object, text: string) =>
		aufgaben.updateOne(
			{ aufgabenID, ortsgruppe: ich.ortsgruppe, status: 'TAKEN', ...wer },
			{
				$set: { status: 'PENDING', ...logEintrag(text) },
				$unset: { ausfuehrenderID: '', ausfuehrenderUserId: '', ausfuehrenderMessageID: '' },
			},
		);

	// Erst als Bearbeiter – so steht im Verlauf derselbe Satz wie beim Bot.
	let r = await freigeben(vonMir(ich), `Benutzer ${ich.name} kann nicht.`);
	// Ein Admin darf auch fremde Aufgaben freigeben, die jemand liegen lässt.
	if (!r.matchedCount && ich.istAdmin) {
		r = await freigeben({}, `Admin ${ich.name} hat die Aufgabe wieder freigegeben`);
	}
	return r.matchedCount
		? { ok: true }
		: { ok: false, fehler: 'Die Aufgabe ist nicht (mehr) dir zugewiesen.' };
}

/** Abschließen. Nur wer sie gerade bearbeitet. */
export async function erledigen(ich: Handelnder, aufgabenID: number): Promise<Ergebnis> {
	const r = await aufgaben.updateOne(
		{ aufgabenID, ortsgruppe: ich.ortsgruppe, status: 'TAKEN', ...vonMir(ich) },
		{ $set: { status: 'DONE', ...logEintrag(`Benutzer ${ich.name} hat die Aufgabe erledigt`) } },
	);
	return r.matchedCount
		? { ok: true }
		: { ok: false, fehler: 'Die Aufgabe ist nicht (mehr) dir zugewiesen.' };
}