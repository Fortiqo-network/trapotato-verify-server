// License data-access layer and verification business logic. Node runtime only.

import { query, queryOne } from './db';
import { config } from './config';
import { generateProductKey } from './keygen';
import { PLAN_DAYS } from './plans';
import type {
  License,
  LicenseStatus,
  Machine,
  Plan,
  Stats,
  VerificationLog,
  VerifyResult,
} from './types';

const VALID_PLANS: Plan[] = ['none', 'monthly', 'quarterly', 'annual', 'lifetime'];
export function isPlan(v: unknown): v is Plan {
  return typeof v === 'string' && VALID_PLANS.includes(v as Plan);
}

// ── Reads ─────────────────────────────────────────────────────

export async function listLicenses(opts: {
  search?: string;
  status?: LicenseStatus | 'all';
  onlyDeleted?: boolean;
  limit?: number;
  offset?: number;
} = {}): Promise<{ items: (License & { machine_count: number })[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];

  // Soft-delete: by default hide deleted rows; the deleted view requests only them.
  where.push(opts.onlyDeleted ? 'l.deleted_at IS NOT NULL' : 'l.deleted_at IS NULL');

  if (opts.search) {
    params.push(`%${opts.search}%`);
    const p = `$${params.length}`;
    where.push(`(l.product_key ILIKE ${p} OR l.customer_name ILIKE ${p} OR l.email ILIKE ${p} OR l.whatsapp ILIKE ${p})`);
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
    total: string; pending: string; active: string; disabled: string; expired: string; banned: string; deleted: string;
  }>(
    `SELECT
       COUNT(*) FILTER (WHERE deleted_at IS NULL)::int AS total,
       COUNT(*) FILTER (WHERE status = 'pending'  AND deleted_at IS NULL)::int AS pending,
       COUNT(*) FILTER (WHERE status = 'active'   AND deleted_at IS NULL)::int AS active,
       COUNT(*) FILTER (WHERE status = 'disabled' AND deleted_at IS NULL)::int AS disabled,
       COUNT(*) FILTER (WHERE status = 'expired'  AND deleted_at IS NULL)::int AS expired,
       COUNT(*) FILTER (WHERE status = 'banned'   AND deleted_at IS NULL)::int AS banned,
       COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)::int AS deleted
     FROM licenses`,
  );
  const online = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::int AS count FROM machines
       WHERE last_seen > now() - ($1 || ' minutes')::interval`,
    [String(config.onlineWindowMinutes)],
  );
  return {
    total: Number(row?.total ?? 0),
    pending: Number(row?.pending ?? 0),
    active: Number(row?.active ?? 0),
    disabled: Number(row?.disabled ?? 0),
    expired: Number(row?.expired ?? 0),
    banned: Number(row?.banned ?? 0),
    deleted: Number(row?.deleted ?? 0),
    onlineClients: Number(online?.count ?? 0),
  };
}

// ── Registration (public self-service) ────────────────────────

/**
 * Self-service registration. Creates a PENDING license (inactive) with the
 * user's details and the plan they want to buy, generating a unique key.
 * The key stays inactive until an admin verifies payment and activates it.
 */
export async function registerUser(input: {
  customerName: string;
  email: string;
  whatsapp: string;
  requestedPlan: Plan;
}): Promise<License> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const key = generateProductKey();
    if (await getLicenseByKey(key)) continue;
    const row = await queryOne<License>(
      `INSERT INTO licenses (product_key, customer_name, email, whatsapp, status, plan, requested_plan)
       VALUES ($1, $2, $3, $4, 'pending', 'none', $5)
       RETURNING *`,
      [key, input.customerName ?? '', input.email ?? '', input.whatsapp ?? '', input.requestedPlan ?? 'none'],
    );
    if (row) return row;
  }
  throw new Error('Failed to generate a unique product key');
}

// ── Writes (admin) ────────────────────────────────────────────

export async function createLicense(input: {
  customerName: string;
  email: string;
  whatsapp?: string;
  requestedPlan?: Plan;
  productKey?: string;
}): Promise<License> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const key = input.productKey?.trim() || generateProductKey();
    if (await getLicenseByKey(key)) {
      if (input.productKey) throw new Error('Product key already exists');
      continue;
    }
    const row = await queryOne<License>(
      `INSERT INTO licenses (product_key, customer_name, email, whatsapp, status, plan, requested_plan)
       VALUES ($1, $2, $3, $4, 'pending', 'none', $5)
       RETURNING *`,
      [key, input.customerName ?? '', input.email ?? '', input.whatsapp ?? '', input.requestedPlan ?? 'none'],
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
    whatsapp: string;
    plan: Plan;
    requested_plan: Plan;
    activation_date: string | null;
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

function computeExpiry(plan: Plan, activation: Date): string | null {
  const days = PLAN_DAYS[plan];
  if (days == null) return null; // lifetime / none = no expiry
  const e = new Date(activation);
  e.setUTCDate(e.getUTCDate() + days);
  return e.toISOString();
}

/**
 * Activate a license on a chosen plan. Sets the activation date (now, unless one
 * already exists and `keepActivationDate`), the plan, and the expiry derived from
 * the plan (lifetime = never expires). Status becomes 'active'.
 */
export async function activateWithPlan(
  id: string,
  plan: Plan,
  opts: { keepActivationDate?: boolean } = {},
): Promise<License | null> {
  const lic = await getLicense(id);
  if (!lic) return null;
  const activation = opts.keepActivationDate && lic.activation_date ? new Date(lic.activation_date) : new Date();
  const expiry = computeExpiry(plan, activation);
  return updateLicense(id, {
    plan,
    status: 'active',
    activation_date: activation.toISOString(),
    expiry_date: expiry,
  });
}

/** Change the plan on an already-active license; recomputes expiry from the activation date. */
export function changePlan(id: string, plan: Plan): Promise<License | null> {
  return activateWithPlan(id, plan, { keepActivationDate: true });
}

/** Extend (or set) the expiry date by N days from the later of now / current expiry. */
export async function extendLicense(id: string, days: number): Promise<License | null> {
  const lic = await getLicense(id);
  if (!lic) return null;
  if (lic.plan === 'lifetime') return lic; // nothing to extend
  const base = lic.expiry_date && new Date(lic.expiry_date) > new Date()
    ? new Date(lic.expiry_date)
    : new Date();
  base.setUTCDate(base.getUTCDate() + days);
  const status: LicenseStatus = lic.status === 'expired' ? 'active' : lic.status;
  return updateLicense(id, { expiry_date: base.toISOString(), status });
}

/** Reset the registered device(s) — used for lifetime device transfers. */
export async function resetMachines(id: string): Promise<number> {
  const res = await query(`DELETE FROM machines WHERE license_id = $1`, [id]);
  return res.rowCount;
}

/** Soft-delete: hide the user from normal views without losing any data. */
export async function deleteLicense(id: string): Promise<boolean> {
  const res = await query(`UPDATE licenses SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`, [id]);
  return res.rowCount > 0;
}

/** Restore a soft-deleted user. */
export async function restoreLicense(id: string): Promise<License | null> {
  return queryOne<License>(`UPDATE licenses SET deleted_at = NULL WHERE id = $1 RETURNING *`, [id]);
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

function remainingDaysFor(plan: Plan, expiry: string | null): number | null {
  if (plan === 'lifetime') return null;          // unlimited
  if (!expiry) return null;
  return Math.max(0, Math.ceil((new Date(expiry).getTime() - Date.now()) / 86_400_000));
}

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
  if (!lic || lic.deleted_at) {
    await logVerification(lic?.id ?? null, productKey, machineId, ip, false, 'Product key not found');
    return { valid: false, status: 'invalid', reason: 'Product key not found' };
  }

  const touch = () =>
    query(`UPDATE licenses SET last_verification_time = now(), last_ip = $2 WHERE id = $1`, [lic.id, ip]);

  // Awaiting admin activation / payment verification.
  if (lic.status === 'pending') {
    await touch();
    const reason = 'This product key is awaiting activation. It will work once your payment is verified by the admin.';
    await logVerification(lic.id, productKey, machineId, ip, false, reason);
    return { valid: false, status: 'pending', reason, plan: lic.plan, expiryDate: null };
  }

  // Lazily flip to 'expired' when the date has passed (lifetime never expires).
  let status: LicenseStatus = lic.status;
  if (status === 'active' && lic.plan !== 'lifetime' && lic.expiry_date && new Date(lic.expiry_date) < new Date()) {
    status = 'expired';
    await query(`UPDATE licenses SET status = 'expired' WHERE id = $1 AND status = 'active'`, [lic.id]);
  }

  if (status !== 'active') {
    const reasons: Record<string, string> = {
      disabled: 'Your product key has been disabled. Please contact the administrator.',
      expired: 'Your subscription has expired. Please renew to continue.',
      banned: 'Your product key has been banned. Please contact the administrator.',
    };
    const reason = reasons[status] ?? 'License is not active.';
    await touch();
    await logVerification(lic.id, productKey, machineId, ip, false, reason);
    return { valid: false, status, reason, plan: lic.plan, expiryDate: lic.expiry_date };
  }

  // ── Device rules ───────────────────────────────────────────
  // Lifetime: locked to ONE permanently-registered device.
  // All other plans: no device cap.
  const machine = await queryOne<Machine>(
    `SELECT * FROM machines WHERE license_id = $1 AND machine_id = $2`,
    [lic.id, machineId],
  );

  if (machine) {
    await query(
      `UPDATE machines SET last_seen = now(), ip_address = $2,
              os = COALESCE(NULLIF($3, ''), os),
              device_name = COALESCE(NULLIF($4, ''), device_name)
       WHERE id = $1`,
      [machine.id, ip, input.os ?? '', input.deviceName ?? ''],
    );
  } else {
    if (lic.plan === 'lifetime') {
      const countRow = await queryOne<{ count: string }>(
        `SELECT COUNT(*)::int AS count FROM machines WHERE license_id = $1`,
        [lic.id],
      );
      if (Number(countRow?.count ?? 0) >= 1) {
        await touch();
        const reason = 'This lifetime license is permanently registered to a different device. Contact the administrator to reset the registered device.';
        await logVerification(lic.id, productKey, machineId, ip, false, reason);
        return { valid: false, status: 'active', reason, plan: lic.plan, expiryDate: lic.expiry_date };
      }
    }
    await query(
      `INSERT INTO machines (license_id, machine_id, os, device_name, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [lic.id, machineId, input.os ?? '', input.deviceName ?? '', ip],
    );
  }

  await touch();
  await logVerification(lic.id, productKey, machineId, ip, true, 'OK');
  return {
    valid: true,
    status: 'active',
    reason: 'OK',
    plan: lic.plan,
    expiryDate: lic.expiry_date,
    remainingDays: remainingDaysFor(lic.plan, lic.expiry_date),
    customerName: lic.customer_name,
    recheckSeconds: RECHECK_SECONDS,
  };
}
