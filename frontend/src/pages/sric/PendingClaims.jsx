import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { claimsApi } from '../../api';

export default function SricPendingClaims() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    claimsApi.getPendingSric().then(r => setClaims(r.data)).finally(() => setLoading(false));
  }, []);

  return (
    <>
      <h1 className="page-title">Pending Claims Verification</h1>
      <div className="card">
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto' }} />
          </div>
        ) : claims.length === 0 ? (
          <div className="empty-state">
            <i className="ti ti-circle-check" style={{ fontSize: 48, color: '#16a34a', marginBottom: 12 }} />
            <p style={{ fontWeight: 600, fontSize: 15 }}>No claims pending verification. All caught up!</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th style={{ padding: '16px 24px' }}>Claim no.</th>
                <th>Faculty (PI)</th>
                <th>Department</th>
                <th>Project</th>
                <th>Amount</th>
                <th>Submitted Date</th>
                <th style={{ textAlign: 'right', paddingRight: 24 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {claims.map(c => (
                <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/sric/claims/${c.id}`)}>
                  <td style={{ color: 'var(--primary-purple)', fontWeight: 700, padding: '18px 24px', fontSize: 15 }}>{c.claim_no}</td>
                  <td style={{ fontWeight: 600 }}>{c.faculty_name}</td>
                  <td style={{ fontWeight: 500, color: 'var(--text-muted)' }}>{c.department}</td>
                  <td style={{ fontWeight: 600, color: 'var(--secondary-indigo)' }}>{c.project_no || '—'}</td>
                  <td style={{ fontWeight: 700, color: 'var(--text-dark)' }}>₹{parseFloat(c.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td style={{ fontWeight: 500, color: 'var(--text-muted)' }}>{new Date(c.submitted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</td>
                  <td onClick={e => e.stopPropagation()} style={{ textAlign: 'right', paddingRight: 24 }}>
                    <button className="btn btn-primary btn-sm" style={{ height: 32, padding: '0 16px' }} onClick={() => navigate(`/sric/claims/${c.id}`)}>
                      Review & Verify
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
