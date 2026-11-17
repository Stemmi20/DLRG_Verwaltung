import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
	return {
		user: locals.user,
		// Eingeklappt oder nicht – steht im Cookie, damit die Seite nicht springt.
		seitenleisteZu: cookies.get('seitenleiste') === 'zu',
	};
};
