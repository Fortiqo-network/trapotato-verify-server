// PM2 process configuration for the Trapotato Verify Server.
//
// The Next.js build uses `output: 'standalone'` (see next.config.mjs), so the
// server MUST be launched via the generated standalone entrypoint — NOT via
// `next start` (which prints a warning and does not serve the standalone bundle).
//
// Deploy:  npm run build  &&  pm2 start ecosystem.config.js  &&  pm2 save
//
// Port 6542 is required: the Cloudflare tunnel (trapotato.fortiqo.xyz) proxies
// to http://localhost:6542. Port 3000 is used by another app on this host.

module.exports = {
  apps: [
    {
      name: 'trapotato-verify',
      script: '.next/standalone/server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: '6542',
        HOSTNAME: '0.0.0.0',
      },
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      merge_logs: true,
      time: true,
    },
  ],
};
