import { redirect } from '@sveltejs/kit';
import { boote } from '$lib/server/bootstagebuch';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/login?weiter=/bootstagebuch');
	return { boote: await boote() };
};