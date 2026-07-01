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

  useEffect(() => {
    claimsApi.getById(id).then(r => setClaim(r.data)).catch(console.error).finally(() => setLoading(false));
  }, [id]);

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
        <h1 className="page-title" style={{ margin: 0 }}>{claim.claim_no}</h1>
        {['DRAFT', 'SRIC_REJECTED', 'DEAN_REJECTED'].includes(claim.status) && (
          <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => navigate(`/faculty/claims/new?draftId=${claim.id}`)}>
            <i className="ti ti-edit" style={{ marginRight: 6 }} />Edit & Resubmit
          </button>
        )}
      </div>

      {/* Visual Progress Timeline */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">Workflow Tracking</div>
        <div className="card-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', padding: '10px 0' }}>
            <div style={{ position: 'absolute', left: '10%', right: '10%', height: 2, background: '#e5e5e3', zIndex: 0 }} />
            
            {/* Step 1: Created */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, position: 'relative', width: '25%' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#EAF3DE', color: '#27500A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 'bold' }}>✓</div>
              <div style={{ fontSize: 11, fontWeight: 500, marginTop: 4 }}>Created</div>
            </div>

            {/* Step 2: SRIC Cell */}
            {(() => {
              const hasSric = ['SRIC_VERIFIED', 'DEAN_PENDING', 'DEAN_FORWARDED', 'PROCESSED'].includes(claim.status);
              const isRejected = claim.status === 'SRIC_REJECTED';
              const bg = isRejected ? '#FCEBEB' : hasSric ? '#EAF3DE' : '#EEEDFE';
              const col = isRejected ? '#791F1F' : hasSric ? '#27500A' : '#3C3489';
              const char = isRejected ? '✗' : hasSric ? '✓' : '•';
              return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, position: 'relative', width: '25%' }}>
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
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, position: 'relative', width: '25%' }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: bg, color: col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 'bold' }}>{char}</div>
                  <div style={{ fontSize: 11, fontWeight: 500, marginTop: 4 }}>Dean SR</div>
                </div>
              );
            })()}

            {/* Step 4: Disbursed */}
            {(() => {
              const done = claim.status === 'PROCESSED';
              const bg = done ? '#EAF3DE' : '#f5f5f4';
              const col = done ? '#27500A' : '#888';
              return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, position: 'relative', width: '25%' }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: bg, color: col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 'bold' }}>{done ? '✓' : '4'}</div>
                  <div style={{ fontSize: 11, fontWeight: 500, marginTop: 4 }}>Reimbursed</div>
                </div>
              );
            })()}

          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Claim details</span>
          <span style={{ fontSize: 12, color: STATUS_COLORS[claim.status] || '#888', fontWeight: 600 }}>{claim.status.replace('_',' ')}</span>
        </div>
        <div className="card-body">
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#888' }}>Project</div>
            <div style={{ fontWeight: 500, marginTop: 2 }}>{claim.project_no || '—'}</div>
          </div>
          <div><div style={{ fontSize: 11, color: '#888' }}>Purpose</div><div style={{ marginTop: 2 }}>{claim.purpose}</div></div>
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
        const invTotal = inv.products.reduce((sum, p) => sum + p.total_amount, 0) + parseFloat(inv.other_charges || 0);

        return (
          <div key={idx} className="card" style={{ marginBottom: 16 }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Invoice {idx + 1} — No: <strong>{inv.bill_no}</strong></span>
              <span style={{ fontSize: 12, color: '#666' }}>Date: {new Date(inv.bill_date).toLocaleDateString('en-IN')}</span>
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13, marginBottom: 12, borderBottom: '1px solid #f0f0ee', paddingBottom: 10 }}>
                <div><span style={{ color: '#888' }}>Vendor:</span> <strong>{inv.vendor_name}</strong></div>
                <div><span style={{ color: '#888' }}>Vendor GSTIN:</span> {inv.gstin_vendor || '—'}</div>
              </div>

              <table className="table" style={{ marginBottom: 12 }}>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th>Description</th>
                    <th style={{ width: 150 }}>Budget Head</th>
                    <th style={{ width: 100, textAlign: 'right' }}>Qty</th>
                    <th style={{ width: 120, textAlign: 'right' }}>Unit Price</th>
                    <th style={{ width: 120, textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {inv.products.map((p, pIdx) => (
                    <tr key={p.id || pIdx}>
                      <td>{pIdx + 1}</td>
                      <td>{p.description}</td>
                      <td>
                        {p.budget_head ? (
                          <span className="badge badge-approved" style={{ fontSize: 11 }}>{p.budget_head}</span>
                        ) : (
                          <span style={{ color: '#888', fontStyle: 'italic', fontSize: 12 }}>Pending</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>{p.quantity} {p.quantity_unit}</td>
                      <td style={{ textAlign: 'right' }}>₹{parseFloat(p.unit_price || 0).toFixed(2)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 500 }}>₹{p.total_amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, fontSize: 12, color: '#666' }}>
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
                <div style={{ fontSize: 14, color: '#534AB7', fontWeight: 600, marginTop: 4 }}>
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