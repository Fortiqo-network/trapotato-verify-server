-- ─────────────────────────────────────────────────────────────
-- Trapotato Verify Server — database schema
-- Creates the dedicated `trapotato` schema and all licensing tables.
-- Safe to run multiple times (idempotent).
-- ─────────────────────────────────────────────────────────────

-- gen_random_uuid() lives in pgcrypto on older Postgres (<13). Enable if allowed.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS trapotato;
SET search_path TO trapotato;

-- ── Licenses ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS licenses (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_key             TEXT UNIQUE NOT NULL,
    customer_name           TEXT NOT NULL DEFAULT '',
    email                   TEXT NOT NULL DEFAULT '',
    status                  TEXT NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'disabled', 'expired', 'banned')),
    max_activations         INTEGER NOT NULL DEFAULT 1 CHECK (max_activations >= 1),
    activation_date         TIMESTAMPTZ,
    expiry_date             TIMESTAMPTZ,
    last_verification_time  TIMESTAMPTZ,
    last_ip                 TEXT,
    notes                   TEXT NOT NULL DEFAULT '',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_licenses_product_key ON licenses (product_key);
CREATE INDEX IF NOT EXISTS idx_licenses_status      ON licenses (status);
CREATE INDEX IF NOT EXISTS idx_licenses_email       ON licenses (email);

-- ── Machines (activations) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS machines (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id       UUID NOT NULL REFERENCES licenses (id) ON DELETE CASCADE,
    machine_id       TEXT NOT NULL,
    os               TEXT NOT NULL DEFAULT '',
    device_name      TEXT NOT NULL DEFAULT '',
    ip_address       TEXT NOT NULL DEFAULT '',
    activation_date  TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (license_id, machine_id)
);

CREATE INDEX IF NOT EXISTS idx_machines_license   ON machines (license_id);
CREATE INDEX IF NOT EXISTS idx_machines_last_seen ON machines (last_seen);

-- ── Verification logs (audit trail / history) ─────────────────
CREATE TABLE IF NOT EXISTS verification_logs (
    id           BIGSERIAL PRIMARY KEY,
    license_id   UUID REFERENCES licenses (id) ON DELETE CASCADE,
    product_key  TEXT,
    machine_id   TEXT,
    ip_address   TEXT,
    success      BOOLEAN NOT NULL,
    reason       TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_logs_license ON verification_logs (license_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_created ON verification_logs (created_at DESC);

-- ── Auto-update updated_at on licenses ────────────────────────
CREATE OR REPLACE FUNCTION trapotato.set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_licenses_updated_at ON licenses;
CREATE TRIGGER trg_licenses_updated_at
    BEFORE UPDATE ON licenses
    FOR EACH ROW EXECUTE FUNCTION trapotato.set_updated_at();
