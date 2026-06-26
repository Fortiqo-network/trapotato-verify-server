# Trapotato Verify Server

License verification server and admin dashboard for the **Trapotato** desktop application.

Built with **Next.js 15 (App Router) + TypeScript + PostgreSQL**. It issues product
keys, binds each key to a single machine (hardware ID), enforces activation limits and
expiry, records a full verification history, and exposes a single public endpoint the
desktop app calls to verify a license.

> The desktop application is a **separate repository**. This repo only contains the
> license server. The desktop app is wired to this server **after** it is deployed and a
> public URL is available (the verification URL is configurable — never hardcoded).

---

## Features

- **Product keys** — admin-generated only; users can never self-issue.
- **Hardware + key binding** — a key is locked to the machine ID that first activates it.
  A different/changed machine is rejected (node-locked). Activation limit is configurable
  per key (default **1**).
- **Statuses** — `active`, `disabled`, `expired`, `banned`. Expiry auto-flips to `expired`.
- **Verification API** — `POST /api/license/verify` validates key, machine, status,
  expiry, and activation limits on every call and logs the attempt.
- **Admin dashboard** — overview stats, license CRUD, enable/disable/ban, extend
  subscription, reset machine activations, view machines + verification history, search & filter.

---

## Requirements

- Node.js **20+**
- A reachable **PostgreSQL** database (the app creates a dedicated `trapotato` schema).

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#    then edit .env (DATABASE_URL, ADMIN_*, SESSION_SECRET, ...)

# 3. Create the database schema + tables (one time)
npm run db:init

# 4. Run in development
npm run dev          # http://localhost:3000  -> redirects to /admin -> /login

# Production
npm run build
npm run start
```

Sign in at `/login` with the `ADMIN_USERNAME` / `ADMIN_PASSWORD` from your `.env`.

---

## Environment variables

See [`.env.example`](.env.example). Key ones:

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | Postgres connection string (plain `postgresql://`, **not** `+asyncpg`). Special chars URL-encoded. |
| `DB_SCHEMA` | Dedicated schema name. Default `trapotato`. |
| `DB_SSL` | `require` to enable TLS, otherwise `disable`. |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Admin dashboard login. |
| `SESSION_SECRET` | Secret that signs admin session cookies (use a long random string). |
| `LICENSE_API_KEY` | Optional shared secret required in the `x-api-key` header on the verify endpoint. |
| `ONLINE_WINDOW_MINUTES` | A machine counts as "online" if seen within this window. Default `10`. |

> The provided `DATABASE_URL` was given in SQLAlchemy form
> (`postgresql+asyncpg://...?search_path=core_api`). The app/init script automatically
> strip the `+asyncpg` driver suffix and the query string, and pin the schema via
> `DB_SCHEMA`. The committed `.env` already contains the converted value.

---

## Verification API (used by the desktop app)

`POST /api/license/verify`

```jsonc
// Request body
{
  "productKey": "TRAPO-XXXXX-XXXXX-XXXXX-XXXXX",
  "machineId":  "<sha256 hardware fingerprint>",
  "os":         "Windows 11",          // optional
  "deviceName": "DESKTOP-ABC"          // optional
}
```

```jsonc
// Response (HTTP 200 — always read `valid`)
{
  "valid": true,
  "status": "active",                  // active | disabled | expired | banned | invalid
  "reason": "OK",
  "expiryDate": "2026-12-31T00:00:00.000Z",
  "customerName": "Jane Doe",
  "recheckSeconds": 300
}
```

Rejections (`valid: false`) include a human-readable `reason`, e.g.
*"This product key is already locked to a different device (hardware ID mismatch)."*

If `LICENSE_API_KEY` is set, the request must include header `x-api-key: <value>`.

**Desktop verification policy** (implemented on the desktop side during integration):
verify twice on startup, then every **5 minutes**. On `disabled/expired/banned/invalid`
the app drops to an unlicensed state with a clear message. If the server is unreachable,
the app prompts the user to reconnect before licensed features unlock.

---

## Admin dashboard

| Route | Purpose |
| --- | --- |
| `/login` | Admin sign-in |
| `/admin` | Overview: total / active / disabled / expired / banned / online clients |
| `/admin/licenses` | Search, filter, create, disable/enable/extend/reset/delete |
| `/admin/licenses/[id]` | License detail: machines + verification history + actions |

All `/admin` pages and `/api/admin/*` endpoints require a valid admin session.

---

## Database

Schema is defined in [`db/schema.sql`](db/schema.sql) and applied with `npm run db:init`.
Tables (in schema `trapotato`): `licenses`, `machines`, `verification_logs`.

---

## Deployment

See **[`docs/deployment.md`](docs/deployment.md)** for production deployment with
Docker, PM2, Nginx reverse proxy, and SSL.

```bash
npm install
npm run build
npm run start                 # or: pm2 start ecosystem.config.js
```

---

## Project structure

```
src/
  app/
    api/license/verify/route.ts     # public verification endpoint
    api/admin/...                   # admin APIs (login, stats, licenses CRUD)
    admin/                          # admin dashboard (overview, licenses, detail)
    login/                          # admin sign-in
  lib/
    db.ts  licenses.ts  auth.ts  keygen.ts  config.ts  types.ts  http.ts
  middleware.ts                     # protects /admin and /api/admin
db/schema.sql                       # schema + tables
scripts/init-db.mjs                 # applies schema.sql
```
