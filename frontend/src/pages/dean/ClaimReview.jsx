import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { claimsApi, approvalsApi } from '../../api';

export default function DeanClaimReview() {
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

  const STATUS_BADGE = {
    DRAFT: { cls: 'badge-draft', label: 'Draft' },
    SRIC_PENDING: { cls: 'badge-pending', label: 'Pending SRIC verification' },
    SRIC_VERIFIED: { cls: 'badge-approved', label: 'SRIC Recommended & Forwarded to Dean' },
    SRIC_REJECTED: { cls: 'badge-rejected', label: 'Rejected by SRIC' },
    DEAN_PENDING: { cls: 'badge-pending', label: 'Pending Dean review' },
    DEAN_REJECTED: { cls: 'badge-rejected', label: 'Rejected by Dean' },
    DEAN_FORWARDED: { cls: 'badge-approved', label: 'Approved by Dean' },
    ACCOUNTS_PENDING: { cls: 'badge-accounts', label: 'Forwarded to Accounts' },
    PROCESSED: { cls: 'badge-processed', label: 'Processed' },
  };
  const badge = STATUS_BADGE[claim.status] || { cls: 'badge-draft', label: claim.status };
  const sricApproval = claim.approvals?.find(a => a.stage === 'SRIC_REVIEW');
  const deanApproval = claim.approvals?.find(a => a.stage === 'DEAN_REVIEW');

  const budgetHeadSummaries = {};
  if (claim && claim.items) {
    claim.items.forEach(it => {
      const bh = it.budget_head || 'Consumable';
      const useClassified = it.sric_cgst !== null && it.sric_cgst !== undefined;
      const base = parseFloat(it.unit_price || 0) * parseInt(it.quantity || 1);
      const cgst = useClassified ? parseFloat(it.sric_cgst) : parseFloat(it.cgst_amount || 0);
      const sgst = useClassified ? parseFloat(it.sric_sgst) : parseFloat(it.sgst_amount || 0);
      const igst = useClassified ? parseFloat(it.sric_igst) : parseFloat(it.igst_amount || 0);
      const other = useClassified ? parseFloat(it.sric_other_charges) : parseFloat(it.other_charges || 0);
      const itemTotal = base + cgst + sgst + igst + other;
      budgetHeadSummaries[bh] = (budgetHeadSummaries[bh] || 0) + itemTotal;
    });
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ width: 40, height: 40, padding: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className="ti ti-arrow-left" style={{ fontSize: 18 }} /></button>
        <div>
          <h1 className="page-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            Review Claim — {claim.claim_no}
            <span className={`badge ${badge.cls}`} style={{ fontSize: 13, padding: '4px 14px' }}>{badge.label}</span>
          </h1>
        </div>
        
        {claim.status !== 'DRAFT' && claim.status !== 'SRIC_PENDING' && claim.status !== 'SRIC_REJECTED' && (
          <button 
            className="btn btn-ghost" 
            onClick={() => window.open(`/claims/${claim.id}/print?role=dean`, '_blank')} 
            style={{ background: '#fff', height: 44, padding: '0 20px', marginLeft: 'auto' }}
          >
            <i className="ti ti-printer" style={{ marginRight: 8, fontSize: 16 }} />Print / Download
          </button>
        )}
      </div>

      {error && <div className="alert alert-error" style={{ fontSize: 15, padding: '14px 18px' }}><i className="ti ti-alert-circle" style={{ fontSize: 18 }} />{error}</div>}

      <div className="card" style={{ marginBottom: 28 }}>
        <div className="card-header" style={{ fontSize: 16, padding: '16px 32px' }}><i className="ti ti-info-square" style={{ marginRight: 8, color: '#744FC6' }} />General Claim Information</div>
        <div className="card-body" style={{ padding: '32px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }}>
            <div>
              <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Faculty (PI)</div>
              <div style={{ fontWeight: 700, marginTop: 6, fontSize: 16 }}>
                <span style={{ color: '#744FC6', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate(`/dean/faculty/${claim.faculty_id}`)}>
                  {claim.faculty_name}
                </span>
              </div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{claim.department}</div>
            </div>
            <div>
              <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Project Number</div>
              <div style={{ fontWeight: 700, marginTop: 6, fontSize: 16, color: '#4C4C9D' }}>{claim.project_no || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Date Submitted</div>
              <div style={{ fontWeight: 600, marginTop: 6, fontSize: 15, color: '#334155' }}>{claim.submitted_at ? new Date(claim.submitted_at).toLocaleString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid #f1f5f9', marginTop: 20, paddingTop: 16 }}>
            <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Purpose of Expenditure</div>
            <div style={{ marginTop: 6, fontSize: 15, color: '#334155', fontWeight: 500, lineHeight: 1.5 }}>{claim.purpose}</div>
          </div>
        </div>
      </div>

      <BillItemsTable
        items={claim.items}
        totalAmount={claim.total_amount}
        isPending={false}
      />

      {claim.items && claim.items.length > 0 && (
        <div className="card" style={{ marginBottom: 28 }}>
          <div className="card-header" style={{ fontSize: 16, padding: '16px 32px' }}><i className="ti ti-chart-pie" style={{ marginRight: 8, color: '#744FC6' }} />Budget Segregation (Classified by SRIC)</div>
          <div className="card-body" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: '24px 32px' }}>
            {Object.entries(budgetHeadSummaries).map(([bh, amt]) => (
              <div key={bh} style={{ background: '#f8fafc', padding: '14px 20px', borderRadius: 10, minWidth: 180, border: '1.5px solid #e1e0de', boxShadow: '0 1px 3px rgba(0,0,0,0.01)' }}>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{bh}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#744FC6', marginTop: 6, fontFamily: "'Outfit', sans-serif" }}>₹{amt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {sricApproval && (
        <div className="card" style={{ marginBottom: 28, border: '1.5px solid #dcfce7' }}>
          <div className="card-header" style={{ background: '#f0fdf4', color: '#166534', fontSize: 16, padding: '16px 32px', borderBottom: '1.5px solid #dcfce7' }}><i className="ti ti-circle-check" style={{ marginRight: 8 }} />SRIC Cell Verification Info</div>
          <div className="card-body" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', fontSize: 15 }}>
              <div>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Verified By</div>
                <div style={{ fontWeight: 700, color: '#4C4C9D' }}>{sricApproval.actor_name}</div>
              </div>
              <div>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Date Verified</div>
                <div style={{ fontWeight: 600, color: '#334155' }}>{new Date(sricApproval.acted_at).toLocaleString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            </div>
            {sricApproval.remarks && (
              <div style={{ marginTop: 20, padding: '16px 20px', background: '#f8fafc', borderLeft: '4px solid #16a34a', fontSize: 15, lineHeight: 1.5, color: '#334155', fontStyle: 'italic', borderRadius: '0 8px 8px 0' }}>
                "{sricApproval.remarks}"
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 28 }}>
        <div className="card-header" style={{ fontSize: 16, padding: '16px 32px' }}><i className="ti ti-history" style={{ marginRight: 8, color: '#744FC6' }} />Claim Audit Trail & Remarks</div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '32px' }}>
          {claim.audit_logs?.map((log, index) => (
            <div key={log.id} style={{ display: 'flex', gap: 16, position: 'relative' }}>
              {index !== claim.audit_logs.length - 1 && (
                <div style={{ position: 'absolute', left: 8, top: 22, bottom: -18, width: 2, background: '#d5d3d0' }} />
              )}
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#744FC6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 9, fontWeight: 700, zIndex: 1, marginTop: 4 }}>
                {index + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                  <span style={{ fontWeight: 700, color: '#4C4C9D', fontSize: 15 }}>
                    {log.action.replace(/_/g, ' ')} {log.metadata?.version ? `(v${log.metadata.version})` : ''}
                  </span>
                  <span style={{ color: '#64748b', fontSize: 13, fontWeight: 500 }}>{new Date(log.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>Performed by: <strong>{log.actor_name || 'System'}</strong></div>
                {log.metadata?.remarks && (
                  <div style={{ color: '#b91c1c', marginTop: 6, fontStyle: 'italic', background: '#fef2f2', padding: '8px 14px', borderRadius: 6, borderLeft: '3px solid #ef4444', fontSize: 14 }}>
                    <strong>Remarks:</strong> "{log.metadata.remarks}"
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {isPending ? (
        <div className="card" style={{ border: '1.5px solid #bfdbfe' }}>
          <div className="card-header" style={{ fontSize: 16, padding: '16px 32px', background: '#eff6ff', borderBottom: '1px solid #bfdbfe', color: '#1e3a8a' }}>
            <i className="ti ti-stamp" style={{ marginRight: 8 }} /> Dean Approval Decision
          </div>
          <div className="card-body" style={{ padding: '32px' }}>
            <div className="form-group" style={{ marginBottom: 24 }}>
              <label className="form-label" style={{ fontSize: 15, marginBottom: 8 }}>Remarks <span style={{ color: '#dc2626' }}>(Required if returning or rejecting)</span></label>
              <textarea rows={4} value={remarks} onChange={e => setRemarks(e.target.value)}
                placeholder="Enter approval comments or rejection remarks here..."
                style={{ padding: '12px 16px', fontSize: 15 }} />
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 12 }}>
              <button className="btn btn-danger" style={{ height: 48, padding: '0 24px' }} onClick={() => decide('REJECTED')} disabled={submitting}>
                <i className="ti ti-x" style={{ marginRight: 8, fontSize: 16 }} />{submitting ? 'Processing...' : 'Reject & Return'}
              </button>
              <button className="btn btn-success" style={{ height: 48, padding: '0 28px' }} onClick={() => decide('APPROVED')} disabled={submitting}>
                <i className="ti ti-check" style={{ marginRight: 8, fontSize: 16 }} />{submitting ? 'Processing...' : 'Approve & Forward'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header" style={{ fontSize: 16, padding: '16px 32px' }}><i className="ti ti-file-text" style={{ marginRight: 8, color: '#744FC6' }} />Dean Review & Decision Info</div>
          <div className="card-body" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', fontSize: 15 }}>
              <div>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Decision</div>
                <span className={`badge ${claim.status === 'DEAN_REJECTED' ? 'badge-rejected' : 'badge-approved'}`} style={{ padding: '6px 14px', fontSize: 13 }}>
                  <i className={`ti ${claim.status === 'DEAN_REJECTED' ? 'ti-circle-x' : 'ti-circle-check'}`} style={{ marginRight: 6, fontSize: 14 }} />
                  {claim.status === 'DEAN_REJECTED' ? 'Rejected by Dean' : 'Approved by Dean'}
                </span>
              </div>
              {deanApproval && (
                <>
                  <div>
                    <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Decided By</div>
                    <div style={{ fontWeight: 700, color: '#4C4C9D' }}>{deanApproval.actor_name}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Date Decided</div>
                    <div style={{ fontWeight: 600, color: '#334155' }}>{new Date(deanApproval.acted_at).toLocaleString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </>
              )}
            </div>
            {deanApproval?.remarks && (
              <div style={{ marginTop: 20, padding: '16px 20px', background: '#f8fafc', borderRadius: 8, border: '1.5px solid #d5d3d0', fontSize: 15, lineHeight: 1.5, color: '#334155' }}>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Approval Remarks</div>
                "{deanApproval.remarks}"
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const groupItemsByInvoice = (items = []) => {
  const groups = {};
  items.forEach(it => {
    const key = it.bill_no || 'unknown';
    const useClassified = it.sric_cgst !== null && it.sric_cgst !== undefined;
    const base = parseFloat(it.unit_price || 0) * parseInt(it.quantity || 1);
    const cgst = useClassified ? parseFloat(it.sric_cgst) : parseFloat(it.cgst_amount || 0);
    const sgst = useClassified ? parseFloat(it.sric_sgst) : parseFloat(it.sgst_amount || 0);
    const igst = useClassified ? parseFloat(it.sric_igst) : parseFloat(it.igst_amount || 0);
    const other = useClassified ? parseFloat(it.sric_other_charges) : parseFloat(it.other_charges || 0);

    if (!groups[key]) {
      groups[key] = {
        vendor_name: it.vendor_name,
        bill_no: it.bill_no,
        bill_date: it.bill_date,
        gstin_vendor: it.gstin_vendor,
        cgst_amount: 0,
        sgst_amount: 0,
        igst_amount: 0,
        other_charges: 0,
        products: []
      };
    }

    groups[key].cgst_amount += cgst;
    groups[key].sgst_amount += sgst;
    groups[key].igst_amount += igst;
    groups[key].other_charges += other;

    const prodTotal = base + cgst + sgst + igst + other;

    groups[key].products.push({
      ...it,
      prod_total: prodTotal
    });
  });
  return Object.values(groups);
};

function BillItemsTable({ items = [], totalAmount }) {
  const [selectedItem, setSelectedItem] = useState(null);
  const invoices = groupItemsByInvoice(items);

  return (
    <>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#4C4C9D', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <i className="ti ti-receipt" style={{ color: '#744FC6' }} /> Supporting Bill Invoices ({invoices.length})
      </div>

      {invoices.map((inv, idx) => {
        const invBase = inv.products.reduce((sum, p) => sum + (parseFloat(p.unit_price || 0) * parseInt(p.quantity || 1)), 0);
        const invGst = inv.cgst_amount + inv.sgst_amount + inv.igst_amount;
        const invTotal = inv.products.reduce((sum, p) => sum + p.prod_total, 0);

        return (
          <div key={idx} className="card" style={{ marginBottom: 28, border: '1px solid #d5d3d0' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '16px 32px' }}>
              <span style={{ fontWeight: 700 }}>Invoice #{idx + 1} — No: <strong style={{ color: '#744FC6' }}>{inv.bill_no}</strong></span>
              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>
                <i className="ti ti-info-circle" style={{ marginRight: 4 }} /> Click any row to view breakdown details
              </span>
            </div>
            <div className="card-body" style={{ padding: '32px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, fontSize: 14, marginBottom: 16, borderBottom: '1px solid #f1f5f9', paddingBottom: 16 }}>
                <div><span style={{ color: '#64748b', fontWeight: 500 }}>Vendor Name:</span> <strong>{inv.vendor_name}</strong></div>
                <div><span style={{ color: '#64748b', fontWeight: 500 }}>Vendor GSTIN:</span> {inv.gstin_vendor || '—'}</div>
              </div>

              <table className="table" style={{ marginBottom: 20 }}>
                <thead>
                  <tr>
                    <th style={{ width: 50 }}>#</th>
                    <th>Item Description</th>
                    <th style={{ width: 220 }}>Budget Head</th>
                    <th style={{ width: 100, textAlign: 'right' }}>Qty</th>
                    <th style={{ width: 135, textAlign: 'right' }}>Unit Price</th>
                    <th style={{ width: 135, textAlign: 'right' }}>Total (Base+Tax)</th>
                  </tr>
                </thead>
                <tbody>
                  {inv.products.map((p, pIdx) => (
                    <tr
                      key={p.id || pIdx}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedItem(p)}
                      title="Click to view breakdown details"
                    >
                      <td>{pIdx + 1}</td>
                      <td style={{ fontWeight: 600, color: '#4C4C9D' }}>{p.description}</td>
                      <td>
                        {p.budget_head ? (
                          <span className="badge badge-approved">{p.budget_head}</span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: 13 }}>Not segregated</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{p.quantity} {p.quantity_unit || 'pcs'}</td>
                      <td style={{ textAlign: 'right' }}>₹{parseFloat(p.unit_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#4C4C9D' }}>₹{p.prod_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, fontSize: 14, color: '#334155', fontWeight: '600' }}>
                <div>Base Amount: ₹{invBase.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                {invGst > 0 && (
                  <div style={{ color: '#475569' }}>
                    GST ({[
                      inv.cgst_amount > 0 && `CGST: ₹${inv.cgst_amount.toFixed(2)}`,
                      inv.sgst_amount > 0 && `SGST: ₹${inv.sgst_amount.toFixed(2)}`,
                      inv.igst_amount > 0 && `IGST: ₹${inv.igst_amount.toFixed(2)}`
                    ].filter(Boolean).join(', ')}): ₹{invGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                )}
                {parseFloat(inv.other_charges) > 0 && <div>Other Charges: ₹{parseFloat(inv.other_charges).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>}
                <div style={{ fontSize: 16, color: '#744FC6', fontWeight: 800, marginTop: 4 }}>
                  Invoice Total: ₹{invTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <div className="card" style={{ marginBottom: 28, background: 'linear-gradient(135deg, #f3f0fc 0%, #eeebfc 100%)', borderColor: '#d5d3d0' }}>
        <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px' }}>
          <div style={{ fontSize: 15, color: '#744FC6', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Claim Grand Total</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#4C4C9D', fontFamily: "'Outfit', sans-serif" }}>
            ₹{parseFloat(totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {selectedItem && (
        <ItemDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </>
  );
}

function ItemDetailModal({ item, onClose }) {
  const base = parseFloat(item.unit_price || 0) * parseFloat(item.quantity || 1);
  const cgstAmt = parseFloat(item.cgst_amount || 0);
  const sgstAmt = parseFloat(item.sgst_amount || 0);
  const igstAmt = parseFloat(item.igst_amount || 0);
  const otherCharges = parseFloat(item.other_charges || 0);
  const total = base + cgstAmt + sgstAmt + igstAmt + otherCharges;

  const classifiedCgst = item.sric_cgst !== null && item.sric_cgst !== undefined ? parseFloat(item.sric_cgst) : null;
  const classifiedSgst = item.sric_sgst !== null && item.sric_sgst !== undefined ? parseFloat(item.sric_sgst) : null;
  const classifiedIgst = item.sric_igst !== null && item.sric_igst !== undefined ? parseFloat(item.sric_igst) : null;
  const classifiedOther = item.sric_other_charges !== null && item.sric_other_charges !== undefined ? parseFloat(item.sric_other_charges) : null;
  const classifiedTotal = (classifiedCgst !== null ? classifiedCgst : cgstAmt) + 
                          (classifiedSgst !== null ? classifiedSgst : sgstAmt) + 
                          (classifiedIgst !== null ? classifiedIgst : igstAmt) + 
                          (classifiedOther !== null ? classifiedOther : otherCharges) + base;

  const Field = ({ label, value, full }) => (
    <div style={{ gridColumn: full ? '1 / -1' : undefined }}>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: 13, color: '#1a1a1a', lineHeight: 1.6, wordBreak: 'break-word' }}>{value || '—'}</div>
    </div>
  );

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
        backdropFilter: 'blur(3px)',
        animation: 'modalFadeIn 0.15s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 14,
          width: '100%',
          maxWidth: 620,
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
          animation: 'modalSlideUp 0.18s ease',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: '1px solid #e5e5e3',
          position: 'sticky', top: 0, background: '#fff', zIndex: 1,
          borderRadius: '14px 14px 0 0',
        }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Bill Item Details</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Bill no. {item.bill_no}</div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#f5f5f4', border: 'none', borderRadius: 8,
              width: 32, height: 32, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#555', fontSize: 16, transition: 'background 0.12s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#e5e5e3'}
            onMouseLeave={e => e.currentTarget.style.background = '#f5f5f4'}
          >
            <i className="ti ti-x" />
          </button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#744FC6', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              <i className="ti ti-building-store" style={{ marginRight: 6 }} />Vendor Information
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
              <Field label="Vendor Name" value={item.vendor_name} />
              <Field label="GSTIN" value={item.gstin_vendor} />
            </div>
          </div>

          <div style={{ borderTop: '1px solid #f0f0ee' }} />

          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#744FC6', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              <i className="ti ti-file-invoice" style={{ marginRight: 6 }} />Bill Information
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
              <Field label="Bill Number" value={item.bill_no} />
              <Field
                label="Bill Date"
                value={item.bill_date
                  ? new Date(item.bill_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
                  : '—'}
              />
              <Field label="Description" value={item.description} full />
            </div>
          </div>

          <div style={{ borderTop: '1px solid #f0f0ee' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#666', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Submitted Breakdown
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
                <Field label="Quantity" value={`${item.quantity} ${item.quantity_unit || 'pcs'}`} />
                <Field label="Unit Price" value={`₹${parseFloat(item.unit_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
                <Field label="Base Amount" value={`₹${base.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#27500A', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                SRIC Classified Breakdown
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
                <Field label="Base Amount" value={`₹${base.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
                <div />
                <Field label="Classified CGST" value={`₹${classifiedCgst?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '—'}`} />
                <Field label="Classified SGST" value={`₹${classifiedSgst?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '—'}`} />
                <Field label="Classified IGST" value={`₹${classifiedIgst?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '—'}`} />
                <Field label="Classified Other" value={`₹${classifiedOther?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '—'}`} />
              </div>
            </div>
          </div>

          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: '#f3f0fc', borderRadius: 10, padding: '14px 18px',
          }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#744FC6' }}>Final Classified Total</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#744FC6' }}>
              ₹{classifiedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes modalFadeIn  { from { opacity: 0 }                       to { opacity: 1 } }
        @keyframes modalSlideUp { from { transform: translateY(24px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `}</style>
    </div>
  );
}
