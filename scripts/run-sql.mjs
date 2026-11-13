// Runs one .sql file against DATABASE_URL from .env, in a single transaction.
// Usage: node scripts/run-sql.mjs scripts/migrate-step5.sql
import { readFileSync } from 'node:fs';
import pg from 'pg';

const file = process.argv[2];
if (!file) throw new Error('Usage: node scripts/run-sql.mjs <file.sql>');
const env = Object.fromEntries(
	readFileSync('.env', 'utf8')
		.split(/\r?\n/)
		.map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/))
		.filter(Boolean)
		.map((m) => [m[1], m[2]])
);
const url = process.env.DATABASE_URL ?? env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
	await client.query('BEGIN');
	await client.query(readFileSync(file, 'utf8'));
	await client.query('COMMIT');
	const { rows } = await client.query(
		'SELECT kind, count(*)::int AS n FROM car_events GROUP BY kind'
	);
	console.log('applied', file, rows);
} catch (e) {
	await client.query('ROLLBACK');
	throw e;
} finally {
	await client.end();
}
