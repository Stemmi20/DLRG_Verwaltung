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
		? {
				...result,
				// Der Tracker schickt den Namen mit: {"name":"Fahrzeug 1","lat":…,"lon":…}
				name: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : undefined,
				speed: data.speed ?? data.velocity,
				timestamp: data.timestamp ?? data.time,
			}
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