// Centralised, type-safe access to environment configuration.
// Pure env reads only — safe to import from both Node and Edge runtimes.

export const config = {
  databaseUrl: process.env.DATABASE_URL ?? '',
  dbSchema: process.env.DB_SCHEMA ?? 'trapotato',
  dbSsl: process.env.DB_SSL === 'require',

  adminUsername: process.env.ADMIN_USERNAME ?? 'trapotato_admin',
  adminPassword: process.env.ADMIN_PASSWORD ?? '',

  sessionSecret:
    process.env.SESSION_SECRET ?? 'trapotato-insecure-dev-secret-change-me-please',

  licenseApiKey: process.env.LICENSE_API_KEY ?? '',
  onlineWindowMinutes: Number(process.env.ONLINE_WINDOW_MINUTES ?? '10'),
} as const;

export const APP_NAME = 'Trapotato';
