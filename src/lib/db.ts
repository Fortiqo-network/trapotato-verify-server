// PostgreSQL access layer (node-postgres). Node runtime only.
// A single pooled connection is reused across hot-reloads / requests.

import { Pool, type QueryResultRow } from 'pg';
import { config } from './config';

/** Convert a SQLAlchemy-style URL (postgresql+asyncpg://...) to a plain pg URL. */
function normalizeUrl(url: string): string {
  if (!url) return url;
  let u = url.replace(/^(postgres(?:ql)?)\+[a-z0-9]+:/i, '$1:');
  const q = u.indexOf('?');
  if (q !== -1) u = u.slice(0, q); // drop query (we set search_path via `options`)
  return u;
}

declare global {
  // eslint-disable-next-line no-var
  var _trapotatoPool: Pool | undefined;
}

export function getPool(): Pool {
  if (!globalThis._trapotatoPool) {
    globalThis._trapotatoPool = new Pool({
      connectionString: normalizeUrl(config.databaseUrl),
      // Pin every connection to our dedicated schema.
      options: `-c search_path=${config.dbSchema}`,
      ssl: config.dbSsl ? { rejectUnauthorized: false } : undefined,
      max: 10,
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
  const res = await getPool().query<T>(text, params as never[]);
  return { rows: res.rows, rowCount: res.rowCount ?? 0 };
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T | null> {
  const { rows } = await query<T>(text, params);
  return rows[0] ?? null;
}
