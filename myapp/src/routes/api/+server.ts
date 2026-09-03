import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import DataBase from '$lib/server/database.js';
import { SECRET } from '$env/static/private';

const regex = /(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*\W)/;

function checkPassword(pass: string) {
	return regex.test(pass);
}

const saltRounds = 12;

export const POST: RequestHandler = async (req) => {
	const j = await req.request.json().catch(() => ({}));

	const { password, username, firstname, lastname } = j;

	if (!password || !username) {
		return error(400, 'No password or username provided');
	}

	if (!firstname?.length || !lastname?.length) {
		return error(400, 'First or Last name are Missing');
	}

	if (!checkPassword(password)) {
		return error(
			400,
			'Password is insecure! Password needs Uppercase, Lowercase, Number and Special characters'
		);
	}

	// MongoDB users Collection
	const users = DataBase.collection('users');

	// Prüfen, ob Benutzer bereits existiert
	const exists = await users.findOne(
		{ username },
		{ projection: { username: 1 } }
	);

	if (exists) {
		return error(400, 'Username Taken');
	}

	return json({ success: true });
};
