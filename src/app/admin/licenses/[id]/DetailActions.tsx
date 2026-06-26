'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { LicenseStatus } from '@/lib/types';

export default function DetailActions({
  id,
  status,
  productKey,
}: {
  id: string;
  status: LicenseStatus;
  productKey: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function patch(body: Record<string, unknown>, confirmMsg?: string) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusy(true);
    await fetch(`/api/admin/licenses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setBusy(false);
    router.refresh();
  }

  async function extend() {
    const days = prompt('Extend subscription by how many days?', '30');
    if (!days) return;
    const n = Number(days);
    if (!Number.isFinite(n) || n === 0) return alert('Enter a valid number of days.');
    patch({ action: 'extend', days: n });
  }

  async function ban() {
    if (!confirm(`Ban ${productKey}? The client will be locked out immediately.`)) return;
    patch({ action: 'ban' });
  }

  async function remove() {
    if (!confirm(`Permanently DELETE ${productKey}? This removes its machines and logs.`)) return;
    setBusy(true);
    await fetch(`/api/admin/licenses/${id}`, { method: 'DELETE' });
    setBusy(false);
    router.replace('/admin/licenses');
    router.refresh();
  }

  return (
    <div className="actions" style={{ marginTop: 14, opacity: busy ? 0.5 : 1 }}>
      {status === 'active'
        ? <button className="btn" onClick={() => patch({ action: 'disable' })}>Disable</button>
        : <button className="btn" onClick={() => patch({ action: 'enable' })}>Enable</button>}
      <button className="btn" onClick={extend}>Extend Subscription</button>
      <button className="btn" onClick={() => patch({ action: 'reset-machines' }, `Reset machine activations for ${productKey}? The user can then activate on a new device.`)}>Reset Machines</button>
      <button className="btn danger" onClick={ban}>Ban</button>
      <button className="btn danger" onClick={remove}>Delete</button>
    </div>
  );
}
