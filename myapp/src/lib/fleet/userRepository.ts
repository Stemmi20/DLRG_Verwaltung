// Austauschbare Datenquelle: Später werden nur diese Funktionen durch API-Aufrufe ersetzt.
const STORAGE_KEY = 'dlrg-fleet-users-v1';

export const areas: AccessArea[] = [
	{ id: 'dashboard', label: 'Dashboard' },
	{ id: 'map', label: 'Kartenansicht' },
	{ id: 'fleet', label: 'Fahrzeugübersicht' },
	{ id: 'loadout', label: 'Beladung' },
	{ id: 'crew', label: 'Besatzung' },
	{ id: 'maintenance', label: 'Wartung & Termine' },
	{ id: 'routes', label: 'Routenverlauf' },
	{ id: 'mqtt', label: 'MQTT-Protokoll' },
	{ id: 'users', label: 'Benutzerverwaltung' },
];

export const roleDefaults: Record<UserRole, string[]> = {
	admin: areas.map((area) => area.id),
	dispatcher: ['dashboard', 'map', 'fleet', 'loadout', 'crew', 'maintenance', 'routes', 'mqtt'],
	viewer: ['dashboard', 'map', 'fleet', 'routes'],
};

export const roleLabels: Record<UserRole, string> = {
	admin: 'Administrator',
	dispatcher: 'Einsatzleitung',
	viewer: 'Betrachter',
};

const initialUsers: FleetUser[] = [
	{
		id: 'administrator',
		username: 'Administrator',
		displayName: 'Administrator',
		role: 'admin',
		active: true,
		telegramUserId: '',
		permissions: [...roleDefaults.admin],
		vehicleIds: [],
		lastLogin: null,
	},
];

export async function listUsers(): Promise<FleetUser[]> {
	try {
		return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') ?? initialUsers;
	} catch {
		return initialUsers;
	}
}

export async function saveUsers(users: FleetUser[]): Promise<FleetUser[]> {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
	return users;
}

export function createUser(): FleetUser {
	return {
		id: globalThis.crypto?.randomUUID?.() ?? String(Date.now()),
		username: '',
		displayName: '',
		role: 'viewer',
		active: true,
		telegramUserId: '',
		permissions: [...roleDefaults.viewer],
		vehicleIds: [],
		lastLogin: null,
	};
}
import type { AccessArea, FleetUser, UserRole } from './types';
