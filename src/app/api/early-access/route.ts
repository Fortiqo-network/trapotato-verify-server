// Public early-access waitlist submission.
//
//   POST /api/early-access
//   Body: { fullName, email, whatsapp?, company?, role?, useCase?, duration?,
//           referral?, acceptedTerms, termsVersion?, device? }
//   -> stores the application + the mandatory Terms acceptance (with timestamp)
//      and the submitting device context.
//
// CORS-open so the public marketing site (different origin) can post here.

import { NextResponse } from 'next/server';
import { createEarlyAccess } from '@/lib/early-access';
import { CORS_HEADERS, clientIp } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

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

  const fullName = String(body.fullName ?? body.name ?? '').trim();
  const email = String(body.email ?? '').trim();
  const whatsapp = String(body.whatsapp ?? body.phone ?? '').trim();
  const company = String(body.company ?? '').trim();
  const role = String(body.role ?? '').trim();
  const useCase = String(body.useCase ?? '').trim();
  const duration = String(body.duration ?? '').trim();
  const referral = String(body.referral ?? '').trim();
  const acceptedTerms = body.acceptedTerms === true || body.acceptedTerms === 'true';
  const termsVersion = String(body.termsVersion ?? '').trim();
  const device =
    body.device && typeof body.device === 'object' ? (body.device as Record<string, unknown>) : {};

  if (!fullName || !email) {
    return NextResponse.json({ ok: false, error: 'Name and email are required.' }, { status: 400, headers: CORS_HEADERS });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: 'Please enter a valid email address.' }, { status: 400, headers: CORS_HEADERS });
  }
  if (!acceptedTerms) {
    return NextResponse.json(
      { ok: false, error: 'You must accept the Terms & Conditions to request access.' },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  try {
    const rec = await createEarlyAccess({
      fullName,
      email,
      whatsapp,
      company,
      role,
      useCase,
      duration,
      referral,
      acceptedTerms,
      termsVersion,
      acceptedAt: new Date().toISOString(),
      userAgent: String(device.userAgent ?? req.headers.get('user-agent') ?? ''),
      platform: String(device.platform ?? ''),
      timezone: String(device.timezone ?? ''),
      language: String(device.language ?? ''),
      screen: String(device.screen ?? ''),
      ipAddress: clientIp(req),
      deviceDetails: device,
    });
    return NextResponse.json(
      { ok: true, id: rec.id, message: "Thanks! Your early-access request has been received — we'll be in touch." },
      { status: 201, headers: CORS_HEADERS },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Submission failed' },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
