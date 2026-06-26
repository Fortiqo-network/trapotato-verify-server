import { NextResponse } from 'next/server';
import { createLicense, listLicenses } from '@/lib/licenses';
import type { LicenseStatus } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUSES: (LicenseStatus | 'all')[] = ['all', 'active', 'disabled', 'expired', 'banned'];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const search = url.searchParams.get('search') ?? undefined;
  const statusParam = url.searchParams.get('status') ?? 'all';
  const status = STATUSES.includes(statusParam as LicenseStatus | 'all')
    ? (statusParam as LicenseStatus | 'all')
    : 'all';
  const limit = Number(url.searchParams.get('limit') ?? '100');
  const offset = Number(url.searchParams.get('offset') ?? '0');

  const result = await listLicenses({ search, status, limit, offset });
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  try {
    const license = await createLicense({
      customerName: String(body.customerName ?? ''),
      email: String(body.email ?? ''),
      maxActivations: body.maxActivations != null ? Number(body.maxActivations) : 1,
      expiryDate: body.expiryDate ? String(body.expiryDate) : null,
      notes: body.notes ? String(body.notes) : '',
      productKey: body.productKey ? String(body.productKey) : undefined,
    });
    return NextResponse.json(license, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create license' },
      { status: 400 },
    );
  }
}
