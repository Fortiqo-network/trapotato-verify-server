// Product key generation. Node runtime only (uses node:crypto).

import { randomInt } from 'node:crypto';

// Unambiguous alphabet — no 0/O/1/I to avoid customer transcription errors.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function group(len = 5): string {
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

/**
 * Generates a product key in the form: TRAPO-XXXXX-XXXXX-XXXXX-XXXXX
 * (~20 random chars from a 32-symbol alphabet => ~100 bits of entropy).
 */
export function generateProductKey(prefix = 'TRAPO'): string {
  return `${prefix}-${group()}-${group()}-${group()}-${group()}`;
}
