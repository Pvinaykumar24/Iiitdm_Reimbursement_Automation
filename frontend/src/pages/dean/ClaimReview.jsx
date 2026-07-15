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
      budgetHeadSummaries[bh] = (budgetHeadSummaries[bh] || 0) + parseFloat(it.total_amount || 0);
    });
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}><i className="ti ti-arrow-left" /></button>
        <h1 className="page-title" style={{ margin: 0 }}>Review — {claim.claim_no}</h1>
        <span className={`badge ${badge.cls}`} style={{ marginLeft: 4 }}>{badge.label}</span>
        {claim.status !== 'DRAFT' && claim.status !== 'SRIC_PENDING' && claim.status !== 'SRIC_REJECTED' && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => window.open(`/claims/${claim.id}/print?role=dean`, '_blank')}
            style={{ marginLeft: 'auto', background: '#fff', border: '1px solid #d4d4d0', padding: '6px 12px' }}
          >
            <i className="ti ti-printer" style={{ marginRight: 6 }} />Print / Download
          </button>
        )}
      </div>

      {error && <div className="alert alert-error"><i className="ti ti-alert-circle" />{error}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">Claim details</div>
        <div className="card-body">
          <div className="form-row form-row-2" style={{ marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: '#888' }}>Faculty (PI)</div>
              <div style={{ fontWeight: 500, marginTop: 2 }}>
                <span style={{ color: '#534AB7', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate(`/dean/faculty/${claim.faculty_id}`)}>
                  {claim.faculty_name}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#888' }}>{claim.department}</div>
            </div>
            <div><div style={{ fontSize: 11, color: '#888' }}>Project</div><div style={{ fontWeight: 500, marginTop: 2 }}>{claim.project_no || '—'}</div></div>
          </div>
          <div style={{ marginBottom: 8 }}><div style={{ fontSize: 11, color: '#888' }}>Purpose</div><div style={{ marginTop: 2 }}>{claim.purpose}</div></div>
          <div><div style={{ fontSize: 11, color: '#888' }}>Submitted</div><div style={{ marginTop: 2 }}>{claim.submitted_at ? new Date(claim.submitted_at).toLocaleString('en-IN') : '—'}</div></div>
        </div>
      </div>

      <BillItemsTable
        items={claim.items}
        totalAmount={claim.total_amount}
        isPending={false}
      />

      {claim.items && claim.items.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">Budget Segregation (Classified by SRIC)</div>
          <div className="card-body" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {Object.entries(budgetHeadSummaries).map(([bh, amt]) => (
              <div key={bh} style={{ background: '#f5f5f4', padding: '10px 14px', borderRadius: 8, minWidth: 160, border: '1px solid #e5e5e3' }}>
                <div style={{ fontSize: 11, color: '#666', fontWeight: 500 }}>{bh}</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#534AB7', marginTop: 2 }}>₹{amt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {sricApproval && (
        <div className="card" style={{ marginBottom: 16, border: '1px solid #EAF3DE' }}>
          <div className="card-header" style={{ background: '#F4F9EE', color: '#27500A' }}>SRIC Cell Verification Info</div>
          <div className="card-body">
            <div style={{ display: 'flex', gap: 24, fontSize: 13 }}>
              <div>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Verified By</div>
                <div style={{ fontWeight: 500 }}>{sricApproval.actor_name}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Date</div>
                <div>{new Date(sricApproval.acted_at).toLocaleString('en-IN')}</div>
              </div>
            </div>
            {sricApproval.remarks && (
              <div style={{ marginTop: 12, padding: '10px 12px', background: '#fcfcfc', borderLeft: '3.5px solid #3B6D11', fontSize: 13, fontStyle: 'italic' }}>
                "{sricApproval.remarks}"
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">Audit trail</div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {claim.audit_logs?.map(log => (
            <div key={log.id} style={{ display: 'flex', gap: 10, fontSize: 13 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#534AB7', marginTop: 5, flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 500 }}>
                  {log.action.replace(/_/g, ' ')} {log.metadata?.version ? `(v${log.metadata.version})` : ''}
                </div>
                {log.metadata?.remarks && <div style={{ color: '#A32D2D', marginTop: 2, fontStyle: 'italic' }}>Remarks: "{log.metadata.remarks}"</div>}
                <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>{log.actor_name || 'System'} · {new Date(log.created_at).toLocaleString('en-IN')}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {isPending ? (
        <div className="card">
          <div className="card-header">Dean Final Approval Decision</div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Remarks <span style={{ color: '#A32D2D' }}>(required if rejecting)</span></label>
              <textarea rows={3} value={remarks} onChange={e => setRemarks(e.target.value)}
                placeholder="Add final review remarks..." />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-danger" onClick={() => decide('REJECTED')} disabled={submitting}>
                <i className="ti ti-x" style={{ marginRight: 6 }} />{submitting ? 'Processing...' : 'Reject & Return'}
              </button>
              <button className="btn btn-success" onClick={() => decide('APPROVED')} disabled={submitting}>
                <i className="ti ti-check" style={{ marginRight: 6 }} />{submitting ? 'Processing...' : 'Recommend & Forward for Processing'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">Dean Approval Info</div>
          <div className="card-body">
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13 }}>
              <div>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Decision</div>
                <span className={`badge ${claim.status === 'DEAN_REJECTED' ? 'badge-rejected' : 'badge-approved'}`}>
                  <i className={`ti ${claim.status === 'DEAN_REJECTED' ? 'ti-circle-x' : 'ti-circle-check'}`} style={{ marginRight: 4, fontSize: 11 }} />
                  {claim.status === 'DEAN_REJECTED' ? 'Rejected' : 'Approved & Forwarded'}
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
        cgst_amount: 0,
        sgst_amount: 0,
        igst_amount: 0,
        other_charges: parseFloat(it.other_charges || 0),
        products: []
      };
    } else {
      groups[key].other_charges += parseFloat(it.other_charges || 0);
    }

    const base = parseFloat(it.unit_price || 0) * parseInt(it.quantity || 1);
    const cgst = parseFloat(it.cgst_amount || 0);
    const sgst = parseFloat(it.sgst_amount || 0);
    const igst = parseFloat(it.igst_amount || 0);
    const prodTotal = base + cgst + sgst + igst;

    groups[key].cgst_amount += cgst;
    groups[key].sgst_amount += sgst;
    groups[key].igst_amount += igst;

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
      <div style={{ fontSize: 15, fontWeight: 600, color: '#444', marginBottom: 12 }}>
        Bill Invoices ({invoices.length})
      </div>

      {invoices.map((inv, idx) => {
        const invBase = inv.products.reduce((sum, p) => sum + (parseFloat(p.unit_price || 0) * parseInt(p.quantity || 1)), 0);
        const invGst = inv.cgst_amount + inv.sgst_amount + inv.igst_amount;
        const invTotal = inv.products.reduce((sum, p) => sum + p.prod_total, 0) + parseFloat(inv.other_charges || 0);

        return (
          <div key={idx} className="card" style={{ marginBottom: 16 }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Invoice {idx + 1} — No: <strong>{inv.bill_no}</strong></span>
              <span style={{ fontSize: 12, color: '#888' }}>
                <i className="ti ti-eye" style={{ marginRight: 4 }} />Click any row to view breakdown
              </span>
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
                    <th style={{ width: 180 }}>Budget Head</th>
                    <th style={{ width: 100, textAlign: 'right' }}>Qty</th>
                    <th style={{ width: 120, textAlign: 'right' }}>Unit Price</th>
                    <th style={{ width: 120, textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {inv.products.map((p, pIdx) => (
                    <tr
                      key={p.id || pIdx}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedItem(p)}
                    >
                      <td>{pIdx + 1}</td>
                      <td>{p.description}</td>
                      <td>
                        {p.budget_head ? (
                          <span className="badge badge-approved" style={{ fontSize: 11 }}>{p.budget_head}</span>
                        ) : (
                          <span style={{ color: '#888', fontStyle: 'italic', fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>{p.quantity} {p.quantity_unit || 'pcs'}</td>
                      <td style={{ textAlign: 'right' }}>₹{parseFloat(p.unit_price || 0).toFixed(2)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 500 }}>₹{p.prod_total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, fontSize: 12, color: '#1a1a1a', fontWeight: '600' }}>
                <div>Base Amount: ₹{invBase.toFixed(2)}</div>
                {invGst > 0 && (
                  <div>
                    GST ({[
                      inv.cgst_amount > 0 && `CGST: ₹${inv.cgst_amount.toFixed(2)}`,
                      inv.sgst_amount > 0 && `SGST: ₹${inv.sgst_amount.toFixed(2)}`,
                      inv.igst_amount > 0 && `IGST: ₹${inv.igst_amount.toFixed(2)}`
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
          <div style={{ fontSize: 22, fontWeight: 700, color: '#3c3489' }}>
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
  const cgstAmt = (base * parseFloat(item.cgst_percent || 0)) / 100;
  const sgstAmt = (base * parseFloat(item.sgst_percent || 0)) / 100;
  const igstAmt = (base * parseFloat(item.igst_percent || 0)) / 100;
  const otherCharges = parseFloat(item.other_charges || 0);
  const total = base + cgstAmt + sgstAmt + igstAmt + otherCharges;

  const classifiedCgst = item.sric_cgst !== null && item.sric_cgst !== undefined ? parseFloat(item.sric_cgst) : null;
  const classifiedSgst = item.sric_sgst !== null && item.sric_sgst !== undefined ? parseFloat(item.sric_sgst) : null;
  const classifiedIgst = item.sric_igst !== null && item.sric_igst !== undefined ? parseFloat(item.sric_igst) : null;
  const classifiedOther = item.sric_other_charges !== null && item.sric_other_charges !== undefined ? parseFloat(item.sric_other_charges) : null;
  const classifiedTotal = (classifiedCgst || 0) + (classifiedSgst || 0) + (classifiedIgst || 0) + (classifiedOther || 0) + base;

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
            <div style={{ fontSize: 11, fontWeight: 600, color: '#534AB7', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              <i className="ti ti-building-store" style={{ marginRight: 6 }} />Vendor Information
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
              <Field label="Vendor Name" value={item.vendor_name} />
              <Field label="GSTIN" value={item.gstin_vendor} />
            </div>
          </div>

          <div style={{ borderTop: '1px solid #f0f0ee' }} />

          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#534AB7', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
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
                <div />
                <Field label={`CGST @ ${item.cgst_percent}%`} value={`₹${cgstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
                <Field label={`SGST @ ${item.sgst_percent}%`} value={`₹${sgstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
                {parseFloat(item.igst_percent) > 0 && (
                  <Field label={`IGST @ ${item.igst_percent}%`} value={`₹${igstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
                )}
                {otherCharges > 0 && (
                  <Field label="Other Charges" value={`₹${otherCharges.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
                )}
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
            background: '#EEEDFE', borderRadius: 10, padding: '14px 18px',
          }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#534AB7' }}>Final Classified Total</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#534AB7' }}>
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
