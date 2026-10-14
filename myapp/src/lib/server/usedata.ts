import { MongoClient } from 'mongodb';
import { MONGODB_URI } from '$env/static/private';
import { building } from '$app/environment';

const client = new MongoClient(MONGODB_URI);

if (!building) {
	await client.connect();
	console.log('MongoDB Connected successfully');
}

const db = client.db('User');
export const collection = db.collection('User');