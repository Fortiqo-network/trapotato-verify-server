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
    whatsapp                TEXT NOT NULL DEFAULT '',
    status                  TEXT NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'active', 'disabled', 'expired', 'banned')),
    plan                    TEXT NOT NULL DEFAULT 'none'
                              CHECK (plan IN ('none', 'trial', 'monthly', 'quarterly', 'annual', 'lifetime')),
    requested_plan          TEXT NOT NULL DEFAULT 'none'
                              CHECK (requested_plan IN ('none', 'monthly', 'quarterly', 'annual', 'lifetime')),
    max_activations         INTEGER NOT NULL DEFAULT 1 CHECK (max_activations >= 1),
    activation_date         TIMESTAMPTZ,
    expiry_date             TIMESTAMPTZ,
    last_verification_time  TIMESTAMPTZ,
    last_ip                 TEXT,
    notes                   TEXT NOT NULL DEFAULT '',
    deleted_at              TIMESTAMPTZ,
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

-- ── Migration for existing databases (subscription support) ───
-- Adds the new columns and widens the status/plan constraints. Idempotent.
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS whatsapp       TEXT NOT NULL DEFAULT '';
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS plan           TEXT NOT NULL DEFAULT 'none';
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS requested_plan TEXT NOT NULL DEFAULT 'none';
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS deleted_at     TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_licenses_deleted ON licenses (deleted_at);

ALTER TABLE licenses DROP CONSTRAINT IF EXISTS licenses_status_check;
ALTER TABLE licenses ADD  CONSTRAINT licenses_status_check
    CHECK (status IN ('pending', 'active', 'disabled', 'expired', 'banned'));

ALTER TABLE licenses DROP CONSTRAINT IF EXISTS licenses_plan_check;
ALTER TABLE licenses ADD  CONSTRAINT licenses_plan_check
    CHECK (plan IN ('none', 'trial', 'monthly', 'quarterly', 'annual', 'lifetime'));

ALTER TABLE licenses DROP CONSTRAINT IF EXISTS licenses_requested_plan_check;
ALTER TABLE licenses ADD  CONSTRAINT licenses_requested_plan_check
    CHECK (requested_plan IN ('none', 'monthly', 'quarterly', 'annual', 'lifetime'));
