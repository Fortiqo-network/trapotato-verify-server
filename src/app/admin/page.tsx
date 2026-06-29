import Link from 'next/link';
import { getStats, listLicenses } from '@/lib/licenses';
import { getEarlyAccessStats, listEarlyAccess } from '@/lib/early-access';
import { planLabel } from '@/lib/plans';

export const dynamic = 'force-dynamic';

function fmt(d: string | null): string {
  return d ? new Date(d).toLocaleString() : '—';
}

export default async function OverviewPage() {
  const [stats, recent, earlyStats, earlyRecent] = await Promise.all([
    getStats(),
    listLicenses({ limit: 8 }),
    getEarlyAccessStats(),
    listEarlyAccess({ limit: 8 }),
  ]);

  return (
    <>
      <h1>Dashboard</h1>
      <p className="muted" style={{ marginTop: 0 }}>License overview and live client activity.</p>

      <div className="grid stats" style={{ marginTop: 18 }}>
        <div className="stat"><div className="label">Total Licenses</div><div className="value">{stats.total}</div></div>
        <div className="stat"><div className="label">Pending</div><div className="value" style={{ color: '#c4b5fd' }}>{stats.pending}</div></div>
        <div className="stat"><div className="label">Active</div><div className="value green">{stats.active}</div></div>
        <div className="stat"><div className="label">Disabled</div><div className="value">{stats.disabled}</div></div>
        <div className="stat"><div className="label">Expired</div><div className="value amber">{stats.expired}</div></div>
        <div className="stat"><div className="label">Banned</div><div className="value red">{stats.banned}</div></div>
        <div className="stat"><div className="label">Online Clients</div><div className="value blue">{stats.onlineClients}</div></div>
        <div className="stat"><div className="label">Deleted</div><div className="value muted">{stats.deleted}</div></div>
        <div className="stat">
          <div className="label">Early Access · New</div>
          <div className="value" style={{ color: '#c4b5fd' }}>{earlyStats.new}</div>
          <div className="muted" style={{ fontSize: '0.78rem', marginTop: 2 }}>{earlyStats.total} total</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '28px 0 12px' }}>
        <h2 style={{ margin: 0 }}>Recent Licenses</h2>
        <Link className="btn sm" href="/admin/licenses">View all →</Link>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Product Key</th><th>Customer</th><th>Status</th><th>Plan</th><th>Devices</th><th>Expiry</th>
            </tr>
          </thead>
          <tbody>
            {recent.items.length === 0 && (
              <tr><td colSpan={6} className="muted">No licenses yet.</td></tr>
            )}
            {recent.items.map((l) => (
              <tr key={l.id}>
                <td><Link href={`/admin/licenses/${l.id}`}><code className="key">{l.product_key}</code></Link></td>
                <td>{l.customer_name || <span className="muted">—</span>}</td>
                <td><span className={`badge ${l.status}`}>{l.status}</span></td>
                <td>{l.status === 'active' ? planLabel(l.plan) : <span className="muted">{l.requested_plan !== 'none' ? `wants ${planLabel(l.requested_plan)}` : '—'}</span>}</td>
                <td>{l.machine_count}</td>
                <td>{l.plan === 'lifetime' ? 'Never' : fmt(l.expiry_date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '28px 0 12px' }}>
        <h2 style={{ margin: 0 }}>Recent Early-Access Applications</h2>
        <Link className="btn sm" href="/admin/early-access">View all →</Link>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Applicant</th><th>WhatsApp</th><th>Needs for</th><th>Terms</th><th>Submitted</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {earlyRecent.items.length === 0 && (
              <tr><td colSpan={6} className="muted">No applications yet.</td></tr>
            )}
            {earlyRecent.items.map((a) => (
              <tr key={a.id}>
                <td>{a.full_name || <span className="muted">—</span>}<br /><span className="muted" style={{ fontSize: '0.78rem' }}>{a.email}</span></td>
                <td className="muted">{a.whatsapp || '—'}</td>
                <td className="muted">{a.duration || '—'}</td>
                <td>{a.accepted_terms ? <span className="badge active">accepted</span> : <span className="badge banned">no</span>}</td>
                <td className="muted">{fmt(a.created_at)}</td>
                <td><Link href="/admin/early-access">{a.status}</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
