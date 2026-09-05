import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { DATABASE_URL } from '$env/static/private';

/*
 * Der Prisma-Client liegt bewusst in einem eigenen Modul: `fahrtenbuch.ts`
 * zieht über `database.ts` den MongoClient mit rein, und den braucht die
 * MQTT-Anbindung nicht.
 *
 * Vite lädt Servermodule bei jeder Änderung neu – ohne den Umweg über
 * globalThis entstünde im Dev-Betrieb mit jedem Speichern ein neuer Pool.
 */
const G = globalThis as typeof globalThis & { __prisma?: PrismaClient };

export const prisma =
	G.__prisma ??
	new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });

if (import.meta.env.DEV) G.__prisma = prisma;