// Early-access waitlist data-access layer. Node runtime only.
// Mirrors the conventions in `licenses.ts` (parameterised queries, thin helpers).

import { query, queryOne } from './db';
import type { EarlyAccess, EarlyAccessStats, EarlyAccessStatus } from './types';

export const EARLY_ACCESS_STATUSES: EarlyAccessStatus[] = ['new', 'contacted', 'approved', 'rejected'];

export function isEarlyAccessStatus(v: unknown): v is EarlyAccessStatus {
  return typeof v === 'string' && EARLY_ACCESS_STATUSES.includes(v as EarlyAccessStatus);
}

export interface EarlyAccessInput {
  fullName: string;
  email: string;
  whatsapp?: string;
  company?: string;
  role?: string;
  useCase?: string;
  duration?: string;
  referral?: string;
  acceptedTerms: boolean;
  termsVersion?: string;
  acceptedAt?: string | null;
  userAgent?: string;
  platform?: string;
  timezone?: string;
  language?: string;
  screen?: string;
  ipAddress?: string;
  deviceDetails?: Record<string, unknown>;
}

// ── Writes ────────────────────────────────────────────────────

export async function createEarlyAccess(input: EarlyAccessInput): Promise<EarlyAccess> {
  const row = await queryOne<EarlyAccess>(
    `INSERT INTO early_access
       (full_name, email, whatsapp, company, role, use_case, duration, referral,
        accepted_terms, terms_version, accepted_at,
        user_agent, platform, timezone, language, screen, ip_address, device_details)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     RETURNING *`,
    [
      input.fullName, input.email, input.whatsapp ?? '', input.company ?? '', input.role ?? '',
      input.useCase ?? '', input.duration ?? '', input.referral ?? '',
      input.acceptedTerms, input.termsVersion ?? '', input.acceptedAt ?? null,
      input.userAgent ?? '', input.platform ?? '', input.timezone ?? '', input.language ?? '',
      input.screen ?? '', input.ipAddress ?? '', JSON.stringify(input.deviceDetails ?? {}),
    ],
  );
  if (!row) throw new Error('Failed to save the application');
  return row;
}

export function updateEarlyAccess(
  id: string,
  fields: Partial<{ status: EarlyAccessStatus; notes: string }>,
): Promise<EarlyAccess | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    params.push(v);
    sets.push(`${k} = $${params.length}`);
  }
  if (!sets.length) return getEarlyAccess(id);
  params.push(id);
  return queryOne<EarlyAccess>(
    `UPDATE early_access SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params,
  );
}

export async function deleteEarlyAccess(id: string): Promise<boolean> {
  const res = await query(`DELETE FROM early_access WHERE id = $1`, [id]);
  return res.rowCount > 0;
}

// ── Reads ─────────────────────────────────────────────────────

export function getEarlyAccess(id: string): Promise<EarlyAccess | null> {
  return queryOne<EarlyAccess>(`SELECT * FROM early_access WHERE id = $1`, [id]);
}

export async function listEarlyAccess(
  opts: { search?: string; status?: EarlyAccessStatus | 'all'; limit?: number; offset?: number } = {},
): Promise<{ items: EarlyAccess[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (opts.search) {
    params.push(`%${opts.search}%`);
    const p = `$${params.length}`;
    where.push(`(full_name ILIKE ${p} OR email ILIKE ${p} OR whatsapp ILIKE ${p} OR company ILIKE ${p})`);
  }
  if (opts.status && opts.status !== 'all') {
    params.push(opts.status);
    where.push(`status = $${params.length}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
  const offset = Math.max(opts.offset ?? 0, 0);

  const totalRow = await queryOne<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM early_access ${whereSql}`,
    params,
  );
  const { rows } = await query<EarlyAccess>(
    `SELECT * FROM early_access ${whereSql} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
    params,
  );
  return { items: rows, total: Number(totalRow?.count ?? 0) };
}

export async function getEarlyAccessStats(): Promise<EarlyAccessStats> {
  const row = await queryOne<{ total: number; new: number; contacted: number; approved: number; rejected: number }>(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE status = 'new')::int       AS "new",
       COUNT(*) FILTER (WHERE status = 'contacted')::int AS contacted,
       COUNT(*) FILTER (WHERE status = 'approved')::int  AS approved,
       COUNT(*) FILTER (WHERE status = 'rejected')::int  AS rejected
     FROM early_access`,
  );
  return {
    total: Number(row?.total ?? 0),
    new: Number(row?.new ?? 0),
    contacted: Number(row?.contacted ?? 0),
    approved: Number(row?.approved ?? 0),
    rejected: Number(row?.rejected ?? 0),
  };
}
