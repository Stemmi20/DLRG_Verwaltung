import type { ParsedPosition, RoutePoint } from './types';

export function parsePosition(payload: string): ParsedPosition | null {
	const text = String(payload).trim();
	let data: Record<string, any>;
	try {
		data = JSON.parse(text);
	} catch {
		const p = text.split(/[;,\s]+/).map(Number);
		return p.length >= 2 && p.every(Number.isFinite) ? valid(p[0], p[1]) : null;
	}
	const c = data.geometry?.coordinates;
	const result = valid(
		Number(data.lat ?? data.latitude ?? data.position?.lat ?? c?.[1]),
		Number(
			data.lng ?? data.lon ?? data.longitude ?? data.position?.lng ?? data.position?.lon ?? c?.[0],
		),
	);
	return result
		? { ...result, speed: data.speed ?? data.velocity, timestamp: data.timestamp ?? data.time }
		: null;
}
function valid(lat: number, lng: number): Pick<RoutePoint, 'lat' | 'lng'> | null {
	return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
		? { lat, lng }
		: null;
}

export function distanceMeters(
	first: Pick<RoutePoint, 'lat' | 'lng'>,
	second: Pick<RoutePoint, 'lat' | 'lng'>,
): number {
	const radians = (value: number) => (value * Math.PI) / 180;
	const deltaLat = radians(second.lat - first.lat);
	const deltaLng = radians(second.lng - first.lng);
	const a =
		Math.sin(deltaLat / 2) ** 2 +
		Math.cos(radians(first.lat)) * Math.cos(radians(second.lat)) * Math.sin(deltaLng / 2) ** 2;
	return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function calculatedSpeed(points: RoutePoint[]): number | null {
	if (points.length < 2) return 0;
	let distance = 0;
	for (let index = 1; index < points.length; index++)
		distance += distanceMeters(points[index - 1], points[index]);
	const seconds = (points.at(-1)!.time - points[0].time) / 1000;
	if (seconds <= 0 || distance < 3) return 0;
	const speed = (distance / seconds) * 3.6;
	return speed <= 180 ? speed : null;
}

/* ─────────────────────────── Koppelnavigation ─────────────────────────── */

/**
 * Rechtweisender Kurs von einem Punkt zum nächsten, in Grad (0 = Nord).
 * Anfangspeilung der Großkreisstrecke – auf Bodensee-Entfernungen praktisch
 * dasselbe wie eine Kartenpeilung, aber ohne Sonderfall an den Polen.
 */
export function kursGrad(
	von: Pick<RoutePoint, 'lat' | 'lng'>,
	nach: Pick<RoutePoint, 'lat' | 'lng'>,
): number {
	const bogen = (wert: number) => (wert * Math.PI) / 180;
	const deltaLng = bogen(nach.lng - von.lng);
	const lat1 = bogen(von.lat);
	const lat2 = bogen(nach.lat);
	const y = Math.sin(deltaLng) * Math.cos(lat2);
	const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
	return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

/** Zielpunkt aus Startpunkt, Kurs und Distanz. */
export function zielpunkt(
	start: Pick<RoutePoint, 'lat' | 'lng'>,
	kurs: number,
	meter: number,
): { lat: number; lng: number } {
	const bogen = (wert: number) => (wert * Math.PI) / 180;
	const grad = (wert: number) => (wert * 180) / Math.PI;
	const R = 6371000;
	const d = meter / R;
	const lat1 = bogen(start.lat);
	const lng1 = bogen(start.lng);
	const k = bogen(kurs);

	const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(k));
	const lng2 =
		lng1 +
		Math.atan2(
			Math.sin(k) * Math.sin(d) * Math.cos(lat1),
			Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
		);

	return { lat: grad(lat2), lng: ((grad(lng2) + 540) % 360) - 180 };
}

/** Unter dieser Fahrt gilt das Boot als liegend – GPS rauscht auch im Stand. */
const MINDESTFAHRT_KMH = 2;

/** Darüber ist etwas faul; ein Boot fährt keine 120 km/h. */
const HOECHSTFAHRT_KMH = 120;

export interface Prognose {
	ziel: { lat: number; lng: number };
	/** Rechtweisender Kurs in Grad. */
	kurs: number;
	/** Zugrunde gelegte Fahrt in km/h. */
	fahrt: number;
	/** Zurückgelegte Strecke im Vorhersagezeitraum, in Metern. */
	meter: number;
}

/**
 * Koppelnavigation: Wo ist das Boot in `sekunden`, wenn es Kurs und Fahrt
 * beibehält?
 *
 * Kurs und Fahrt werden aus den letzten Positionen gerechnet, weil der
 * Tracker beides nicht mitschickt. Das ist eine reine Fortschreibung – kein
 * Kurswechsel, keine Strömung, kein Wind. Bei ruhiger Fahrt brauchbar, in
 * einer Drehung wertlos.
 *
 * Gibt null zurück, wenn das Boot steht oder die Datenlage nicht reicht.
 */
export function prognose(punkte: RoutePoint[], sekunden = 600): Prognose | null {
	if (punkte.length < 2) return null;

	const jetzt = punkte.at(-1)!;

	/*
	 * Nicht nur die letzten zwei Punkte: eine einzelne Messung springt leicht
	 * um ein paar Meter und dreht den Kurs dann um Dutzende Grad. Über die
	 * letzten vier Punkte gemittelt bleibt die Linie ruhig.
	 */
	const fenster = punkte.slice(-4);
	const start = fenster[0];

	const sekundenGefahren = (jetzt.time - start.time) / 1000;
	if (sekundenGefahren <= 0) return null;

	const strecke = distanceMeters(start, jetzt);
	const fahrt = (strecke / sekundenGefahren) * 3.6;
	if (fahrt < MINDESTFAHRT_KMH || fahrt > HOECHSTFAHRT_KMH) return null;

	const kurs = kursGrad(start, jetzt);
	const meter = (fahrt / 3.6) * sekunden;

	return { ziel: zielpunkt(jetzt, kurs, meter), kurs, fahrt, meter };
}