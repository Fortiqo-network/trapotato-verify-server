// Protects the admin dashboard and admin APIs. Runs on the Edge runtime,
// so it only verifies the signed session cookie (no database access here).

import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/auth';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);

  const isAdminApi = pathname.startsWith('/api/admin');
  const isLoginApi = pathname === '/api/admin/login';

  // Admin API: allow the login endpoint; everything else requires a session.
  if (isAdminApi && !isLoginApi) {
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Admin pages: redirect to /login when unauthenticated.
  if (pathname.startsWith('/admin')) {
    if (!session) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Already logged in and visiting /login -> go straight to the dashboard.
  if (pathname === '/login' && session) {
    const url = req.nextUrl.clone();
    url.pathname = '/admin';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*', '/login'],
};
