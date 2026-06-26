import { NextResponse } from 'next/server';
import {
  activateWithPlan,
  changePlan,
  deleteLicense,
  extendLicense,
  getLicense,
  getLogs,
  getMachines,
  isPlan,
  resetMachines,
  restoreLicense,
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

// PATCH /api/admin/licenses/:id
// actions: activate | change-plan | disable | enable | ban | extend | reset-machines | update
export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const action = String(body.action ?? 'update');

  const existing = await getLicense(id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  switch (action) {
    case 'activate': {
      // Activate on a chosen plan: sets activation date, expiry (per plan), status=active.
      const plan = String(body.plan ?? '');
      if (!isPlan(plan) || plan === 'none') {
        return NextResponse.json({ error: 'Select a valid plan to activate.' }, { status: 400 });
      }
      return NextResponse.json(await activateWithPlan(id, plan));
    }
    case 'change-plan': {
      // Change the plan, recomputing expiry from the existing activation date.
      const plan = String(body.plan ?? '');
      if (!isPlan(plan) || plan === 'none') {
        return NextResponse.json({ error: 'Select a valid plan.' }, { status: 400 });
      }
      return NextResponse.json(await changePlan(id, plan));
    }
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
    case 'restore':
      return NextResponse.json(await restoreLicense(id));
    case 'update':
    default: {
      const fields: Record<string, unknown> = {};
      if (body.customerName !== undefined) fields.customer_name = String(body.customerName);
      if (body.email !== undefined) fields.email = String(body.email);
      if (body.whatsapp !== undefined) fields.whatsapp = String(body.whatsapp);
      if (body.notes !== undefined) fields.notes = String(body.notes);
      if (body.expiryDate !== undefined) fields.expiry_date = body.expiryDate ? String(body.expiryDate) : null;
      if (body.status !== undefined) fields.status = String(body.status) as LicenseStatus;
      if (body.plan !== undefined && isPlan(String(body.plan))) fields.plan = String(body.plan);
      if (body.requestedPlan !== undefined && isPlan(String(body.requestedPlan))) fields.requested_plan = String(body.requestedPlan);
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
