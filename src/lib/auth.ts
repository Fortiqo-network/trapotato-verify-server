// Admin session helpers. Edge-safe: uses `jose` only (no Node-native modules),
// so it can be imported from middleware as well as Node route handlers.

import { SignJWT, jwtVerify } from 'jose';
import { config } from './config';

export const SESSION_COOKIE = 'trapotato_session';

function secretKey(): Uint8Array {
  return new TextEncoder().encode(config.sessionSecret);
}

/** Create a signed session token for an authenticated admin. */
export async function createSession(username: string): Promise<string> {
  return new SignJWT({ role: 'admin' })
    .setSubject(username)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(secretKey());
}

/** Verify a session token. Returns the admin username or null if invalid/expired. */
export async function verifySession(
  token: string | undefined | null,
): Promise<{ username: string } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.role !== 'admin' || !payload.sub) return null;
    return { username: String(payload.sub) };
  } catch {
    return null;
  }
}
