import type { AppConfig, Vehicle } from './types';

export const appConfig: AppConfig = {
	brokerUrl: 'wss://broker.hivemq.com:8884/mqtt',
	topic: 'tracker/tracker-01/position',
	username: '',
	password: '',
	mapCenter: [47.6503, 9.4797],
	mapZoom: 13,
};

export const defaultVehicles: Vehicle[] = [
	{
		id: 'fahrzeug-1',
		// Platzhalter bis zur ersten MQTT-Meldung.
		name: 'Fahrzeug 1',
		callSign: 'Pelikan Bodensee 3/94-1',
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
	},
];