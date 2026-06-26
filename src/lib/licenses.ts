// License data-access layer and verification business logic. Node runtime only.

import { query, queryOne } from './db';
import { config } from './config';
import { generateProductKey } from './keygen';
import type {
  License,
  LicenseStatus,
  Machine,
  Stats,
  VerificationLog,
  VerifyResult,
} from './types';

// ── Reads ─────────────────────────────────────────────────────

export async function listLicenses(opts: {
  search?: string;
  status?: LicenseStatus | 'all';
  limit?: number;
  offset?: number;
} = {}): Promise<{ items: (License & { machine_count: number })[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (opts.search) {
    params.push(`%${opts.search}%`);
    const p = `$${params.length}`;
    where.push(`(l.product_key ILIKE ${p} OR l.customer_name ILIKE ${p} OR l.email ILIKE ${p})`);
  }
  if (opts.status && opts.status !== 'all') {
    params.push(opts.status);
    where.push(`l.status = $${params.length}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 500);
  const offset = Math.max(opts.offset ?? 0, 0);

  const totalRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::int AS count FROM licenses l ${whereSql}`,
    params,
  );

  const { rows } = await query<License & { machine_count: number }>(
    `SELECT l.*, COALESCE(m.cnt, 0)::int AS machine_count
       FROM licenses l
       LEFT JOIN (SELECT license_id, COUNT(*) AS cnt FROM machines GROUP BY license_id) m
         ON m.license_id = l.id
       ${whereSql}
       ORDER BY l.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
    params,
  );

  return { items: rows, total: Number(totalRow?.count ?? 0) };
}

export function getLicense(id: string): Promise<License | null> {
  return queryOne<License>(`SELECT * FROM licenses WHERE id = $1`, [id]);
}

export function getLicenseByKey(productKey: string): Promise<License | null> {
  return queryOne<License>(`SELECT * FROM licenses WHERE product_key = $1`, [productKey]);
}

export function getMachines(licenseId: string): Promise<Machine[]> {
  return query<Machine>(
    `SELECT * FROM machines WHERE license_id = $1 ORDER BY last_seen DESC`,
    [licenseId],
  ).then((r) => r.rows);
}

export function getLogs(licenseId: string, limit = 100): Promise<VerificationLog[]> {
  return query<VerificationLog>(
    `SELECT * FROM verification_logs WHERE license_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [licenseId, Math.min(limit, 500)],
  ).then((r) => r.rows);
}

export async function getStats(): Promise<Stats> {
  const row = await queryOne<{
    total: string; active: string; disabled: string; expired: string; banned: string;
  }>(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE status = 'active')::int   AS active,
       COUNT(*) FILTER (WHERE status = 'disabled')::int AS disabled,
       COUNT(*) FILTER (WHERE status = 'expired')::int  AS expired,
       COUNT(*) FILTER (WHERE status = 'banned')::int   AS banned
     FROM licenses`,
  );
  const online = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::int AS count FROM machines
       WHERE last_seen > now() - ($1 || ' minutes')::interval`,
    [String(config.onlineWindowMinutes)],
  );
  return {
    total: Number(row?.total ?? 0),
    active: Number(row?.active ?? 0),
    disabled: Number(row?.disabled ?? 0),
    expired: Number(row?.expired ?? 0),
    banned: Number(row?.banned ?? 0),
    onlineClients: Number(online?.count ?? 0),
  };
}

// ── Writes (admin) ────────────────────────────────────────────

export async function createLicense(input: {
  customerName: string;
  email: string;
  maxActivations?: number;
  expiryDate?: string | null;
  notes?: string;
  productKey?: string;
}): Promise<License> {
  // Retry a few times in the (astronomically unlikely) event of a key collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const key = input.productKey?.trim() || generateProductKey();
    const existing = await getLicenseByKey(key);
    if (existing) {
      if (input.productKey) throw new Error('Product key already exists');
      continue;
    }
    const row = await queryOne<License>(
      `INSERT INTO licenses (product_key, customer_name, email, max_activations, expiry_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        key,
        input.customerName ?? '',
        input.email ?? '',
        Math.max(1, input.maxActivations ?? 1),
        input.expiryDate || null,
        input.notes ?? '',
      ],
    );
    if (row) return row;
  }
  throw new Error('Failed to generate a unique product key');
}

export async function updateLicense(
  id: string,
  fields: Partial<{
    customer_name: string;
    email: string;
    max_activations: number;
    expiry_date: string | null;
    notes: string;
    status: LicenseStatus;
  }>,
): Promise<License | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    params.push(v);
    sets.push(`${k} = $${params.length}`);
  }
  if (!sets.length) return getLicense(id);
  params.push(id);
  return queryOne<License>(
    `UPDATE licenses SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params,
  );
}

export function setStatus(id: string, status: LicenseStatus): Promise<License | null> {
  return updateLicense(id, { status });
}

/** Extend (or set) the expiry date by N days from the later of now / current expiry. */
export async function extendLicense(id: string, days: number): Promise<License | null> {
  const lic = await getLicense(id);
  if (!lic) return null;
  const base = lic.expiry_date && new Date(lic.expiry_date) > new Date()
    ? new Date(lic.expiry_date)
    : new Date();
  base.setUTCDate(base.getUTCDate() + days);
  // Re-activate if it had lapsed into 'expired' and now has a future date.
  const status: LicenseStatus = lic.status === 'expired' ? 'active' : lic.status;
  return updateLicense(id, { expiry_date: base.toISOString(), status });
}

export async function resetMachines(id: string): Promise<number> {
  const res = await query(`DELETE FROM machines WHERE license_id = $1`, [id]);
  await query(`UPDATE licenses SET activation_date = NULL WHERE id = $1`, [id]);
  return res.rowCount;
}

export async function deleteLicense(id: string): Promise<boolean> {
  const res = await query(`DELETE FROM licenses WHERE id = $1`, [id]);
  return res.rowCount > 0;
}

// ── Verification (public, called by the desktop app) ──────────

async function logVerification(
  licenseId: string | null,
  productKey: string,
  machineId: string,
  ip: string,
  success: boolean,
  reason: string,
): Promise<void> {
  await query(
    `INSERT INTO verification_logs (license_id, product_key, machine_id, ip_address, success, reason)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [licenseId, productKey, machineId, ip, success, reason],
  );
}

const RECHECK_SECONDS = 300; // desktop re-verifies every 5 minutes

export async function verifyLicense(input: {
  productKey: string;
  machineId: string;
  os?: string;
  deviceName?: string;
  ip: string;
}): Promise<VerifyResult> {
  const productKey = (input.productKey ?? '').trim();
  const machineId = (input.machineId ?? '').trim();
  const ip = input.ip ?? '';

  if (!productKey || !machineId) {
    await logVerification(null, productKey, machineId, ip, false, 'Missing product key or machine ID');
    return { valid: false, status: 'invalid', reason: 'Missing product key or machine ID' };
  }

  const lic = await getLicenseByKey(productKey);
  if (!lic) {
    await logVerification(null, productKey, machineId, ip, false, 'Product key not found');
    return { valid: false, status: 'invalid', reason: 'Product key not found' };
  }

  // Lazily flip to 'expired' when the date has passed.
  let status: LicenseStatus = lic.status;
  if (status === 'active' && lic.expiry_date && new Date(lic.expiry_date) < new Date()) {
    status = 'expired';
    await query(`UPDATE licenses SET status = 'expired' WHERE id = $1 AND status = 'active'`, [lic.id]);
  }

  const touch = () =>
    query(`UPDATE licenses SET last_verification_time = now(), last_ip = $2 WHERE id = $1`, [lic.id, ip]);

  if (status !== 'active') {
    const reasons: Record<string, string> = {
      disabled: 'License has been disabled. Please contact the administrator.',
      expired: 'License has expired. Please renew your subscription.',
      banned: 'License has been banned. Please contact the administrator.',
    };
    const reason = reasons[status] ?? 'License is not active.';
    await touch();
    await logVerification(lic.id, productKey, machineId, ip, false, reason);
    return { valid: false, status, reason, expiryDate: lic.expiry_date };
  }

  // Machine binding / activation-limit enforcement.
  const machine = await queryOne<Machine>(
    `SELECT * FROM machines WHERE license_id = $1 AND machine_id = $2`,
    [lic.id, machineId],
  );

  if (machine) {
    await query(
      `UPDATE machines
         SET last_seen = now(), ip_address = $2,
             os = COALESCE(NULLIF($3, ''), os),
             device_name = COALESCE(NULLIF($4, ''), device_name)
       WHERE id = $1`,
      [machine.id, ip, input.os ?? '', input.deviceName ?? ''],
    );
  } else {
    const countRow = await queryOne<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM machines WHERE license_id = $1`,
      [lic.id],
    );
    const count = Number(countRow?.count ?? 0);
    if (count >= lic.max_activations) {
      await touch();
      // Hardware + product-key binding: this key is already locked to its
      // allotted device(s). A new/changed hardware ID is rejected here — the
      // user must ask an administrator to reset activations to move machines.
      const reason =
        lic.max_activations === 1
          ? 'This product key is already locked to a different device (hardware ID mismatch). A hardware change requires an administrator activation reset.'
          : `Activation limit reached. This product key is locked to ${lic.max_activations} device(s). Contact the administrator to reset activations.`;
      await logVerification(lic.id, productKey, machineId, ip, false, reason);
      return { valid: false, status: 'active', reason, expiryDate: lic.expiry_date };
    }
    await query(
      `INSERT INTO machines (license_id, machine_id, os, device_name, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [lic.id, machineId, input.os ?? '', input.deviceName ?? '', ip],
    );
    if (!lic.activation_date) {
      await query(`UPDATE licenses SET activation_date = now() WHERE id = $1 AND activation_date IS NULL`, [lic.id]);
    }
  }

  await touch();
  await logVerification(lic.id, productKey, machineId, ip, true, 'OK');
  return {
    valid: true,
    status: 'active',
    reason: 'OK',
    expiryDate: lic.expiry_date,
    customerName: lic.customer_name,
    recheckSeconds: RECHECK_SECONDS,
  };
}
