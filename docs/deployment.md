# Trapotato Verify Server — Deployment Guide

This document covers deploying the license verification server to a production Linux
host with **PM2** or **Docker**, fronted by **Nginx** with **SSL**.

The PostgreSQL database is **external** (provided via `DATABASE_URL`). Nothing in this
guide creates or manages Postgres — only the Next.js app and the reverse proxy.

---

## 0. Prerequisites

- A Linux server (Ubuntu/Debian assumed) with a public IP and a domain (e.g. `license.example.com`).
- **Node.js 20+** and **npm** (for the PM2 path), or **Docker + Docker Compose** (for the Docker path).
- Network access from the server to your PostgreSQL host/port.
- DNS A record pointing your domain at the server.

---

## 1. Get the code & configure

```bash
git clone <this-repo-url> trapotato-verify-server
cd trapotato-verify-server

cp .env.example .env
nano .env
```

Set at minimum:

```env
DATABASE_URL=postgresql://USER:URL_ENCODED_PASSWORD@DB_HOST:5432/DBNAME
DB_SCHEMA=trapotato
DB_SSL=disable                 # or "require" if your Postgres enforces TLS

ADMIN_USERNAME=trapotato_admin
ADMIN_PASSWORD=<your admin password>
SESSION_SECRET=<long random string>     # node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

LICENSE_API_KEY=               # optional shared secret for /api/license/verify
PORT=3000
NODE_ENV=production
```

> **Password encoding:** special characters in the DB password must be URL-encoded in
> `DATABASE_URL` (`#`→`%23`, `!`→`%21`, `@`→`%40`, `$`→`%24`). A SQLAlchemy-style URL
> (`postgresql+asyncpg://...?search_path=...`) is accepted — the `+asyncpg` suffix and
> query string are stripped automatically; the schema comes from `DB_SCHEMA`.

---

## 2. Initialise the database (one time)

Creates the `trapotato` schema and tables. Safe to re-run (idempotent).

```bash
npm install
npm run db:init
```

Expected output: `[init-db] Done. Schema "trapotato" is ready.`

---

## 3. Run the app

### Option A — PM2 (recommended for bare-metal)

```bash
npm install
npm run build
mkdir -p logs
pm2 start ecosystem.config.js
pm2 save                 # persist across reboots
pm2 startup              # follow the printed command to enable boot start
```

Useful commands:

```bash
pm2 logs trapotato-verify
pm2 restart trapotato-verify
pm2 stop trapotato-verify
```

The app now listens on `127.0.0.1:3000`.

### Option B — Docker Compose

```bash
docker compose build
docker compose run --rm app npm run db:init     # one-time schema init
docker compose up -d
docker compose logs -f app
```

The container exposes `3000:3000`.

### Option C — Plain Node

```bash
npm install
npm run build
npm run start            # honors PORT from .env
```

---

## 4. Nginx reverse proxy

Create `/etc/nginx/sites-available/trapotato`:

```nginx
server {
    listen 80;
    server_name license.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

> `X-Forwarded-For` / `X-Real-IP` are required so the server records the **real client IP**
> in verification logs.

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/trapotato /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 5. SSL (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d license.example.com
```

Certbot rewrites the Nginx config for HTTPS and sets up auto-renewal. Verify renewal:

```bash
sudo certbot renew --dry-run
```

---

## 6. Post-deploy verification

**Admin dashboard:** open `https://license.example.com/login` and sign in.

**Verify endpoint smoke test** (replace the key with a real one created in the dashboard):

```bash
curl -s https://license.example.com/api/license/verify \
  -H "Content-Type: application/json" \
  -d '{"productKey":"TRAPO-XXXXX-XXXXX-XXXXX-XXXXX","machineId":"test-machine-1","os":"Windows 11","deviceName":"smoke-test"}' | jq
```

- First call with a fresh key → `{"valid":true,...}` and a machine appears under the license.
- Second call with a **different** `machineId` (and `max_activations: 1`) → `valid:false`
  with a hardware-mismatch reason. This confirms node-locking works.

---

## 7. Hand-off to the desktop app

Once deployed:

1. Confirm `https://license.example.com/api/license/verify` is reachable over HTTPS.
2. Share the **public base URL** (e.g. `https://license.example.com`).
3. The desktop application is then configured to use that URL for verification — the URL
   is **not hardcoded**; it is supplied via the desktop app's configuration during the
   integration step.

---

## 8. Updating

```bash
git pull
npm install
npm run build
pm2 restart trapotato-verify        # or: docker compose up -d --build
```

Re-run `npm run db:init` only if `db/schema.sql` changed (it is idempotent).

---

## 9. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `[init-db] Failed: ...` connection error | `DATABASE_URL` wrong, DB host unreachable, or `DB_SSL` mismatch. Test with `psql`. |
| 500 on `/api/license/verify` | DB not initialised (`npm run db:init`) or DB down. Check `pm2 logs`. |
| Admin login always fails | `ADMIN_USERNAME`/`ADMIN_PASSWORD` not set in `.env`, or app not restarted after editing `.env`. |
| Logs show IP `::1` / empty | Nginx not forwarding `X-Forwarded-For` (see §4). |
| Cookie not persisting | `SESSION_SECRET` missing, or serving over plain HTTP in production (use HTTPS). |
| `permission denied for schema` on init | DB user lacks rights to `CREATE SCHEMA` / `CREATE EXTENSION pgcrypto`. Grant them or pre-create the schema. |
