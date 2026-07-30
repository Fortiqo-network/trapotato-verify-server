// PostgreSQL access layer (node-postgres). Node runtime only.
// A single pooled connection is reused across hot-reloads / requests.

import { Pool, type QueryResultRow } from 'pg';
import { config } from './config';

/** Convert a SQLAlchemy-style URL (postgresql+asyncpg://...) to a plain pg URL. */
function normalizeUrl(url: string): string {
  if (!url) return url;
  let u = url.replace(/^(postgres(?:ql)?)\+[a-z0-9]+:/i, '$1:');
  const q = u.indexOf('?');
  if (q !== -1) u = u.slice(0, q); // drop query — SSL is set via the `ssl` option
  return u;
}

// The schema is env-controlled (not user input), but validate it's a bare
// identifier so it can be safely interpolated into `SET LOCAL search_path`.
const SCHEMA = /^[A-Za-z_][A-Za-z0-9_]*$/.test(config.dbSchema) ? config.dbSchema : 'trapotato';

declare global {
  // eslint-disable-next-line no-var
  var _trapotatoPool: Pool | undefined;
}

export function getPool(): Pool {
  if (!globalThis._trapotatoPool) {
    globalThis._trapotatoPool = new Pool({
      connectionString: normalizeUrl(config.databaseUrl),
      // NOTE: we deliberately do NOT set `options: -c search_path` here. Neon's
      // pooled endpoint (PgBouncer) rejects the `options` startup parameter, and
      // role-level defaults don't survive transaction pooling. Instead every
      // query pins the schema with a transaction-scoped `SET LOCAL` (see below),
      // which is safe on the pooler and on direct connections alike.
      ssl: config.dbSsl ? { rejectUnauthorized: false } : undefined,
      // Serverless (Vercel) spins up many isolated instances, each with its own
      // pool — a high per-instance max quickly exhausts Postgres. Keep it small
      // (override with DB_POOL_MAX) and prefer a pooled/pgbouncer DATABASE_URL.
      max: Number(process.env.DB_POOL_MAX ?? (process.env.VERCEL ? '2' : '10')),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return globalThis._trapotatoPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<{ rows: T[]; rowCount: number }> {
  const client = await getPool().connect();
  try {
    // Run inside a transaction so `SET LOCAL search_path` and the statement are
    // guaranteed to execute on the SAME backend — required under PgBouncer
    // transaction pooling, where a bare SET could land on a different backend.
    await client.query('BEGIN');
    await client.query(`SET LOCAL search_path TO ${SCHEMA}, public`);
    const res = await client.query<T>(text, params as never[]);
    await client.query('COMMIT');
    return { rows: res.rows, rowCount: res.rowCount ?? 0 };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T | null> {
  const { rows } = await query<T>(text, params);
  return rows[0] ?? null;
}
