import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { claimsApi } from '../../api';

const STATUS_MAP = {
  DRAFT:            { label: 'Draft',            cls: 'badge-draft' },
  SRIC_PENDING:     { label: 'SRIC Pending',     cls: 'badge-pending' },
  SRIC_VERIFIED:    { label: 'SRIC Verified',    cls: 'badge-approved' },
  SRIC_REJECTED:    { label: 'SRIC Rejected',    cls: 'badge-rejected' },
  DEAN_PENDING:     { label: 'Dean Pending',     cls: 'badge-pending' },
  DEAN_REJECTED:    { label: 'Dean Rejected',    cls: 'badge-rejected' },
  DEAN_FORWARDED:   { label: 'Dean Approved',    cls: 'badge-approved' },
  ACCOUNTS_PENDING: { label: 'Accounts',         cls: 'badge-accounts' },
  PROCESSED:        { label: 'Processed',        cls: 'badge-processed' },
};

export default function MyClaims() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    claimsApi.getMy().then(r => setClaims(r.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: 0 }}>My claims</h1>
        <button className="btn btn-primary" onClick={() => navigate('/faculty/claims/new')}>
          <i className="ti ti-plus" style={{ marginRight: 6 }} />New claim
        </button>
      </div>
      <div className="card">
        {loading
          ? <div style={{ padding: 32, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
          : claims.length === 0
            ? <div className="empty-state"><i className="ti ti-file-off" />No claims found.</div>
            : <table className="table">
                <thead><tr><th>Claim no.</th><th>Purpose</th><th>Project</th><th>Items</th><th>Amount</th><th>Status</th><th>Submitted</th></tr></thead>
                <tbody>
                  {claims.map(c => {
                    const s = STATUS_MAP[c.status] || { label: c.status, cls: 'badge-draft' };
                    return (
                      <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/faculty/claims/${c.id}`)}>
                        <td style={{ color: '#534AB7', fontWeight: 500 }}>{c.claim_no}</td>
                        <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.purpose}</td>
                        <td style={{ fontSize: 12, color: '#888' }}>{c.project_no || '—'}</td>
                        <td style={{ textAlign: 'center' }}>{c.item_count}</td>
                        <td style={{ fontWeight: 500 }}>₹{parseFloat(c.total_amount).toLocaleString('en-IN')}</td>
                        <td><span className={`badge ${s.cls}`}>{s.label}</span></td>
                        <td style={{ fontSize: 12, color: '#888' }}>{c.submitted_at ? new Date(c.submitted_at).toLocaleDateString('en-IN') : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
        }
      </div>
    </>
  );
}