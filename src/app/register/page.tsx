import { PLAN_LIST, SUPPORT_EMAIL, SUPPORT_WHATSAPP } from '@/lib/plans';
import RegisterForm from './RegisterForm';

export const metadata = { title: 'Register — Trapotato' };

export default function RegisterPage() {
  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <div style={{ textAlign: 'center', margin: '8px 0 24px' }}>
        <div className="login-card brand" style={{ justifyContent: 'center', fontSize: '1.6rem' }}>
          <span className="dot" style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--brand)', boxShadow: '0 0 12px var(--brand)' }} />
          &nbsp;Trapotato
        </div>
        <p className="muted">Create your account and product key</p>
      </div>

      {/* Subscription plans — shown prominently */}
      <div className="panel" style={{ marginBottom: 18 }}>
        <h2 style={{ marginTop: 0 }}>Subscription Plans</h2>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          {PLAN_LIST.map((p) => (
            <div key={p.key} className="stat" style={{ textAlign: 'center' }}>
              <div className="label">{p.label}</div>
              <div className="value" style={{ fontSize: '1.5rem' }}>{p.price}</div>
            </div>
          ))}
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>
          To purchase, register below and contact{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> with your product key.
        </p>
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Register</h2>
        <RegisterForm />
      </div>

      {/* Support */}
      <div className="panel" style={{ marginTop: 18 }}>
        <h3 style={{ marginTop: 0 }}>Support</h3>
        <p className="muted" style={{ margin: '4px 0' }}>
          <b>Email:</b> <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </p>
        <p className="muted" style={{ margin: '4px 0' }}>
          <b>WhatsApp (urgent):</b> {SUPPORT_WHATSAPP}
        </p>
        <p className="muted" style={{ margin: '8px 0 0' }}>
          If you forget your product key, email your registered details to{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we will help recover your license.
        </p>
      </div>
    </div>
  );
}
