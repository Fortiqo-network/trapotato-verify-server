// Admin: list early-access applications. Protected by middleware (/api/admin/*).

import { NextResponse } from 'next/server';
import { isEarlyAccessStatus, listEarlyAccess } from '@/lib/early-access';
import type { EarlyAccessStatus } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const search = url.searchParams.get('search') ?? undefined;
  const statusParam = url.searchParams.get('status') ?? 'all';
  const status: EarlyAccessStatus | 'all' = isEarlyAccessStatus(statusParam) ? statusParam : 'all';
  const limit = Number(url.searchParams.get('limit') ?? '200');
  const offset = Number(url.searchParams.get('offset') ?? '0');

  const result = await listEarlyAccess({ search, status, limit, offset });
  return NextResponse.json(result);
}
