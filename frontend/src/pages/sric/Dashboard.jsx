import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { claimsApi } from '../../api';

export default function SricDashboard() {
  const [pending, setPending] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    claimsApi.getPendingSric().then(r => setPending(r.data)).catch(console.error);
  }, []);

  return (
    <>
      <h1 className="page-title">SRIC Cell Overview</h1>
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="stat-card"><div className="stat-label">Pending verification</div><div className="stat-value" style={{ color: '#633806' }}>{pending.length}</div></div>
        <div className="stat-card"><div className="stat-label">Total value pending</div><div className="stat-value">₹{pending.reduce((s,c)=>s+parseFloat(c.total_amount||0),0).toLocaleString('en-IN')}</div></div>
        <div className="stat-card"><div className="stat-label">Oldest pending</div><div className="stat-value" style={{ fontSize: 14 }}>{pending.length ? new Date(pending[0].submitted_at).toLocaleDateString('en-IN') : '—'}</div></div>
      </div>
      {pending.length > 0 && (
        <div className="alert alert-warning" style={{ marginBottom: 16 }}>
          <i className="ti ti-clock" />{pending.length} claim{pending.length>1?'s':''} awaiting your verification.
          <span style={{ marginLeft: 8, color: '#534AB7', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate('/sric/pending')}>Verify now →</span>
        </div>
      )}
      <div className="card">
        <div className="card-header">Pending claims (oldest first)</div>
        {pending.length === 0
          ? <div className="empty-state"><i className="ti ti-check" />All caught up. No pending claims.</div>
          : <table className="table">
              <thead><tr><th>Claim no.</th><th>Faculty</th><th>Project</th><th>Purpose</th><th>Amount</th><th>Submitted</th></tr></thead>
              <tbody>
                {pending.map(c => (
                  <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/sric/claims/${c.id}`)}>
                    <td style={{ color: '#534AB7', fontWeight: 500 }}>{c.claim_no}</td>
                    <td>{c.faculty_name}<br/><span style={{ fontSize: 11, color: '#888' }}>{c.department}</span></td>
                    <td style={{ fontSize: 12 }}>{c.project_no || '—'}</td>
                    <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{c.purpose}</td>
                    <td style={{ fontWeight: 500 }}>₹{parseFloat(c.total_amount).toLocaleString('en-IN')}</td>
                    <td style={{ fontSize: 12, color: '#888' }}>{new Date(c.submitted_at).toLocaleDateString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
        }
      </div>
    </>
  );
}
