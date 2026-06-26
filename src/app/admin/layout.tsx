import Link from 'next/link';
import LogoutButton from './LogoutButton';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav className="nav">
        <Link href="/admin" className="brand" style={{ color: 'var(--text)' }}>
          <span className="dot" />
          Trapotato
        </Link>
        <div className="links">
          <Link href="/admin">Overview</Link>
          <Link href="/admin/licenses">Users &amp; Licenses</Link>
          <Link href="/admin/deleted">Deleted</Link>
        </div>
        <div className="spacer" />
        <LogoutButton />
      </nav>
      <div className="container">{children}</div>
    </>
  );
}
