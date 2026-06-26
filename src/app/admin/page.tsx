import Link from 'next/link';
import { getStats, listLicenses } from '@/lib/licenses';

export const dynamic = 'force-dynamic';

function fmt(d: string | null): string {
  return d ? new Date(d).toLocaleString() : '—';
}

export default async function OverviewPage() {
  const [stats, recent] = await Promise.all([getStats(), listLicenses({ limit: 8 })]);

  return (
    <>
      <h1>Dashboard</h1>
      <p className="muted" style={{ marginTop: 0 }}>License overview and live client activity.</p>

      <div className="grid stats" style={{ marginTop: 18 }}>
        <div className="stat"><div className="label">Total Licenses</div><div className="value">{stats.total}</div></div>
        <div className="stat"><div className="label">Active</div><div className="value green">{stats.active}</div></div>
        <div className="stat"><div className="label">Disabled</div><div className="value">{stats.disabled}</div></div>
        <div className="stat"><div className="label">Expired</div><div className="value amber">{stats.expired}</div></div>
        <div className="stat"><div className="label">Banned</div><div className="value red">{stats.banned}</div></div>
        <div className="stat"><div className="label">Online Clients</div><div className="value blue">{stats.onlineClients}</div></div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '28px 0 12px' }}>
        <h2 style={{ margin: 0 }}>Recent Licenses</h2>
        <Link className="btn sm" href="/admin/licenses">View all →</Link>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Product Key</th><th>Customer</th><th>Status</th><th>Machines</th><th>Expiry</th><th>Created</th>
            </tr>
          </thead>
          <tbody>
            {recent.items.length === 0 && (
              <tr><td colSpan={6} className="muted">No licenses yet. Create one from the Licenses page.</td></tr>
            )}
            {recent.items.map((l) => (
              <tr key={l.id}>
                <td><Link href={`/admin/licenses/${l.id}`}><code className="key">{l.product_key}</code></Link></td>
                <td>{l.customer_name || <span className="muted">—</span>}</td>
                <td><span className={`badge ${l.status}`}>{l.status}</span></td>
                <td>{l.machine_count} / {l.max_activations}</td>
                <td>{fmt(l.expiry_date)}</td>
                <td>{fmt(l.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
