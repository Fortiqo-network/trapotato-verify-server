// Applies db/schema.sql to the configured PostgreSQL database.
// Usage:  npm run db:init
//
// Reads DATABASE_URL / DB_SCHEMA / DB_SSL from `.env` (loaded via dotenv).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));

function normalizeUrl(url) {
  if (!url) return url;
  // Strip SQLAlchemy-style driver suffix: postgresql+asyncpg -> postgresql
  let u = url.replace(/^(postgres(?:ql)?)\+[a-z0-9]+:/i, '$1:');
  const q = u.indexOf('?');
  if (q !== -1) u = u.slice(0, q);
  return u;
}

const url = normalizeUrl(process.env.DATABASE_URL);
if (!url) {
  console.error('[init-db] DATABASE_URL is not set. Create a .env file first.');
  process.exit(1);
}

const ssl = process.env.DB_SSL === 'require' ? { rejectUnauthorized: false } : undefined;
const sql = readFileSync(join(__dirname, '..', 'db', 'schema.sql'), 'utf8');

const client = new pg.Client({ connectionString: url, ssl });

try {
  console.log('[init-db] Connecting...');
  await client.connect();
  console.log('[init-db] Applying schema...');
  await client.query(sql);
  console.log('[init-db] Done. Schema "%s" is ready.', process.env.DB_SCHEMA || 'trapotato');
} catch (err) {
  console.error('[init-db] Failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
