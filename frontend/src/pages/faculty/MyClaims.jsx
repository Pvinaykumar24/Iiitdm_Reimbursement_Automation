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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <h1 className="page-title" style={{ margin: 0 }}>My Claims Log</h1>
          <div style={{ position: 'relative', width: 280 }}>
            <i className="ti ti-search" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#706C61', fontSize: 16 }} />
            <input
              type="text"
              placeholder="Search claim no, project..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 40, height: 42, fontSize: 14 }}
            />
          </div>
        </div>
        <button className="btn btn-primary" style={{ height: 42, padding: '0 24px' }} onClick={() => navigate('/faculty/claims/new')}>
          <i className="ti ti-plus" style={{ marginRight: 8, fontSize: 15 }} />New Claim
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto' }} />
          </div>
        ) : filteredClaims.length === 0 ? (
          <div className="empty-state">
            <i className="ti ti-file-off" style={{ color: '#706C61', fontSize: 48, marginBottom: 12 }} />
            <p style={{ fontWeight: 600, fontSize: 15 }}>No claims found matching search criteria.</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th style={{ padding: '16px 24px' }}>Claim Number</th>
                <th>Project Number</th>
                <th>Total Amount</th>
                <th>Status</th>
                <th>Submitted Date</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClaims.map(c => {
                const s = STATUS_MAP[c.status] || { label: c.status, cls: 'badge-draft' };
                return (
                  <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/faculty/claims/${c.id}`)}>
                    <td style={{ color: '#744FC6', fontWeight: 700, padding: '18px 24px', fontSize: 15 }}>{c.claim_no || 'Draft (Unsubmitted)'}</td>
                    <td style={{ fontWeight: 600, color: '#4C4C9D' }}>{c.project_no || '—'}</td>
                    <td style={{ fontWeight: 700, color: '#1e1c31', fontSize: 16 }}>₹{parseFloat(c.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td><span className={`badge ${s.cls}`}>{s.label}</span></td>
                    <td style={{ fontWeight: 500, color: '#57544e' }}>{c.submitted_at ? new Date(c.submitted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}</td>
                    <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                        {c.status !== 'DRAFT' && (
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}
                            onClick={() => window.open(`/claims/${c.id}/print?role=faculty`, '_blank')}
                            title="Print Reimbursement Form"
                          >
                            <i className="ti ti-printer" style={{ fontSize: 15 }} /> Print PDF
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}