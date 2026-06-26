import { NextResponse } from 'next/server';
import { createLicense, isPlan, listLicenses } from '@/lib/licenses';
import type { LicenseStatus } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUSES: (LicenseStatus | 'all')[] = ['all', 'pending', 'active', 'disabled', 'expired', 'banned'];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const search = url.searchParams.get('search') ?? undefined;
  const statusParam = url.searchParams.get('status') ?? 'all';
  const status = STATUSES.includes(statusParam as LicenseStatus | 'all')
    ? (statusParam as LicenseStatus | 'all')
    : 'all';
  const limit = Number(url.searchParams.get('limit') ?? '100');
  const offset = Number(url.searchParams.get('offset') ?? '0');
  const onlyDeleted = url.searchParams.get('deleted') === '1';

  const result = await listLicenses({ search, status, onlyDeleted, limit, offset });
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  try {
    const license = await createLicense({
      customerName: String(body.customerName ?? ''),
      email: String(body.email ?? ''),
      whatsapp: body.whatsapp ? String(body.whatsapp) : '',
      requestedPlan: isPlan(String(body.requestedPlan)) ? (String(body.requestedPlan) as never) : 'none',
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
