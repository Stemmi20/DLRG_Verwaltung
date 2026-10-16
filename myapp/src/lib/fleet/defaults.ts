import type { AppConfig, Vehicle } from './types';

export const appConfig: AppConfig = {
	// Nur zur Info – der Server abonniert alle Tracker, siehe $lib/server/mqtt.ts.
	topic: 'tracker/+/position',
	mapCenter: [47.6503, 9.4797],
	mapZoom: 13,
};

/**
 * Ein Eintrag je Tracker. Die `id` ist die Nummer aus dem Topic
 * tracker/<id>/position – darüber ordnet die Seite die Meldungen zu.
 *
 * Neues Fahrzeug = eine Zeile ergänzen. Der Name ist nur ein Platzhalter:
 * schickt der Tracker im JSON ein `name` mit, wird der angezeigt.
 */
const TRACKER = [
	{ id: '3941', name: 'Fahrzeug 3/94-1', callSign: 'Pelikan Bodensee 3/94/1' },
	{ id: '3911', name: 'Fahrzeug 3/91-1', callSign: 'Pelikan Bodensee 3/91/1' },
	{ id: '3931', name: 'Fahrzeug 3/93-1', callSign: 'Pelikan Bodensee 3/93/1' },
	{ id: '3943', name: 'Fahrzeug 3/94-3', callSign: 'Pelikan Bodensee 3/94/3' },
] as const;

export const defaultVehicles: Vehicle[] = TRACKER.map((t) => ({
	id: t.id,
	name: t.name,
	callSign: t.callSign,
	status: 'offline',
	label: 'Offline',
	address: 'Noch keine Position empfangen',
	updated: '—',
	speed: '—',
	lat: NaN,
	lng: NaN,
	serviceStatus: 'available',
	loadout: [],
	standardCrew: [],
	maintenance: {
		tuvDue: '',
		uvvDue: '',
		lastService: '',
		nextService: '',
		serviceMileage: '',
		notes: '',
	},
	appointments: [],
}));

/** Unter dieser ID lag das eine Fahrzeug bisher – für die Übernahme alter Daten. */
export const ALTE_ID_3941 = 'fahrzeug-1';

export function istBoot(v: Pick<Vehicle, 'id'>): boolean {
	return /94\d$/.test(v.id);
}