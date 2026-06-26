import { NextResponse } from 'next/server';
import {
  deleteLicense,
  extendLicense,
  getLicense,
  getLogs,
  getMachines,
  resetMachines,
  setStatus,
  updateLicense,
} from '@/lib/licenses';
import type { LicenseStatus } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

// GET /api/admin/licenses/:id — full detail (license + machines + logs)
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const license = await getLicense(id);
  if (!license) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [machines, logs] = await Promise.all([getMachines(id), getLogs(id, 200)]);
  return NextResponse.json({ license, machines, logs });
}

// PATCH /api/admin/licenses/:id — actions: disable | enable | ban | extend | reset-machines | update
export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const action = String(body.action ?? 'update');

  const existing = await getLicense(id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  switch (action) {
    case 'disable':
      return NextResponse.json(await setStatus(id, 'disabled'));
    case 'enable':
      return NextResponse.json(await setStatus(id, 'active'));
    case 'ban':
      return NextResponse.json(await setStatus(id, 'banned'));
    case 'extend': {
      const days = Number(body.days ?? 0);
      if (!Number.isFinite(days) || days === 0) {
        return NextResponse.json({ error: 'Provide a non-zero "days" value' }, { status: 400 });
      }
      return NextResponse.json(await extendLicense(id, days));
    }
    case 'reset-machines': {
      const removed = await resetMachines(id);
      return NextResponse.json({ ok: true, removed });
    }
    case 'update':
    default: {
      const fields: Record<string, unknown> = {};
      if (body.customerName !== undefined) fields.customer_name = String(body.customerName);
      if (body.email !== undefined) fields.email = String(body.email);
      if (body.maxActivations !== undefined) fields.max_activations = Math.max(1, Number(body.maxActivations));
      if (body.expiryDate !== undefined) fields.expiry_date = body.expiryDate ? String(body.expiryDate) : null;
      if (body.notes !== undefined) fields.notes = String(body.notes);
      if (body.status !== undefined) fields.status = String(body.status) as LicenseStatus;
      return NextResponse.json(await updateLicense(id, fields));
    }
  }
}

// DELETE /api/admin/licenses/:id
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const ok = await deleteLicense(id);
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
