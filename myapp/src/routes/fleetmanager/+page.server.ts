import { env } from '$env/dynamic/private';
import type { PageServerLoad } from './$types';

/** Nur falls MQTT_BROKER in der .env fehlt. */
const ERSATZ_BROKER = 'wss://broker.hivemq.com:8884/mqtt';

/**
 * Die Broker-Adresse steht in der .env als MQTT_BROKER. Der Browser kommt an
 * .env-Werte nicht heran – deshalb gibt der Server sie hier an die Seite weiter.
 * Sie muss mit ws:// oder wss:// beginnen, mqtt:// geht im Browser nicht.
 */
export const load: PageServerLoad = () => {
	const brokerUrl = env.MQTT_BROKER?.trim() || ERSATZ_BROKER;
	if (!/^wss?:\/\//.test(brokerUrl)) {
		console.warn(`[fleetmanager] MQTT_BROKER="${brokerUrl}" – der Browser braucht ws:// oder wss://.`);
	}
	return { brokerUrl };
};