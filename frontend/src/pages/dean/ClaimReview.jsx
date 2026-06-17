import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { claimsApi, approvalsApi } from '../../api';

export default function ClaimReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [claim, setClaim] = useState(null);
  const [loading, setLoading] = useState(true);
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    claimsApi.getById(id).then(r => setClaim(r.data)).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  const decide = async (action) => {
    if (action === 'REJECTED' && !remarks.trim()) {
      setError('Please provide a reason for rejection.');
      return;
    }
    setError(''); setSubmitting(true);
    try {
      await approvalsApi.deanDecide(id, action, remarks);
      navigate('/dean/pending');
    } catch (err) {
      setError(err.response?.data?.message || 'Action failed');
    } finally { setSubmitting(false); }
  };

  if (loading) return <div style={{ padding: 32, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>;
  if (!claim) return <div className="alert alert-error">Claim not found.</div>;

  const isPending = claim.status === 'DEAN_PENDING';

  // Dynamic badge based on actual claim status
  const STATUS_BADGE = {
    DEAN_PENDING:     { cls: 'badge-pending',  label: 'Pending Dean review' },
    DEAN_APPROVED:    { cls: 'badge-approved', label: 'Approved by Dean' },
    ACCOUNTS_PENDING: { cls: 'badge-approved', label: 'Forwarded to Accounts' },
    DEAN_REJECTED:    { cls: 'badge-rejected', label: 'Rejected by Dean' },
    PROCESSED:        { cls: 'badge-processed', label: 'Processed' },
  };
  const badge = STATUS_BADGE[claim.status] || { cls: 'badge-draft', label: claim.status };

  // Find the dean approval record for read-only display
  const deanApproval = claim.approvals?.find(a => a.stage === 'DEAN_REVIEW');

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}><i className="ti ti-arrow-left" /></button>
        <h1 className="page-title" style={{ margin: 0 }}>Review — {claim.claim_no}</h1>
        <span className={`badge ${badge.cls}`} style={{ marginLeft: 4 }}>{badge.label}</span>
      </div>

      {error && <div className="alert alert-error"><i className="ti ti-alert-circle" />{error}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">Claim details</div>
        <div className="card-body">
          <div className="form-row form-row-3" style={{ marginBottom: 12 }}>
            <div><div style={{ fontSize: 11, color: '#888' }}>Faculty (PI)</div><div style={{ fontWeight: 500, marginTop: 2 }}>{claim.faculty_name}</div><div style={{ fontSize: 12, color: '#888' }}>{claim.department}</div></div>
            <div><div style={{ fontSize: 11, color: '#888' }}>Project</div><div style={{ fontWeight: 500, marginTop: 2 }}>{claim.project_no}</div><div style={{ fontSize: 12, color: '#888' }}>{claim.funding_agency}</div></div>
            <div><div style={{ fontSize: 11, color: '#888' }}>Budget head</div><div style={{ fontWeight: 500, marginTop: 2 }}>{claim.budget_head}</div></div>
          </div>
          <div style={{ marginBottom: 8 }}><div style={{ fontSize: 11, color: '#888' }}>Purpose</div><div style={{ marginTop: 2 }}>{claim.purpose}</div></div>
          <div><div style={{ fontSize: 11, color: '#888' }}>Submitted</div><div style={{ marginTop: 2 }}>{claim.submitted_at ? new Date(claim.submitted_at).toLocaleString('en-IN') : '—'}</div></div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">Bill items ({claim.items?.length || 0})</div>
        <table className="table">
          <thead><tr><th>#</th><th>Vendor</th><th>Bill no.</th><th>Date</th><th>Description</th><th>CGST</th><th>SGST</th><th>IGST</th><th style={{textAlign:'right'}}>Total</th></tr></thead>
          <tbody>
            {claim.items?.map((it, i) => (
              <tr key={it.id}>
                <td>{i+1}</td>
                <td>
                  {it.vendor_name}
                  {it.gstin_vendor ? (
                    <><br/><span style={{ fontSize: 11, color: '#888' }}>GSTIN: {it.gstin_vendor}</span></>
                  ) : null}
                </td>
                <td>{it.bill_no}</td>
                <td style={{ fontSize: 12 }}>{new Date(it.bill_date).toLocaleDateString('en-IN')}</td>
                <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.description}</td>
                <td style={{ fontSize: 12 }}>{it.cgst_percent}%</td>
                <td style={{ fontSize: 12 }}>{it.sgst_percent}%</td>
                <td style={{ fontSize: 12 }}>{it.igst_percent}%</td>
                <td style={{ textAlign: 'right', fontWeight: 500 }}>₹{parseFloat(it.total_amount).toLocaleString('en-IN')}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={8} style={{ textAlign: 'right', fontWeight: 500 }}>Claim total</td>
              <td style={{ textAlign: 'right', fontWeight: 600, color: '#534AB7', fontSize: 15 }}>₹{parseFloat(claim.total_amount).toLocaleString('en-IN')}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">Audit trail</div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {claim.audit_logs?.map(log => (
            <div key={log.id} style={{ display: 'flex', gap: 10, fontSize: 13 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#534AB7', marginTop: 5, flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 500 }}>{log.action.replace(/_/g,' ')}</div>
                <div style={{ color: '#888', fontSize: 12 }}>{log.actor_name} · {new Date(log.created_at).toLocaleString('en-IN')}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Dean decision: action form OR read-only summary ───────────────────── */}
      {isPending ? (
        <div className="card">
          <div className="card-header">Dean decision</div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Remarks <span style={{ color: '#A32D2D' }}>(required if rejecting)</span></label>
              <textarea rows={3} value={remarks} onChange={e => setRemarks(e.target.value)}
                placeholder="Add remarks for the faculty..." />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-danger" onClick={() => decide('REJECTED')} disabled={submitting}>
                <i className="ti ti-x" style={{ marginRight: 6 }} />{submitting ? 'Processing...' : 'Reject'}
              </button>
              <button className="btn btn-success" onClick={() => decide('APPROVED')} disabled={submitting}>
                <i className="ti ti-check" style={{ marginRight: 6 }} />{submitting ? 'Processing...' : 'Approve & forward to Accounts'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">Dean decision</div>
          <div className="card-body">
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13 }}>
              <div>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Decision</div>
                <span className={`badge ${claim.status === 'DEAN_REJECTED' ? 'badge-rejected' : 'badge-approved'}`}>
                  <i className={`ti ${claim.status === 'DEAN_REJECTED' ? 'ti-circle-x' : 'ti-circle-check'}`} style={{ marginRight: 4, fontSize: 11 }} />
                  {claim.status === 'DEAN_REJECTED' ? 'Rejected' : 'Approved'}
                </span>
              </div>
              {deanApproval && (
                <>
                  <div>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Decided by</div>
                    <div style={{ fontWeight: 500 }}>{deanApproval.actor_name}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Date</div>
                    <div>{new Date(deanApproval.acted_at).toLocaleString('en-IN')}</div>
                  </div>
                </>
              )}
            </div>
            {deanApproval?.remarks && (
              <div style={{ marginTop: 14, padding: '10px 14px', background: '#fafaf9', borderRadius: 7, border: '1px solid #e5e5e3', fontSize: 13 }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Remarks</div>
                {deanApproval.remarks}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}