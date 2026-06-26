'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { License, LicenseStatus } from '@/lib/types';
import { PLAN_LIST, planLabel } from '@/lib/plans';
import { ConfirmModal } from '../Modals';

type ConfirmState = { title: string; message: string; confirmLabel: string; danger?: boolean; run: () => Promise<void> };

type Row = License & { machine_count: number };

const STATUS_OPTIONS: (LicenseStatus | 'all')[] = ['all', 'pending', 'active', 'disabled', 'expired', 'banned'];

function fmt(d: string | null): string {
  return d ? new Date(d).toLocaleDateString() : '—';
}

export default function LicensesClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<LicenseStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [planModal, setPlanModal] = useState<{ row: Row; mode: 'activate' | 'change' } | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
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
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  async function action(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    await fetch(`/api/admin/licenses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setBusyId(null);
    load();
  }

  function askReset(l: Row) {
    setConfirmState({
      title: l.plan === 'lifetime' ? 'Reset registered device' : 'Reset registered devices',
      message: `Reset the registered device for ${l.product_key}? They can then activate on a new machine.`,
      confirmLabel: 'Reset',
      run: async () => { await action(l.id, { action: 'reset-machines' }); setConfirmState(null); },
    });
  }

  function askDelete(l: Row) {
    setConfirmState({
      title: 'Delete user',
      message: `Move ${l.product_key} to Deleted? Nothing is permanently removed — you can view and restore this user later from the Deleted view.`,
      confirmLabel: 'Delete',
      danger: true,
      run: async () => {
        setBusyId(l.id);
        await fetch(`/api/admin/licenses/${l.id}`, { method: 'DELETE' });
        setBusyId(null);
        setConfirmState(null);
        load();
      },
    });
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1>Users &amp; Licenses</h1>
        <button className="btn primary" onClick={() => setShowCreate(true)}>+ Create Product Key</button>
      </div>

      <div className="toolbar">
        <input className="search" placeholder="Search key, name, email or WhatsApp…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value as LicenseStatus | 'all')} style={{ maxWidth: 180 }}>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s === 'all' ? 'All statuses' : s}</option>)}
        </select>
        <span className="muted">{loading ? 'Loading…' : `${total} record(s)`}</span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Product Key</th><th>User</th><th>WhatsApp</th><th>Status</th><th>Plan</th>
              <th>Devices</th><th>Expiry</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 && <tr><td colSpan={8} className="muted">No records found.</td></tr>}
            {rows.map((l) => (
              <tr key={l.id} style={{ opacity: busyId === l.id ? 0.5 : 1 }}>
                <td><Link href={`/admin/licenses/${l.id}`}><code className="key">{l.product_key}</code></Link></td>
                <td>{l.customer_name || <span className="muted">—</span>}<br /><span className="muted" style={{ fontSize: '0.78rem' }}>{l.email}</span></td>
                <td className="muted">{l.whatsapp || '—'}</td>
                <td><span className={`badge ${l.status}`}>{l.status}</span></td>
                <td>
                  {l.status === 'active' ? planLabel(l.plan)
                    : <span className="muted">{l.requested_plan !== 'none' ? `wants ${planLabel(l.requested_plan)}` : '—'}</span>}
                </td>
                <td>{l.machine_count}{l.plan === 'lifetime' ? ' / 1' : ''}</td>
                <td>{l.plan === 'lifetime' ? 'Never' : fmt(l.expiry_date)}</td>
                <td>
                  <div className="actions">
                    {l.status === 'pending' || l.status === 'expired'
                      ? <button className="btn sm primary" onClick={() => setPlanModal({ row: l, mode: 'activate' })}>Activate</button>
                      : null}
                    {l.status === 'active' && <button className="btn sm" onClick={() => setPlanModal({ row: l, mode: 'change' })}>Change plan</button>}
                    {l.status === 'active'
                      ? <button className="btn sm" onClick={() => action(l.id, { action: 'disable' })}>Disable</button>
                      : (l.status === 'disabled' || l.status === 'banned')
                        ? <button className="btn sm" onClick={() => action(l.id, { action: 'enable' })}>Enable</button>
                        : null}
                    {l.plan === 'lifetime' && <button className="btn sm" onClick={() => askReset(l)}>Reset device</button>}
                    <button className="btn sm danger" onClick={() => askDelete(l)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirmState && (
        <ConfirmModal
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          danger={confirmState.danger}
          onConfirm={confirmState.run}
          onClose={() => setConfirmState(null)}
        />
      )}
      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
      {planModal && (
        <PlanModal
          row={planModal.row}
          mode={planModal.mode}
          onClose={() => setPlanModal(null)}
          onDone={() => { setPlanModal(null); load(); }}
        />
      )}
    </>
  );
}

function PlanModal({ row, mode, onClose, onDone }: { row: Row; mode: 'activate' | 'change'; onClose: () => void; onDone: () => void }) {
  const [plan, setPlan] = useState(row.requested_plan !== 'none' ? row.requested_plan : row.plan !== 'none' ? row.plan : 'monthly');
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    await fetch(`/api/admin/licenses/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: mode === 'activate' ? 'activate' : 'change-plan', plan }),
    });
    setBusy(false);
    onDone();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="panel modal" onClick={(e) => e.stopPropagation()}>
        <h2>{mode === 'activate' ? 'Activate license' : 'Change plan'}</h2>
        <p className="muted">{row.customer_name} · <code className="key">{row.product_key}</code></p>
        {row.requested_plan !== 'none' && <p className="muted">User requested: <b>{planLabel(row.requested_plan)}</b></p>}
        <label>Subscription plan</label>
        <select value={plan} onChange={(e) => setPlan(e.target.value as never)}>
          {PLAN_LIST.map((p) => <option key={p.key} value={p.key}>{p.label} — {p.price}{p.days ? ` (${p.days} days)` : ' (never expires)'}</option>)}
        </select>
        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={go} disabled={busy}>{busy ? 'Saving…' : (mode === 'activate' ? 'Activate' : 'Change plan')}</button>
        </div>
      </div>
    </div>
  );
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [customerName, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [requestedPlan, setPlan] = useState('monthly');
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
      body: JSON.stringify({ customerName, email, whatsapp, requestedPlan }),
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
            <h2>Product key created (pending)</h2>
            <div className="panel" style={{ textAlign: 'center', padding: 16 }}>
              <code className="key" style={{ fontSize: '1.1rem' }}>{created.product_key}</code>
            </div>
            <p className="muted">Inactive until you activate it with a plan.</p>
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn" onClick={() => navigator.clipboard.writeText(created.product_key)}>Copy key</button>
              <button className="btn primary" onClick={onCreated}>Done</button>
            </div>
          </>
        ) : (
          <form onSubmit={submit}>
            <h2>Create Product Key</h2>
            <label>Full Name</label>
            <input value={customerName} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
            <label>WhatsApp Number</label>
            <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+1 555 123 4567" />
            <label>Requested plan</label>
            <select value={requestedPlan} onChange={(e) => setPlan(e.target.value)}>
              {PLAN_LIST.map((p) => <option key={p.key} value={p.key}>{p.label} — {p.price}</option>)}
            </select>
            {error && <div className="error">{error}</div>}
            <div className="row" style={{ marginTop: 16 }}>
              <button type="button" className="btn" onClick={onClose}>Cancel</button>
              <button className="btn primary" disabled={saving}>{saving ? 'Creating…' : 'Create (pending)'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
