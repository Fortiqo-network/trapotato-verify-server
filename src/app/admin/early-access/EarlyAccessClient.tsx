'use client';

import { useCallback, useEffect, useState } from 'react';
import type { EarlyAccess, EarlyAccessStatus } from '@/lib/types';
import { ConfirmModal } from '../Modals';

const STATUS_OPTIONS: (EarlyAccessStatus | 'all')[] = ['all', 'new', 'contacted', 'approved', 'rejected'];
const STATUSES: EarlyAccessStatus[] = ['new', 'contacted', 'approved', 'rejected'];

// Reuse the existing license badge palette for a consistent look.
const BADGE_CLASS: Record<EarlyAccessStatus, string> = {
  new: 'pending',
  contacted: 'online',
  approved: 'active',
  rejected: 'banned',
};

function fmt(d: string | null): string {
  return d ? new Date(d).toLocaleString() : '—';
}

export default function EarlyAccessClient() {
  const [rows, setRows] = useState<EarlyAccess[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<EarlyAccessStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EarlyAccess | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<EarlyAccess | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (search) qs.set('search', search);
    if (status !== 'all') qs.set('status', status);
    const res = await fetch(`/api/admin/early-access?${qs}`, { cache: 'no-store' });
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

  async function patch(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    const res = await fetch(`/api/admin/early-access/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setBusyId(null);
    if (res.ok) {
      const updated: EarlyAccess = await res.json();
      setRows((rs) => rs.map((r) => (r.id === id ? updated : r)));
      setDetail((d) => (d && d.id === id ? updated : d));
    }
  }

  async function remove(rec: EarlyAccess) {
    setBusyId(rec.id);
    await fetch(`/api/admin/early-access/${rec.id}`, { method: 'DELETE' });
    setBusyId(null);
    setConfirmDelete(null);
    setDetail((d) => (d && d.id === rec.id ? null : d));
    load();
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1>Early Access Applications</h1>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        Requests from the marketing site. Each includes the mandatory Terms &amp; License acceptance and the
        submitting device details.
      </p>

      <div className="toolbar">
        <input
          className="search"
          placeholder="Search name, email, WhatsApp or company…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value as EarlyAccessStatus | 'all')} style={{ maxWidth: 180 }}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s === 'all' ? 'All statuses' : s}</option>
          ))}
        </select>
        <span className="muted">{loading ? 'Loading…' : `${total} application(s)`}</span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Applicant</th><th>WhatsApp</th><th>Use case</th><th>Needs for</th>
              <th>Terms</th><th>Submitted</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 && <tr><td colSpan={8} className="muted">No applications yet.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} style={{ opacity: busyId === r.id ? 0.5 : 1 }}>
                <td>
                  {r.full_name || <span className="muted">—</span>}
                  <br /><span className="muted" style={{ fontSize: '0.78rem' }}>{r.email}</span>
                </td>
                <td className="muted">{r.whatsapp || '—'}</td>
                <td title={r.use_case} style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.use_case || <span className="muted">—</span>}
                </td>
                <td className="muted">{r.duration || '—'}</td>
                <td>
                  {r.accepted_terms
                    ? <span className="badge active" title={`Accepted ${fmt(r.accepted_at)}${r.terms_version ? ` · ${r.terms_version}` : ''}`}>accepted</span>
                    : <span className="badge banned">no</span>}
                </td>
                <td className="muted">{fmt(r.created_at)}</td>
                <td>
                  <select
                    value={r.status}
                    onChange={(e) => patch(r.id, { status: e.target.value })}
                    style={{ maxWidth: 130 }}
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td>
                  <div className="actions">
                    <button className="btn sm" onClick={() => setDetail(r)}>View</button>
                    <button className="btn sm danger" onClick={() => setConfirmDelete(r)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detail && (
        <DetailModal
          rec={detail}
          busy={busyId === detail.id}
          onStatus={(s) => patch(detail.id, { status: s })}
          onSaveNotes={(notes) => patch(detail.id, { notes })}
          onClose={() => setDetail(null)}
        />
      )}
      {confirmDelete && (
        <ConfirmModal
          title="Delete application"
          message={`Permanently delete the early-access application from ${confirmDelete.full_name || confirmDelete.email}? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => remove(confirmDelete)}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div className="muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ marginTop: 2, wordBreak: 'break-word' }}>{value || <span className="muted">—</span>}</div>
    </div>
  );
}

function DetailModal({
  rec,
  busy,
  onStatus,
  onSaveNotes,
  onClose,
}: {
  rec: EarlyAccess;
  busy: boolean;
  onStatus: (s: EarlyAccessStatus) => void;
  onSaveNotes: (notes: string) => void;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState(rec.notes);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="panel modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h2 style={{ margin: 0 }}>{rec.full_name || rec.email}</h2>
          <span className={`badge ${BADGE_CLASS[rec.status]}`}>{rec.status}</span>
        </div>

        <div className="row" style={{ marginTop: 16, alignItems: 'flex-start' }}>
          <div style={{ minWidth: 240 }}>
            <Field label="Email" value={<a href={`mailto:${rec.email}`}>{rec.email}</a>} />
            <Field label="WhatsApp" value={rec.whatsapp} />
            <Field label="Company" value={rec.company} />
            <Field label="Role" value={rec.role} />
            <Field label="Needs access for" value={rec.duration} />
            <Field label="How they heard" value={rec.referral} />
          </div>
          <div style={{ minWidth: 240 }}>
            <Field
              label="Terms & License"
              value={rec.accepted_terms
                ? <span className="badge active">Accepted {fmt(rec.accepted_at)}{rec.terms_version ? ` · ${rec.terms_version}` : ''}</span>
                : <span className="badge banned">Not accepted</span>}
            />
            <Field label="Submitted" value={fmt(rec.created_at)} />
            <Field label="IP address" value={rec.ip_address} />
            <Field label="Platform" value={rec.platform} />
            <Field label="Timezone" value={rec.timezone} />
            <Field label="Language / Screen" value={[rec.language, rec.screen].filter(Boolean).join(' · ')} />
          </div>
        </div>

        <Field label="Use case" value={rec.use_case} />

        <details style={{ marginTop: 6 }}>
          <summary className="muted" style={{ cursor: 'pointer' }}>Device details (raw)</summary>
          <pre style={{ marginTop: 8, padding: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 9, overflowX: 'auto', fontSize: '0.78rem' }}>
            {JSON.stringify({ userAgent: rec.user_agent, ...rec.device_details }, null, 2)}
          </pre>
        </details>

        <label>Admin notes</label>
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes…" />

        <div className="row" style={{ marginTop: 16 }}>
          <select value={rec.status} onChange={(e) => onStatus(e.target.value as EarlyAccessStatus)} disabled={busy} style={{ maxWidth: 160 }}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <div style={{ flex: 1 }} />
          <button className="btn" onClick={onClose}>Close</button>
          <button className="btn primary" disabled={busy || notes === rec.notes} onClick={() => onSaveNotes(notes)}>
            {busy ? 'Saving…' : 'Save notes'}
          </button>
        </div>
      </div>
    </div>
  );
}
