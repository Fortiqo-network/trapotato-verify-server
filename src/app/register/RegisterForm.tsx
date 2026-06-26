'use client';

import { useState } from 'react';
import { PLAN_LIST, SUPPORT_EMAIL, SUPPORT_WHATSAPP } from '@/lib/plans';

export default function RegisterForm() {
  const [customerName, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [requestedPlan, setPlan] = useState('monthly');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ productKey: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!customerName || !email || !whatsapp) {
      setError('Name, email, and WhatsApp number are required.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName, email, whatsapp, requestedPlan }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Registration failed.');
        return;
      }
      setResult({ productKey: data.productKey });
    } catch {
      setError('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div>
        <h3 style={{ marginTop: 0 }}>Your product key</h3>
        <div className="panel" style={{ textAlign: 'center', padding: 18 }}>
          <code className="key" style={{ fontSize: '1.2rem' }}>{result.productKey}</code>
          <div style={{ marginTop: 10 }}>
            <button className="btn" onClick={() => navigator.clipboard.writeText(result.productKey)}>Copy key</button>
          </div>
        </div>
        <div className="badge expired" style={{ display: 'inline-block', marginTop: 14 }}>Inactive — awaiting payment verification</div>
        <p className="muted" style={{ marginTop: 10 }}>
          Your key has been created but <b>will remain inactive until your payment is verified by the admin</b>.
          To activate, contact <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> (WhatsApp: {SUPPORT_WHATSAPP})
          with this product key and your chosen plan. <b>Save this key</b> — you'll need it to activate the app.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <label>Full Name</label>
      <input value={customerName} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" required />
      <label>Email</label>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" required />
      <label>WhatsApp Number (for payment communication)</label>
      <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+1 555 123 4567" required />
      <label>Which plan do you want to buy?</label>
      <select value={requestedPlan} onChange={(e) => setPlan(e.target.value)}>
        {PLAN_LIST.map((p) => (
          <option key={p.key} value={p.key}>{p.label} — {p.price}</option>
        ))}
      </select>
      {error && <div className="error">{error}</div>}
      <button className="btn primary" style={{ width: '100%', marginTop: 16, justifyContent: 'center' }} disabled={busy}>
        {busy ? 'Creating…' : 'Create my product key'}
      </button>
    </form>
  );
}
