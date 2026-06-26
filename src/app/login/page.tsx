import { Suspense } from 'react';
import LoginForm from './LoginForm';

export const metadata = { title: 'Sign in — Trapotato' };

export default function LoginPage() {
  return (
    <div className="login-wrap">
      <div className="panel login-card">
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
  );
}
