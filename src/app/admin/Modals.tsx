'use client';

import { useState } from 'react';
import { PLAN_LIST, planLabel } from '@/lib/plans';
import type { Plan } from '@/lib/types';

/** Confirmation dialog — replaces window.confirm(). */
export function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="panel modal" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <p className="muted" style={{ lineHeight: 1.6 }}>{message}</p>
        <div className="row" style={{ marginTop: 18 }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className={`btn ${danger ? 'danger' : 'primary'}`}
            disabled={busy}
            onClick={async () => { setBusy(true); await onConfirm(); }}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Single-value input dialog — replaces window.prompt(). */
export function PromptModal({
  title,
  label,
  defaultValue = '',
  placeholder,
  type = 'text',
  submitLabel = 'Save',
  onSubmit,
  onClose,
}: {
  title: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  type?: string;
  submitLabel?: string;
  onSubmit: (value: string) => Promise<void> | void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const [busy, setBusy] = useState(false);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="panel modal" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <label>{label}</label>
        <input type={type} value={value} placeholder={placeholder} autoFocus onChange={(e) => setValue(e.target.value)} />
        <div className="row" style={{ marginTop: 18 }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy} onClick={async () => { setBusy(true); await onSubmit(value); }}>
            {busy ? 'Working…' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Plan selection dialog — replaces the prompt()-based plan picker. */
export function PlanPickerModal({
  title,
  subtitle,
  current,
  confirmLabel = 'Confirm',
  onSelect,
  onClose,
}: {
  title: string;
  subtitle?: string;
  current?: Plan;
  confirmLabel?: string;
  onSelect: (plan: Plan) => Promise<void> | void;
  onClose: () => void;
}) {
  const [plan, setPlan] = useState<Plan>(current && current !== 'none' ? current : 'monthly');
  const [busy, setBusy] = useState(false);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="panel modal" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {subtitle && <p className="muted">{subtitle}</p>}
        <label>Subscription plan</label>
        <select value={plan} onChange={(e) => setPlan(e.target.value as Plan)}>
          {PLAN_LIST.map((p) => (
            <option key={p.key} value={p.key}>{p.label} — {p.price}{p.days ? ` (${p.days} days)` : ' (never expires)'}</option>
          ))}
        </select>
        <p className="muted" style={{ fontSize: '0.8rem' }}>Selected: <b>{planLabel(plan)}</b></p>
        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy} onClick={async () => { setBusy(true); await onSelect(plan); }}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
