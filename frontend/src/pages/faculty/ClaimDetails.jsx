import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { claimsApi } from '../../api';

export default function ClaimDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [claim, setClaim] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    claimsApi.getById(id).then(r => setClaim(r.data)).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={{ padding: 32, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>;
  if (!claim) return <div className="alert alert-error">Claim not found.</div>;

  const STATUS_COLORS = { DEAN_PENDING: '#633806', DEAN_REJECTED: '#791F1F', ACCOUNTS_PENDING: '#0C447C', PROCESSED: '#085041' };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}><i className="ti ti-arrow-left" /></button>
        <h1 className="page-title" style={{ margin: 0 }}>{claim.claim_no}</h1>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Claim details</span>
          <span style={{ fontSize: 12, color: STATUS_COLORS[claim.status] || '#888', fontWeight: 500 }}>{claim.status.replace('_',' ')}</span>
        </div>
        <div className="card-body">
          <div className="form-row form-row-3" style={{ marginBottom: 12 }}>
            <div><div style={{ fontSize: 11, color: '#888' }}>Project</div><div style={{ fontWeight: 500, marginTop: 2 }}>{claim.project_no} — {claim.project_title}</div></div>
            <div><div style={{ fontSize: 11, color: '#888' }}>Funding agency</div><div style={{ fontWeight: 500, marginTop: 2 }}>{claim.funding_agency}</div></div>
            <div><div style={{ fontSize: 11, color: '#888' }}>Budget head</div><div style={{ fontWeight: 500, marginTop: 2 }}>{claim.budget_head}</div></div>
          </div>
          <div><div style={{ fontSize: 11, color: '#888' }}>Purpose</div><div style={{ marginTop: 2 }}>{claim.purpose}</div></div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">Bill items ({claim.items?.length || 0})</div>
        <table className="table">
          <thead><tr><th>#</th><th>Vendor</th><th>Bill no.</th><th>Date</th><th>Description</th><th style={{textAlign:'right'}}>Amount</th></tr></thead>
          <tbody>
            {claim.items?.map((it, i) => (
              <tr key={it.id}>
                <td>{i+1}</td><td>{it.vendor_name}</td><td>{it.bill_no}</td>
                <td>{new Date(it.bill_date).toLocaleDateString('en-IN')}</td>
                <td>{it.description}</td>
                <td style={{ textAlign: 'right', fontWeight: 500 }}>₹{parseFloat(it.total_amount).toLocaleString('en-IN')}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={5} style={{ textAlign: 'right', fontWeight: 500 }}>Total</td>
              <td style={{ textAlign: 'right', fontWeight: 600, color: '#534AB7' }}>₹{parseFloat(claim.total_amount).toLocaleString('en-IN')}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {claim.approvals?.length > 0 && (
        <div className="card">
          <div className="card-header">Approval history</div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {claim.approvals.map(a => (
              <div key={a.id} style={{ display: 'flex', gap: 12, fontSize: 13 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: a.action === 'APPROVED' ? '#3B6D11' : '#A32D2D', marginTop: 4, flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 500 }}>{a.stage.replace('_',' ')} — {a.action} by {a.actor_name}</div>
                  {a.remarks && <div style={{ color: '#A32D2D', marginTop: 2 }}>Reason: {a.remarks}</div>}
                  <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>{new Date(a.acted_at).toLocaleString('en-IN')}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}