import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { claimsApi } from '../../api';

const STATUS_MAP = {
  DRAFT: { label: 'Draft', cls: 'badge-draft' },
  SRIC_PENDING: { label: 'SRIC Pending', cls: 'badge-pending' },
  SRIC_VERIFIED: { label: 'SRIC Recommended & Forwarded to Dean', cls: 'badge-approved' },
  SRIC_REJECTED: { label: 'SRIC Rejected', cls: 'badge-rejected' },
  DEAN_PENDING: { label: 'Dean Pending', cls: 'badge-pending' },
  DEAN_REJECTED: { label: 'Dean Rejected', cls: 'badge-rejected' },
  DEAN_FORWARDED: { label: 'Dean Approved', cls: 'badge-approved' },
  ACCOUNTS_PENDING: { label: 'Accounts', cls: 'badge-accounts' },
  PROCESSED: { label: 'Processed', cls: 'badge-processed' },
};

export default function MyClaims() {
  const [claims, setClaims] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    claimsApi.getMy().then(r => setClaims(r.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filteredClaims = claims.filter(c => {
    const claimNo = (c.claim_no || '').toLowerCase();
    const projectNo = (c.project_no || '').toLowerCase();
    const statusLabel = (STATUS_MAP[c.status]?.label || '').toLowerCase();
    const searchTerm = search.toLowerCase();
    return claimNo.includes(searchTerm) || projectNo.includes(searchTerm) || statusLabel.includes(searchTerm);
  });

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1 className="page-title" style={{ margin: 0 }}>My claims</h1>
          <div style={{ position: 'relative', width: 260 }}>
            <i className="ti ti-search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
            <input
              type="text"
              placeholder="Search claim no, project..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 34, background: '#fff', border: '1px solid #d4d4d0', borderRadius: 6, height: 36, fontSize: 13 }}
            />
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/faculty/claims/new')}>
          <i className="ti ti-plus" style={{ marginRight: 6 }} />New claim
        </button>
      </div>
      <div className="card">
        {loading
          ? <div style={{ padding: 32, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
          : filteredClaims.length === 0
            ? <div className="empty-state"><i className="ti ti-file-off" />No claims found.</div>
            : <table className="table">
              <thead><tr><th>Claim no.</th><th>Project</th><th>Amount</th><th>Status</th><th>Submitted</th><th style={{ textAlign: 'center' }}>Print / PDF</th></tr></thead>
              <tbody>
                {filteredClaims.map(c => {
                  const s = STATUS_MAP[c.status] || { label: c.status, cls: 'badge-draft' };
                  return (
                    <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/faculty/claims/${c.id}`)}>
                      <td style={{ color: '#534AB7', fontWeight: 500 }}>{c.claim_no || 'Draft'}</td>
                      <td style={{ fontSize: 12, color: '#888' }}>{c.project_no || '—'}</td>
                      <td style={{ fontWeight: 500 }}>₹{parseFloat(c.total_amount).toLocaleString('en-IN')}</td>
                      <td><span className={`badge ${s.cls}`}>{s.label}</span></td>
                      <td style={{ fontSize: 12, color: '#888' }}>{c.submitted_at ? new Date(c.submitted_at).toLocaleDateString('en-IN') : '—'}</td>
                      <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        {c.status !== 'DRAFT' && (
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '4px 8px', color: '#534AB7', background: 'transparent', border: 'none' }}
                            onClick={() => window.open(`/claims/${c.id}/print?role=faculty`, '_blank')}
                            title="Print / Download Reimbursement Form"
                          >
                            <i className="ti ti-printer" style={{ fontSize: '15px' }} />
                          </button>
                        )}
                      </td>
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