// Public license verification endpoint — called by the desktop application.
//
//   POST /api/license/verify
//   Body: { productKey, machineId, os?, deviceName?, appVersion? }
//   Resp: { valid, status, reason, expiryDate?, customerName?, recheckSeconds? }
//
// Validates product key, machine ID, license status, expiry, and activation
// limits on every call, and records a verification-history entry.

import { NextResponse } from 'next/server';
import { verifyLicense } from '@/lib/licenses';
import { config } from '@/lib/config';
import { clientIp, CORS_HEADERS } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  // Optional shared-secret gate.
  if (config.licenseApiKey && req.headers.get('x-api-key') !== config.licenseApiKey) {
    return NextResponse.json(
      { valid: false, status: 'invalid', reason: 'Unauthorized client' },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { valid: false, status: 'invalid', reason: 'Invalid JSON body' },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  try {
    const result = await verifyLicense({
      productKey: String(body.productKey ?? ''),
      machineId: String(body.machineId ?? ''),
      os: body.os ? String(body.os) : undefined,
      deviceName: body.deviceName ? String(body.deviceName) : undefined,
      ip: clientIp(req),
    });

    return NextResponse.json(result, {
      status: result.valid ? 200 : 200, // always 200; clients read `valid`
      headers: CORS_HEADERS,
    });
  } catch (err) {
    console.error('[verify] error:', err);
    // Server/db failure — let the client decide its offline grace behaviour.
    return NextResponse.json(
      { valid: false, status: 'invalid', reason: 'Verification server error' },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
