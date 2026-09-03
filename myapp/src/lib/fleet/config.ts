import type { AppConfig, Vehicle } from './types';
export const defaultConfig: AppConfig = {
	username: 'Admin',
	password: 'Test1234!',
	brokerUrl: 'wss://broker.hivemq.com:8884/mqtt',
	topic: 'tracker/tracker-01/position',
	mapCenter: null,
	mapZoom: null,
};
export const initialVehicles: Vehicle[] = [
	{
		id: 'tracker-01',
		name: 'Tracker 01',
		callSign: 'MQTT · tracker-01',
		status: 'offline',
		label: 'Warte auf Signal',
		serviceStatus: 'available',
		lat: null,
		lng: null,
		address: 'Noch keine Positionsmeldung',
		updated: 'Noch nie',
		speed: '—',
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
