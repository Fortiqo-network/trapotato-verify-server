'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { License, LicenseStatus } from '@/lib/types';

type Row = License & { machine_count: number };

const STATUS_OPTIONS: (LicenseStatus | 'all')[] = ['all', 'active', 'disabled', 'expired', 'banned'];

function fmt(d: string | null): string {
  return d ? new Date(d).toLocaleString() : '—';
}

export default function LicensesClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<LicenseStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (search) qs.set('search', search);
    if (status !== 'all') qs.set('status', status);
    const res = await fetch(`/api/admin/licenses?${qs}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      setRows(data.items ?? []);
      setTotal(data.total ?? 0);
    }
    setLoading(false);
  }, [search, status]);

  useEffect(() => {
    const t = setTimeout(load, 250); // debounce search
    return () => clearTimeout(t);
  }, [load]);

  async function action(id: string, body: Record<string, unknown>, confirmMsg?: string) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusyId(id);
    await fetch(`/api/admin/licenses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setBusyId(null);
    load();
  }

  async function remove(id: string, key: string) {
    if (!confirm(`Permanently DELETE license ${key}? This removes all its machines and logs.`)) return;
    setBusyId(id);
    await fetch(`/api/admin/licenses/${id}`, { method: 'DELETE' });
    setBusyId(null);
    load();
  }

  async function extend(id: string) {
    const days = prompt('Extend subscription by how many days?', '30');
    if (!days) return;
    const n = Number(days);
    if (!Number.isFinite(n) || n === 0) return alert('Enter a valid number of days.');
    action(id, { action: 'extend', days: n });
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1>Licenses</h1>
        <button className="btn primary" onClick={() => setShowCreate(true)}>+ Create Product Key</button>
      </div>

      <div className="toolbar">
        <input
          className="search"
          placeholder="Search key, name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value as LicenseStatus | 'all')} style={{ maxWidth: 180 }}>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s === 'all' ? 'All statuses' : s}</option>)}
        </select>
        <span className="muted">{loading ? 'Loading…' : `${total} license(s)`}</span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Product Key</th><th>Customer</th><th>Status</th><th>Machines</th>
              <th>Expiry</th><th>Last Verified</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 && (
              <tr><td colSpan={7} className="muted">No licenses found.</td></tr>
            )}
            {rows.map((l) => (
              <tr key={l.id} style={{ opacity: busyId === l.id ? 0.5 : 1 }}>
                <td>
                  <Link href={`/admin/licenses/${l.id}`}><code className="key">{l.product_key}</code></Link>
                  <button className="btn sm" style={{ marginLeft: 8 }} onClick={() => navigator.clipboard.writeText(l.product_key)} title="Copy">Copy</button>
                </td>
                <td>{l.customer_name || <span className="muted">—</span>}<br /><span className="muted" style={{ fontSize: '0.78rem' }}>{l.email}</span></td>
                <td><span className={`badge ${l.status}`}>{l.status}</span></td>
                <td>{l.machine_count} / {l.max_activations}</td>
                <td>{fmt(l.expiry_date)}</td>
                <td>{fmt(l.last_verification_time)}</td>
                <td>
                  <div className="actions">
                    {l.status === 'active'
                      ? <button className="btn sm" onClick={() => action(l.id, { action: 'disable' })}>Disable</button>
                      : <button className="btn sm" onClick={() => action(l.id, { action: 'enable' })}>Enable</button>}
                    <button className="btn sm" onClick={() => extend(l.id)}>Extend</button>
                    <button className="btn sm" onClick={() => action(l.id, { action: 'reset-machines' }, `Reset machine activations for ${l.product_key}? The user can then activate on a new device.`)}>Reset</button>
                    <button className="btn sm danger" onClick={() => remove(l.id, l.product_key)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
    </>
  );
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [customerName, setCustomerName] = useState('');
  const [email, setEmail] = useState('');
  const [maxActivations, setMaxActivations] = useState(1);
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<License | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const res = await fetch('/api/admin/licenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName, email, maxActivations,
        expiryDate: expiryDate ? new Date(expiryDate).toISOString() : null,
        notes,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? 'Failed to create');
      return;
    }
    setCreated(await res.json());
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="panel modal" onClick={(e) => e.stopPropagation()}>
        {created ? (
          <>
            <h2>License created</h2>
            <p className="muted">Share this product key with the customer:</p>
            <div className="panel" style={{ textAlign: 'center', padding: 16 }}>
              <code className="key" style={{ fontSize: '1.1rem' }}>{created.product_key}</code>
            </div>
            <div className="row" style={{ marginTop: 16 }}>
              <button className="btn" onClick={() => navigator.clipboard.writeText(created.product_key)}>Copy key</button>
              <button className="btn primary" onClick={onCreated}>Done</button>
            </div>
          </>
        ) : (
          <form onSubmit={submit}>
            <h2>Create Product Key</h2>
            <label>Customer Name</label>
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Jane Doe" />
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
            <div className="row">
              <div>
                <label>Max Activations (devices)</label>
                <input type="number" min={1} value={maxActivations} onChange={(e) => setMaxActivations(Number(e.target.value))} />
              </div>
              <div>
                <label>Expiry Date (optional)</label>
                <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
              </div>
            </div>
            <label>Notes (optional)</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            {error && <div className="error">{error}</div>}
            <div className="row" style={{ marginTop: 16 }}>
              <button type="button" className="btn" onClick={onClose}>Cancel</button>
              <button className="btn primary" disabled={saving}>{saving ? 'Creating…' : 'Create'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
