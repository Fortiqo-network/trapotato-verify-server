// Admin: update (status / notes) or delete a single early-access application.

import { NextResponse } from 'next/server';
import { deleteEarlyAccess, getEarlyAccess, isEarlyAccessStatus, updateEarlyAccess } from '@/lib/early-access';
import type { EarlyAccessStatus } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const existing = await getEarlyAccess(id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const fields: Partial<{ status: EarlyAccessStatus; notes: string }> = {};

  if (body.status !== undefined) {
    if (!isEarlyAccessStatus(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    fields.status = body.status;
  }
  if (body.notes !== undefined) fields.notes = String(body.notes);

  return NextResponse.json(await updateEarlyAccess(id, fields));
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const ok = await deleteEarlyAccess(id);
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
