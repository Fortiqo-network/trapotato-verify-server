// Post-build step for `output: 'standalone'` deployments launched via PM2
// (ecosystem.config.js → .next/standalone/server.js).
//
// Next.js does NOT copy `.next/static` or `public/` into the standalone folder
// (it assumes a Docker build that copies them in — see Dockerfile). When the
// standalone server is run directly by PM2, it serves static assets relative to
// its own directory, so without this copy EVERY `/_next/static/*` request 404s
// and the UI renders with no CSS/JS (unstyled, non-hydrated).
//
// Runs automatically after `next build` via the "postbuild" npm script, so the
// documented deploy (`npm run build && pm2 restart`) is always self-correcting.

import { existsSync, cpSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const standalone = join(root, '.next', 'standalone');

if (!existsSync(standalone)) {
  // No standalone output — this is a Vercel / native `next build` (output is not
  // 'standalone' there), which serves static assets itself. Nothing to copy;
  // skip cleanly so the postbuild step never fails a non-standalone build.
  console.log('[prepare-standalone] no .next/standalone (native/Vercel build) — nothing to copy.');
  process.exit(0);
}

/** Recursively copy `src` → `dest` when `src` exists, logging the result. */
function copyInto(src, dest, label) {
  if (!existsSync(src)) {
    console.warn(`[prepare-standalone] skip ${label}: ${src} does not exist`);
    return;
  }
  cpSync(src, dest, { recursive: true });
  console.log(`[prepare-standalone] copied ${label} → ${dest}`);
}

// The hashed JS/CSS chunks the HTML references — the actual fix.
copyInto(join(root, '.next', 'static'), join(standalone, '.next', 'static'), '.next/static');

// Static files (favicon, images). Harmless when empty; keeps parity with Docker.
const publicDir = join(root, 'public');
if (existsSync(publicDir) && readdirSync(publicDir).some((f) => f !== '.gitkeep')) {
  copyInto(publicDir, join(standalone, 'public'), 'public');
} else {
  console.log('[prepare-standalone] public/ is empty — nothing to copy');
}

console.log('[prepare-standalone] standalone assets ready.');
