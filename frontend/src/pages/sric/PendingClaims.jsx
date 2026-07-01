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
      <h1 className="page-title">Pending Verification</h1>
      <div className="card">
        {loading
          ? <div style={{ padding: 32, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
          : claims.length === 0
            ? <div className="empty-state"><i className="ti ti-check" />No pending claims to verify. All done!</div>
            : <table className="table">
                <thead><tr><th>Claim no.</th><th>Faculty</th><th>Dept</th><th>Project</th><th>Amount</th><th>Submitted</th><th></th></tr></thead>
                <tbody>
                  {claims.map(c => (
                    <tr key={c.id}>
                      <td style={{ color: '#534AB7', fontWeight: 500 }}>{c.claim_no}</td>
                      <td>{c.faculty_name}</td>
                      <td style={{ fontSize: 12, color: '#888' }}>{c.department}</td>
                      <td style={{ fontSize: 12 }}>{c.project_no}</td>
                      <td style={{ fontWeight: 500 }}>₹{parseFloat(c.total_amount).toLocaleString('en-IN')}</td>
                      <td style={{ fontSize: 12, color: '#888' }}>{new Date(c.submitted_at).toLocaleDateString('en-IN')}</td>
                      <td><button className="btn btn-primary btn-sm" onClick={() => navigate(`/sric/claims/${c.id}`)}>Review & Verify</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
        }
      </div>
    </>
  );
}
