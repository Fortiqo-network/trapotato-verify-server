'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { LicenseStatus, Plan } from '@/lib/types';
import { PLAN_LIST } from '@/lib/plans';

export default function DetailActions({
  id,
  status,
  plan,
  isLifetime,
  productKey,
}: {
  id: string;
  status: LicenseStatus;
  plan: Plan;
  isLifetime: boolean;
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

  function pickPlan(mode: 'activate' | 'change-plan') {
    const opts = PLAN_LIST.map((p, i) => `${i + 1}) ${p.label} — ${p.price}`).join('\n');
    const choice = prompt(`Select a plan:\n${opts}\n\nEnter 1-4:`, '1');
    if (!choice) return;
    const idx = Number(choice) - 1;
    const p = PLAN_LIST[idx];
    if (!p) return alert('Invalid choice.');
    patch({ action: mode, plan: p.key });
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
      {(status === 'pending' || status === 'expired') && (
        <button className="btn primary" onClick={() => pickPlan('activate')}>Activate (pick plan)</button>
      )}
      {status === 'active' && <button className="btn" onClick={() => pickPlan('change-plan')}>Change plan</button>}
      {status === 'active'
        ? <button className="btn" onClick={() => patch({ action: 'disable' })}>Disable</button>
        : (status === 'disabled' || status === 'banned')
          ? <button className="btn" onClick={() => patch({ action: 'enable' })}>Enable</button>
          : null}
      {!isLifetime && <button className="btn" onClick={extend}>Extend</button>}
      <button className="btn" onClick={() => patch({ action: 'reset-machines' }, isLifetime ? `Reset the registered device for ${productKey}? They can then activate on a new machine.` : `Reset registered devices for ${productKey}?`)}>
        {isLifetime ? 'Reset device' : 'Reset devices'}
      </button>
      <button className="btn danger" onClick={ban}>Ban</button>
      <button className="btn danger" onClick={remove}>Delete</button>
    </div>
  );
}
