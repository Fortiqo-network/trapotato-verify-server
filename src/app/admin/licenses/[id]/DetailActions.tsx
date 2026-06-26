'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { LicenseStatus, Plan } from '@/lib/types';
import { ConfirmModal, PromptModal, PlanPickerModal } from '../../Modals';

type ModalKind = null | 'activate' | 'change-plan' | 'extend' | 'disable' | 'ban' | 'reset' | 'delete';

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
  const [modal, setModal] = useState<ModalKind>(null);
  const [busy, setBusy] = useState(false);
  const close = () => setModal(null);

  async function patch(body: Record<string, unknown>) {
    await fetch(`/api/admin/licenses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    close();
    router.refresh();
  }

  async function enable() {
    setBusy(true);
    await patch({ action: 'enable' });
    setBusy(false);
  }

  async function del() {
    await fetch(`/api/admin/licenses/${id}`, { method: 'DELETE' });
    close();
    router.replace('/admin/licenses');
    router.refresh();
  }

  return (
    <>
      <div className="actions" style={{ marginTop: 14, opacity: busy ? 0.5 : 1 }}>
        {(status === 'pending' || status === 'expired') && (
          <button className="btn primary" onClick={() => setModal('activate')}>Activate (pick plan)</button>
        )}
        {status === 'active' && <button className="btn" onClick={() => setModal('change-plan')}>Change plan</button>}
        {status === 'active'
          ? <button className="btn" onClick={() => setModal('disable')}>Disable</button>
          : (status === 'disabled' || status === 'banned')
            ? <button className="btn" onClick={enable}>Enable</button>
            : null}
        {!isLifetime && <button className="btn" onClick={() => setModal('extend')}>Extend</button>}
        <button className="btn" onClick={() => setModal('reset')}>{isLifetime ? 'Reset device' : 'Reset devices'}</button>
        <button className="btn danger" onClick={() => setModal('ban')}>Ban</button>
        <button className="btn danger" onClick={() => setModal('delete')}>Delete</button>
      </div>

      {modal === 'activate' && (
        <PlanPickerModal title="Activate license" subtitle={productKey} current={plan} confirmLabel="Activate"
          onSelect={(p) => patch({ action: 'activate', plan: p })} onClose={close} />
      )}
      {modal === 'change-plan' && (
        <PlanPickerModal title="Change plan" subtitle={productKey} current={plan} confirmLabel="Change plan"
          onSelect={(p) => patch({ action: 'change-plan', plan: p })} onClose={close} />
      )}
      {modal === 'extend' && (
        <PromptModal title="Extend subscription" label="Extend by how many days?" defaultValue="30" type="number" submitLabel="Extend"
          onSubmit={(v) => { const n = Number(v); if (!Number.isFinite(n) || n === 0) { close(); return; } return patch({ action: 'extend', days: n }); }} onClose={close} />
      )}
      {modal === 'disable' && (
        <ConfirmModal title="Disable license" message={`Disable ${productKey}? The app will stop working after its next online check and show the "contact the administrator" message.`} confirmLabel="Disable"
          onConfirm={() => patch({ action: 'disable' })} onClose={close} />
      )}
      {modal === 'ban' && (
        <ConfirmModal danger title="Ban license" message={`Ban ${productKey}? The client is locked out on the next verification.`} confirmLabel="Ban"
          onConfirm={() => patch({ action: 'ban' })} onClose={close} />
      )}
      {modal === 'reset' && (
        <ConfirmModal title={isLifetime ? 'Reset registered device' : 'Reset registered devices'}
          message={isLifetime ? `Reset the registered device for ${productKey}? They can then activate on a new machine.` : `Reset registered devices for ${productKey}?`}
          confirmLabel="Reset" onConfirm={() => patch({ action: 'reset-machines' })} onClose={close} />
      )}
      {modal === 'delete' && (
        <ConfirmModal danger title="Delete user" confirmLabel="Delete"
          message={`Move ${productKey} to Deleted? Nothing is permanently removed — you can view and restore this user later from the Deleted view.`}
          onConfirm={del} onClose={close} />
      )}
    </>
  );
}
