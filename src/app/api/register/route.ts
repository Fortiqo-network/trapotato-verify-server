// Public self-service registration.
//
//   POST /api/register
//   Body: { customerName, email, whatsapp, requestedPlan }
//   -> creates a PENDING (inactive) license, returns the generated product key.
//
// The key stays inactive until an admin verifies payment and activates it.

import { NextResponse } from 'next/server';
import { registerUser, isPlan } from '@/lib/licenses';
import { CORS_HEADERS } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400, headers: CORS_HEADERS });
  }

  const customerName = String(body.customerName ?? body.name ?? '').trim();
  const email = String(body.email ?? '').trim();
  const whatsapp = String(body.whatsapp ?? '').trim();
  const requestedRaw = String(body.requestedPlan ?? body.plan ?? 'none');
  const requestedPlan = isPlan(requestedRaw) ? requestedRaw : 'none';

  if (!customerName || !email || !whatsapp) {
    return NextResponse.json(
      { ok: false, error: 'Name, email, and WhatsApp number are required.' },
      { status: 400, headers: CORS_HEADERS },
    );
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: 'Please enter a valid email address.' }, { status: 400, headers: CORS_HEADERS });
  }

  try {
    const lic = await registerUser({ customerName, email, whatsapp, requestedPlan });
    return NextResponse.json(
      {
        ok: true,
        productKey: lic.product_key,
        status: lic.status, // 'pending'
        requestedPlan: lic.requested_plan,
        message: 'Your product key has been created but will remain inactive until your payment is verified by the admin.',
      },
      { status: 201, headers: CORS_HEADERS },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Registration failed' },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
