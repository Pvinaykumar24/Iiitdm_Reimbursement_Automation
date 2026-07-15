import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { claimsApi } from '../../api';

const groupItemsByInvoice = (items = []) => {
  const groups = {};
  items.forEach(it => {
    const key = it.bill_no || 'unknown';
    if (!groups[key]) {
      groups[key] = {
        vendor_name: it.vendor_name,
        bill_no: it.bill_no,
        bill_date: it.bill_date,
        gstin_vendor: it.gstin_vendor,
        cgst_percent: parseFloat(it.cgst_percent || 0),
        sgst_percent: parseFloat(it.sgst_percent || 0),
        igst_percent: parseFloat(it.igst_percent || 0),
        other_charges: parseFloat(it.other_charges || 0),
        products: []
      };
    } else {
      groups[key].other_charges += parseFloat(it.other_charges || 0);
    }

    const base = parseFloat(it.unit_price || 0) * parseInt(it.quantity || 1);
    const cgst = base * parseFloat(it.cgst_percent || 0) / 100;
    const sgst = base * parseFloat(it.sgst_percent || 0) / 100;
    const igst = base * parseFloat(it.igst_percent || 0) / 100;
    const prodTotal = base + cgst + sgst + igst;

    groups[key].products.push({
      id: it.id,
      description: it.description,
      quantity: it.quantity,
      quantity_unit: it.quantity_unit || 'pcs',
      unit_price: parseFloat(it.unit_price || 0),
      budget_head: it.budget_head,
      total_amount: prodTotal
    });
  });
  return Object.values(groups);
};

export default function ClaimDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [claim, setClaim] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    claimsApi.getById(id).then(r => setClaim(r.data)).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  const handleDeleteDraft = () => {
    if (!window.confirm('Are you sure you want to delete this draft claim? This action cannot be undone.')) return;
    setDeleting(true);
    claimsApi.deleteDraft(id)
      .then(() => {
        navigate('/faculty/claims');
      })
      .catch(err => {
        console.error(err);
        alert(err.response?.data?.message || 'Failed to delete draft claim');
      })
      .finally(() => setDeleting(false));
  };

  if (loading) return <div style={{ padding: 32, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>;
  if (!claim) return <div className="alert alert-error">Claim not found.</div>;

  const STATUS_COLORS = {
    DRAFT: '#444441',
    SRIC_PENDING: '#633806',
    SRIC_VERIFIED: '#27500A',
    SRIC_REJECTED: '#791F1F',
    DEAN_PENDING: '#633806',
    DEAN_REJECTED: '#791F1F',
    DEAN_FORWARDED: '#27500A',
    ACCOUNTS_PENDING: '#0C447C',
    PROCESSED: '#085041'
  };
  const invoices = groupItemsByInvoice(claim.items || []);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}><i className="ti ti-arrow-left" /></button>
        <h1 className="page-title" style={{ margin: 0 }}>{claim.claim_no || 'Draft Claim'}</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {claim.status !== 'DRAFT' && (
            <button className="btn btn-ghost btn-sm" onClick={() => window.open(`/claims/${claim.id}/print?role=faculty`, '_blank')} style={{ background: '#fff', border: '1px solid #d4d4d0', padding: '6px 12px' }}>
              <i className="ti ti-printer" style={{ marginRight: 6 }} />Print / Download
            </button>
          )}
          {claim.status === 'DRAFT' && (
            <button className="btn btn-danger btn-sm" onClick={handleDeleteDraft} disabled={deleting}>
              <i className="ti ti-trash" style={{ marginRight: 6 }} />{deleting ? 'Deleting...' : 'Delete Draft'}
            </button>
          )}
          {['DRAFT', 'SRIC_REJECTED', 'DEAN_REJECTED'].includes(claim.status) && (
            <button className="btn btn-primary btn-sm" onClick={() => navigate(`/faculty/claims/new?draftId=${claim.id}`)}>
              <i className="ti ti-edit" style={{ marginRight: 6 }} />Edit & Resubmit
            </button>
          )}
        </div>
      </div>

      {/* Visual Progress Timeline */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">Workflow Tracking</div>
        <div className="card-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', padding: '10px 0' }}>
            <div style={{ position: 'absolute', left: '16.6%', right: '16.6%', height: 2, background: '#e5e5e3', zIndex: 0 }} />

            {/* Step 1: Created */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, position: 'relative', width: '33.3%' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#EAF3DE', color: '#27500A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 'bold' }}>✓</div>
              <div style={{ fontSize: 11, fontWeight: 500, marginTop: 4 }}>Submitted</div>
            </div>

            {/* Step 2: SRIC Cell */}
            {(() => {
              const hasSric = ['SRIC_VERIFIED', 'DEAN_PENDING', 'DEAN_FORWARDED', 'PROCESSED'].includes(claim.status);
              const isRejected = claim.status === 'SRIC_REJECTED';
              const bg = isRejected ? '#FCEBEB' : hasSric ? '#EAF3DE' : '#EEEDFE';
              const col = isRejected ? '#791F1F' : hasSric ? '#27500A' : '#3C3489';
              const char = isRejected ? '✗' : hasSric ? '✓' : '•';
              return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, position: 'relative', width: '33.3%' }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: bg, color: col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 'bold' }}>{char}</div>
                  <div style={{ fontSize: 11, fontWeight: 500, marginTop: 4 }}>SRIC Cell</div>
                </div>
              );
            })()}

            {/* Step 3: Dean SR */}
            {(() => {
              const hasDean = ['DEAN_FORWARDED', 'PROCESSED'].includes(claim.status);
              const isRejected = claim.status === 'DEAN_REJECTED';
              const awaiting = ['DEAN_PENDING'].includes(claim.status);
              const bg = isRejected ? '#FCEBEB' : hasDean ? '#EAF3DE' : awaiting ? '#EEEDFE' : '#f5f5f4';
              const col = isRejected ? '#791F1F' : hasDean ? '#27500A' : awaiting ? '#3C3489' : '#888';
              const char = isRejected ? '✗' : hasDean ? '✓' : awaiting ? '•' : '3';
              return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, position: 'relative', width: '33.3%' }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: bg, color: col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 'bold' }}>{char}</div>
                  <div style={{ fontSize: 11, fontWeight: 500, marginTop: 4 }}>Dean SR</div>
                </div>
              );
            })()}

          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Claim details {claim.version > 1 && `(Version ${claim.version})`}</span>
          <span style={{ fontSize: 12, color: STATUS_COLORS[claim.status] || '#888', fontWeight: 600 }}>{claim.status.replace('_', ' ')}</span>
        </div>
        <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: '#888' }}>Project</div>
            <div style={{ fontWeight: 500, marginTop: 2 }}>{claim.project_no || '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#888' }}>Version</div>
            <div style={{ fontWeight: 500, marginTop: 2 }}>v{claim.version || 1}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#888' }}>Purpose</div>
            <div style={{ fontWeight: 500, marginTop: 2 }}>{claim.purpose}</div>
          </div>
        </div>
      </div>

      <div style={{ fontSize: 15, fontWeight: 600, color: '#444', marginBottom: 12 }}>Bill Invoices ({invoices.length})</div>

      {invoices.map((inv, idx) => {
        const invBase = inv.products.reduce((sum, p) => sum + (parseFloat(p.unit_price || 0) * parseInt(p.quantity || 1)), 0);
        const invGst = inv.products.reduce((sum, p) => {
          const base = parseFloat(p.unit_price || 0) * parseInt(p.quantity || 1);
          const tax = base * (parseFloat(inv.cgst_percent || 0) + parseFloat(inv.sgst_percent || 0) + parseFloat(inv.igst_percent || 0)) / 100;
          return sum + tax;
        }, 0);
        const invTotal = invBase + invGst + parseFloat(inv.other_charges || 0);

        return (
          <div className="card" key={idx} style={{ marginBottom: 16 }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600 }}>Invoice #{idx + 1} — {inv.vendor_name}</span>
              <span style={{ fontSize: 11, color: '#888' }}>Bill No: {inv.bill_no} · Date: {new Date(inv.bill_date).toLocaleDateString('en-IN')}</span>
            </div>
            <div className="card-body">
              {inv.gstin_vendor && <div style={{ fontSize: 11, color: '#666', marginBottom: 10 }}>Vendor GSTIN: <strong style={{ color: '#333' }}>{inv.gstin_vendor}</strong></div>}

              <table className="table" style={{ marginBottom: 16 }}>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Description</th>
                    <th style={{ width: 100, textAlign: 'right' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Unit Price</th>
                    <th style={{ textAlign: 'right' }}>Total (incl. GST)</th>
                  </tr>
                </thead>
                <tbody>
                  {inv.products.map((p, pIdx) => (
                    <tr key={pIdx}>
                      <td>{pIdx + 1}</td>
                      <td>{p.description}</td>
                      <td style={{ textAlign: 'right' }}>{p.quantity} {p.quantity_unit}</td>
                      <td style={{ textAlign: 'right' }}>₹{parseFloat(p.unit_price || 0).toFixed(2)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 500 }}>₹{p.total_amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, fontSize: 12, color: '#1a1a1a', fontWeight: '600' }}>
                <div>Base Amount: ₹{invBase.toFixed(2)}</div>
                {(parseFloat(inv.cgst_percent) > 0 || parseFloat(inv.sgst_percent) > 0 || parseFloat(inv.igst_percent) > 0) && (
                  <div>
                    GST ({[
                      parseFloat(inv.cgst_percent) > 0 && `CGST ${inv.cgst_percent}%`,
                      parseFloat(inv.sgst_percent) > 0 && `SGST ${inv.sgst_percent}%`,
                      parseFloat(inv.igst_percent) > 0 && `IGST ${inv.igst_percent}%`
                    ].filter(Boolean).join(', ')}): ₹{invGst.toFixed(2)}
                  </div>
                )}
                {parseFloat(inv.other_charges) > 0 && <div>Other Charges: ₹{parseFloat(inv.other_charges).toFixed(2)}</div>}
                <div style={{ fontSize: 14, color: '#534AB7', fontWeight: 700, marginTop: 4 }}>
                  Invoice Total: ₹{invTotal.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <div className="card" style={{ marginBottom: 16, background: '#EEEDFE', borderColor: '#d0cbf7' }}>
        <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px' }}>
          <div style={{ fontSize: 14, color: '#26215C', fontWeight: 500 }}>Claim Grand Total</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#3c3489' }}>₹{parseFloat(claim.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        </div>
      </div>

      {claim.audit_logs?.length > 0 && (
        <div className="card">
          <div className="card-header">Audit trail</div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {claim.audit_logs.map(log => (
              <div key={log.id} style={{ display: 'flex', gap: 12, fontSize: 13 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#534AB7', marginTop: 4, flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 500 }}>
                    {log.action.replace(/_/g, ' ')} {log.metadata?.version ? `(v${log.metadata.version})` : ''}
                  </div>
                  {log.metadata?.remarks && <div style={{ color: '#A32D2D', marginTop: 2 }}>Remarks: {log.metadata.remarks}</div>}
                  <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>{log.actor_name || 'System'} · {new Date(log.created_at).toLocaleString('en-IN')}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}