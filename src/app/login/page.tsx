import { Suspense } from 'react';
import Link from 'next/link';
import LoginForm from './LoginForm';
import { PLAN_LIST, SUPPORT_EMAIL, SUPPORT_WHATSAPP } from '@/lib/plans';

export const metadata = { title: 'Sign in — Trapotato' };

export default function LoginPage() {
  return (
    <div className="login-wrap">
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Subscription plans — shown prominently */}
        <div className="panel" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0, textAlign: 'center' }}>Trapotato Subscription Plans</h3>
          <table style={{ width: '100%', fontSize: '0.9rem' }}>
            <tbody>
              {PLAN_LIST.map((p) => (
                <tr key={p.key}>
                  <td style={{ padding: '4px 0', color: 'var(--muted)' }}>{p.label}</td>
                  <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 700 }}>{p.price}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted" style={{ margin: '8px 0 0', fontSize: '0.82rem' }}>
            To purchase, <Link href="/register">register here</Link> and contact{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> · WhatsApp {SUPPORT_WHATSAPP}
          </p>
        </div>

        <div className="panel login-card" style={{ maxWidth: '100%' }}>
          <div className="brand">
            <span className="dot" style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--brand)', boxShadow: '0 0 12px var(--brand)' }} />
            Trapotato
          </div>
          <p className="muted" style={{ textAlign: 'center', marginTop: 0 }}>License Administration</p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
