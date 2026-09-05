export type TrackerStatus = 'offline' | 'available' | 'mission';
export type ServiceStatus = 'available' | 'mission' | 'out-of-service' | 'workshop' | 'no-gps';
export type LoadoutState = 'present' | 'missing' | 'defective' | 'inspection';
export type ConnectionStatus = 'connecting' | 'online' | 'error';
export type AppView = 'home' | 'fleet' | 'map' | 'users';
export type UserRole = 'admin' | 'dispatcher' | 'viewer';

export interface RoutePoint {
	lat: number;
	lng: number;
	time: number;
}
export interface ParsedPosition {
	lat: number;
	lng: number;
	speed?: unknown;
	timestamp?: string | number;
}
export interface LoadoutItem {
	name: string;
	quantity: number;
	category: string;
	state: LoadoutState;
	expiry: string;
}
export interface CrewMember {
	name: string;
	role: string;
}
export interface Maintenance {
	tuvDue: string;
	uvvDue: string;
	lastService: string;
	nextService: string;
	serviceMileage: string | number;
	notes: string;
}
export interface Appointment {
	id: string;
	type: string;
	date: string;
	note: string;
}

export interface Vehicle {
	id: string;
	// name: string;
	callSign: string;
	status: TrackerStatus;
	label: string;
	serviceStatus: ServiceStatus;
	lat: number | null;
	lng: number | null;
	address: string;
	updated: string;
	speed: string;
	loadout: LoadoutItem[];
	standardCrew: CrewMember[];
	maintenance: Maintenance;
	appointments: Appointment[];
}

export type VehicleChanges = Pick<
	Vehicle,
	| 'id'
	// | 'name'
	| 'callSign'
	| 'serviceStatus'
	| 'loadout'
	| 'standardCrew'
	| 'maintenance'
	| 'appointments'
>;
export type StoredVehicleData = Omit<VehicleChanges, 'id'>;
export type StoredVehicleMap = Record<string, Partial<StoredVehicleData>>;

export interface AppConfig {
	username: string;
	password: string;
	brokerUrl: string;
	topic: string;
	mapCenter: [number, number] | null;
	mapZoom: number | null;
}
export interface ConnectionLogEntry {
	type: ConnectionStatus;
	message: string;
	time: string;
}

export interface FleetUser {
	id: string;
	username: string;
	displayName: string;
	role: UserRole;
	active: boolean;
	telegramUserId: string;
	permissions: string[];
	vehicleIds: string[];
	lastLogin: string | null;
}
export interface AccessArea {
	id: string;
	label: string;
}

export interface VehicleMapHandle {
	focus(id: string): void;
	fit(): void;
	locate(): void;
}
