'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { License } from '@/lib/types';
import { planLabel } from '@/lib/plans';
import { ConfirmModal } from '../Modals';

type Row = License & { machine_count: number };

function fmt(d: string | null): string {
  return d ? new Date(d).toLocaleString() : '—';
}

export default function DeletedClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [restoreRow, setRestoreRow] = useState<Row | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/licenses?deleted=1', { cache: 'no-store' });
    if (res.ok) setRows((await res.json()).items ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function doRestore(id: string) {
    setBusyId(id);
    await fetch(`/api/admin/licenses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'restore' }),
    });
    setBusyId(null);
    setRestoreRow(null);
    load();
  }

  return (
    <>
      <h1>Deleted Users</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Soft-deleted users — their data and product keys are preserved and hidden from the main list. Restore to bring them back.
      </p>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Product Key</th><th>User</th><th>WhatsApp</th><th>Plan</th><th>Deleted At</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 && <tr><td colSpan={6} className="muted">No deleted users.</td></tr>}
            {rows.map((l) => (
              <tr key={l.id} style={{ opacity: busyId === l.id ? 0.5 : 1 }}>
                <td><Link href={`/admin/licenses/${l.id}`}><code className="key">{l.product_key}</code></Link></td>
                <td>{l.customer_name || <span className="muted">—</span>}<br /><span className="muted" style={{ fontSize: '0.78rem' }}>{l.email}</span></td>
                <td className="muted">{l.whatsapp || '—'}</td>
                <td>{l.plan !== 'none' ? planLabel(l.plan) : <span className="muted">{l.requested_plan !== 'none' ? `wanted ${planLabel(l.requested_plan)}` : '—'}</span>}</td>
                <td className="muted">{fmt(l.deleted_at)}</td>
                <td>
                  <div className="actions">
                    <Link className="btn sm" href={`/admin/licenses/${l.id}`}>View</Link>
                    <button className="btn sm primary" onClick={() => setRestoreRow(l)}>Restore</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {restoreRow && (
        <ConfirmModal
          title="Restore user"
          message={`Restore ${restoreRow.product_key} (${restoreRow.customer_name || restoreRow.email}) back to the active list?`}
          confirmLabel="Restore"
          onConfirm={() => doRestore(restoreRow.id)}
          onClose={() => setRestoreRow(null)}
        />
      )}
    </>
  );
}
