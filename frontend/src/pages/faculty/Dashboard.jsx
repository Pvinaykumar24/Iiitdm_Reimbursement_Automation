import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { claimsApi } from '../../api';

const statusBadge = (status) => {
  const map = {
    DRAFT: 'badge-draft',
    SRIC_PENDING: 'badge-pending',
    SRIC_VERIFIED: 'badge-approved',
    SRIC_REJECTED: 'badge-rejected',
    DEAN_PENDING: 'badge-pending',
    DEAN_REJECTED: 'badge-rejected',
    DEAN_FORWARDED: 'badge-approved',
    ACCOUNTS_PENDING: 'badge-accounts',
    PROCESSED: 'badge-processed'
  };
  const label = {
    DRAFT: 'Draft',
    SRIC_PENDING: 'SRIC Pending',
    SRIC_VERIFIED: 'SRIC Verified',
    SRIC_REJECTED: 'SRIC Rejected',
    DEAN_PENDING: 'Dean Pending',
    DEAN_REJECTED: 'Dean Rejected',
    DEAN_FORWARDED: 'Dean Approved',
    ACCOUNTS_PENDING: 'Accounts',
    PROCESSED: 'Processed'
  };
  return <span className={`badge ${map[status]||'badge-draft'}`}>{label[status]||status}</span>;
};

export default function FacultyDashboard() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    claimsApi.getMy().then(r => setClaims(r.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  const total     = claims.length;
  const pending   = claims.filter(c => ['SRIC_PENDING','DEAN_PENDING','ACCOUNTS_PENDING'].includes(c.status)).length;
  const approved  = claims.filter(c => ['SRIC_VERIFIED','DEAN_FORWARDED','PROCESSED'].includes(c.status)).length;
  const reimbursed = claims.filter(c => c.status === 'PROCESSED').reduce((s,c) => s + parseFloat(c.total_amount||0), 0);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Dashboard</h1>
        <button className="btn btn-primary" onClick={() => navigate('/faculty/claims/new')}>
          <i className="ti ti-plus" style={{ marginRight: 6 }} />New claim
        </button>
      </div>

      <div className="stat-grid">
        <div className="stat-card"><div className="stat-label">Total claims</div><div className="stat-value">{total}</div></div>
        <div className="stat-card"><div className="stat-label">Pending</div><div className="stat-value" style={{ color: '#633806' }}>{pending}</div></div>
        <div className="stat-card"><div className="stat-label">Approved</div><div className="stat-value" style={{ color: '#27500A' }}>{approved}</div></div>
        <div className="stat-card"><div className="stat-label">Total reimbursed</div><div className="stat-value" style={{ color: '#0C447C' }}>₹{reimbursed.toLocaleString('en-IN')}</div></div>
      </div>

      <div className="card">
        <div className="card-header">Recent claims</div>
        {loading ? <div style={{ padding: 24, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        : claims.length === 0
          ? <div className="empty-state"><i className="ti ti-file-off" />No claims yet. <span style={{ color: '#534AB7', cursor: 'pointer' }} onClick={() => navigate('/faculty/claims/new')}>Create your first claim →</span></div>
          : <table className="table">
              <thead><tr><th>Claim no.</th><th>Purpose</th><th>Project</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>
                {claims.slice(0,10).map(c => (
                  <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/faculty/claims/${c.id}`)}>
                    <td style={{ color: '#534AB7', fontWeight: 500 }}>{c.claim_no}</td>
                    <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.purpose}</td>
                    <td style={{ color: '#888', fontSize: 12 }}>{c.project_title}</td>
                    <td style={{ fontWeight: 500 }}>₹{parseFloat(c.total_amount).toLocaleString('en-IN')}</td>
                    <td>{statusBadge(c.status)}</td>
                    <td style={{ color: '#888', fontSize: 12 }}>{new Date(c.created_at).toLocaleDateString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
        }
      </div>
    </>
  );
}