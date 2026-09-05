const VEHICLE_KEY = 'dlrg-fleet-vehicle-data-v1';
const ROUTE_KEY = 'dlrg-fleet-route-history-v1';
const DAY = 24 * 60 * 60 * 1000;

function read<T>(key: string, fallback: T): T {
	if (typeof localStorage === 'undefined') return fallback;
	try {
		const value = localStorage.getItem(key);
		return value === null ? fallback : JSON.parse(value);
	} catch {
		return fallback;
	}
}

function write<T>(key: string, value: T): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		/* Speicher kann gesperrt sein. */
	}
}

export function loadVehicleData(): StoredVehicleMap {
	return read<StoredVehicleMap>(VEHICLE_KEY, {});
}
export function saveVehicleData(vehicles: Vehicle[]): void {
	write(
		VEHICLE_KEY,
		Object.fromEntries(
			vehicles.map((vehicle) => [
				vehicle.id,
				{
					// name: vehicle.name,
					callSign: vehicle.callSign,
					serviceStatus: vehicle.serviceStatus ?? 'available',
					loadout: vehicle.loadout ?? [],
					standardCrew: vehicle.standardCrew ?? [],
					maintenance: vehicle.maintenance ?? {},
					appointments: vehicle.appointments ?? [],
				},
			]),
		),
	);
}

export function pruneRoute(points: RoutePoint[], now = Date.now()): RoutePoint[] {
	return (Array.isArray(points) ? points : [])
		.filter(
			(point): point is RoutePoint =>
				Number.isFinite(point?.lat) &&
				Number.isFinite(point?.lng) &&
				Number.isFinite(point?.time) &&
				point.time >= now - DAY,
		)
		.sort((a, b) => a.time - b.time);
}

export function loadRouteHistory(): RoutePoint[] {
	return pruneRoute(read<RoutePoint[]>(ROUTE_KEY, []));
}
export function saveRouteHistory(points: RoutePoint[]): void {
	write(ROUTE_KEY, pruneRoute(points));
}
import type { RoutePoint, StoredVehicleMap, Vehicle } from './types';
