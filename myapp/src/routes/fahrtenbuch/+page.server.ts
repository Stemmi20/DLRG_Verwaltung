import { redirect } from '@sveltejs/kit';
import { fahrzeugeMitStand } from '$lib/server/fahrtenbuch';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/login?weiter=/fahrtenbuch');
	return { fahrzeuge: await fahrzeugeMitStand() };
};