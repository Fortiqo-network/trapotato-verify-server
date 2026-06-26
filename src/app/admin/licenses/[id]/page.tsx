import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLicense, getLogs, getMachines } from '@/lib/licenses';
import { config } from '@/lib/config';
import { planLabel } from '@/lib/plans';
import DetailActions from './DetailActions';

export const dynamic = 'force-dynamic';

function fmt(d: string | null): string {
  return d ? new Date(d).toLocaleString() : '—';
}

function isOnline(lastSeen: string): boolean {
  return Date.now() - new Date(lastSeen).getTime() < config.onlineWindowMinutes * 60_000;
}

export default async function LicenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const license = await getLicense(id);
  if (!license) notFound();

  const [machines, logs] = await Promise.all([getMachines(id), getLogs(id, 200)]);

  return (
    <>
      <Link href="/admin/licenses" className="muted">← Back to licenses</Link>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
        <h1 style={{ marginBottom: 0 }}><code className="key" style={{ fontSize: '1.2rem' }}>{license.product_key}</code></h1>
        <span className={`badge ${license.status}`}>{license.status}</span>
      </div>

      <DetailActions
        id={license.id}
        status={license.status}
        plan={license.plan}
        isLifetime={license.plan === 'lifetime'}
        productKey={license.product_key}
      />

      {/* License info */}
      <div className="panel" style={{ marginTop: 16 }}>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <Info label="Customer" value={license.customer_name || '—'} />
          <Info label="Email" value={license.email || '—'} />
          <Info label="WhatsApp" value={license.whatsapp || '—'} />
          <Info label="Active Plan" value={planLabel(license.plan)} />
          <Info label="Requested Plan" value={planLabel(license.requested_plan)} />
          <Info label="Registered Devices" value={license.plan === 'lifetime' ? `${machines.length} / 1 (lifetime lock)` : `${machines.length}`} />
          <Info label="Activation Date" value={fmt(license.activation_date)} />
          <Info label="Expiry Date" value={license.plan === 'lifetime' ? 'Never (lifetime)' : fmt(license.expiry_date)} />
          <Info label="Last Verification" value={fmt(license.last_verification_time)} />
          <Info label="Last IP" value={license.last_ip || '—'} />
          <Info label="Created" value={fmt(license.created_at)} />
        </div>
        {license.notes && <><div className="section-title">Notes</div><p style={{ margin: 0 }}>{license.notes}</p></>}
      </div>

      {/* Machines */}
      <div className="section-title">Machines / Activations ({machines.length})</div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Machine ID (Hardware)</th><th>OS</th><th>Device</th><th>IP</th><th>Activated</th><th>Last Seen</th><th></th></tr>
          </thead>
          <tbody>
            {machines.length === 0 && <tr><td colSpan={7} className="muted">No machines activated yet.</td></tr>}
            {machines.map((m) => (
              <tr key={m.id}>
                <td><code className="key" style={{ fontSize: '0.75rem' }}>{m.machine_id}</code></td>
                <td>{m.os || '—'}</td>
                <td>{m.device_name || '—'}</td>
                <td>{m.ip_address || '—'}</td>
                <td>{fmt(m.activation_date)}</td>
                <td>{fmt(m.last_seen)}</td>
                <td>{isOnline(m.last_seen) && <span className="badge online">online</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Verification logs */}
      <div className="section-title">Verification History ({logs.length})</div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Time</th><th>Result</th><th>Machine ID</th><th>IP</th><th>Reason</th></tr>
          </thead>
          <tbody>
            {logs.length === 0 && <tr><td colSpan={5} className="muted">No verification attempts recorded.</td></tr>}
            {logs.map((g) => (
              <tr key={g.id}>
                <td>{fmt(g.created_at)}</td>
                <td>{g.success ? <span className="badge active">success</span> : <span className="badge banned">failed</span>}</td>
                <td><code className="key" style={{ fontSize: '0.72rem' }}>{g.machine_id || '—'}</code></td>
                <td>{g.ip_address || '—'}</td>
                <td className="muted" style={{ whiteSpace: 'normal' }}>{g.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="muted" style={{ fontSize: '0.78rem' }}>{label}</div>
      <div style={{ marginTop: 2 }}>{value}</div>
    </div>
  );
}
