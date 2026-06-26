// PM2 process configuration for the Trapotato Verify Server.
// Build first (`npm run build`), then: `pm2 start ecosystem.config.js`.

module.exports = {
  apps: [
    {
      name: 'trapotato-verify',
      script: './node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
      },
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      merge_logs: true,
      time: true,
    },
  ],
};
