import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { claimsApi, approvalsApi } from '../../api';
import { useToastStore } from '../../store/toastStore';

export default function SricClaimReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [claim, setClaim] = useState(null);
  const [loading, setLoading] = useState(true);
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [itemBudgetHeads, setItemBudgetHeads] = useState({});
  const [touchedFields, setTouchedFields] = useState({});

  useEffect(() => {
    claimsApi.getById(id).then(r => {
      setClaim(r.data);
      const initialHeads = {};
      const initialTouched = {};
      r.data.items?.forEach(it => {
        initialHeads[it.id] = {
          budget_head: it.budget_head || 'Consumable',
          sric_cgst: it.sric_cgst !== null && it.sric_cgst !== undefined && parseFloat(it.sric_cgst) !== 0 ? parseFloat(it.sric_cgst) : '',
          sric_sgst: it.sric_sgst !== null && it.sric_sgst !== undefined && parseFloat(it.sric_sgst) !== 0 ? parseFloat(it.sric_sgst) : '',
          sric_igst: it.sric_igst !== null && it.sric_igst !== undefined && parseFloat(it.sric_igst) !== 0 ? parseFloat(it.sric_igst) : '',
          sric_other_charges: it.sric_other_charges !== null && it.sric_other_charges !== undefined && parseFloat(it.sric_other_charges) !== 0 ? parseFloat(it.sric_other_charges) : '',
        };

        if (it.sric_cgst !== null && it.sric_cgst !== undefined && parseFloat(it.sric_cgst) !== 0) {
          initialTouched[`${it.id}_sric_cgst`] = true;
        }
        if (it.sric_sgst !== null && it.sric_sgst !== undefined && parseFloat(it.sric_sgst) !== 0) {
          initialTouched[`${it.id}_sric_sgst`] = true;
        }
        if (it.sric_igst !== null && it.sric_igst !== undefined && parseFloat(it.sric_igst) !== 0) {
          initialTouched[`${it.id}_sric_igst`] = true;
        }
        if (it.sric_other_charges !== null && it.sric_other_charges !== undefined && parseFloat(it.sric_other_charges) !== 0) {
          initialTouched[`${it.id}_sric_other_charges`] = true;
        }
      });
      setTouchedFields(initialTouched);
      const autoHeads = applyAutoSegregation(initialHeads, r.data.items, initialTouched);
      setItemBudgetHeads(autoHeads);
    }).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  const getValidationErrors = () => {
    const errors = [];
    if (!claim || !claim.items) return errors;

    const invoices = groupItemsByInvoice(claim.items);
    invoices.forEach(inv => {
      let segregatedCGST = 0;
      let segregatedSGST = 0;
      let segregatedIGST = 0;
      let segregatedOther = 0;

      inv.products.forEach(p => {
        const val = itemBudgetHeads[p.id] || {};
        segregatedCGST += parseFloat(val.sric_cgst || 0);
        segregatedSGST += parseFloat(val.sric_sgst || 0);
        segregatedIGST += parseFloat(val.sric_igst || 0);
        segregatedOther += parseFloat(val.sric_other_charges || 0);
      });

      const cgstMatch = Math.abs(segregatedCGST - inv.cgst_amount) <= 0.10;
      const sgstMatch = Math.abs(segregatedSGST - inv.sgst_amount) <= 0.10;
      const igstMatch = Math.abs(segregatedIGST - inv.igst_amount) <= 0.10;
      const otherMatch = Math.abs(segregatedOther - inv.other_charges) <= 0.10;

      if (!cgstMatch || !sgstMatch || !igstMatch || !otherMatch) {
        let msg = `Validation Mismatch on Invoice No: "${inv.bill_no}" (Vendor: ${inv.vendor_name}):`;
        if (!cgstMatch) msg += ` CGST mismatch (Segregated: ₹${segregatedCGST.toFixed(2)}, Faculty: ₹${inv.cgst_amount.toFixed(2)});`;
        if (!sgstMatch) msg += ` SGST mismatch (Segregated: ₹${segregatedSGST.toFixed(2)}, Faculty: ₹${inv.sgst_amount.toFixed(2)});`;
        if (!igstMatch) msg += ` IGST mismatch (Segregated: ₹${segregatedIGST.toFixed(2)}, Faculty: ₹${inv.igst_amount.toFixed(2)});`;
        if (!otherMatch) msg += ` Other Charges mismatch (Segregated: ₹${segregatedOther.toFixed(2)}, Faculty: ₹${inv.other_charges.toFixed(2)});`;
        errors.push(msg);
      }
    });
    return errors;
  };

  const decide = async (action) => {
    if (action === 'REJECTED' && !remarks.trim()) {
      setError('Please provide a reason for rejection.');
      return;
    }
    setError('');
    
    if (action === 'APPROVED') {
      const validationErrors = getValidationErrors();
      if (validationErrors.length > 0) {
        setError(validationErrors[0]);
        return;
      }
    }

    setSubmitting(true);
    try {
      await approvalsApi.sricDecide(id, action, remarks, action === 'APPROVED' ? itemBudgetHeads : undefined);
      navigate('/sric/pending');
    } catch (err) {
      setError(err.response?.data?.message || 'Action failed');
    } finally { setSubmitting(false); }
  };

  if (loading) return <div style={{ padding: 32, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>;
  if (!claim) return <div className="alert alert-error">Claim not found.</div>;

  const isPending = claim.status === 'SRIC_PENDING';
  const isEditable = claim.status === 'SRIC_PENDING' || claim.status === 'DEAN_PENDING';

  const handleUpdateSegregation = async () => {
    const validationErrors = getValidationErrors();
    if (validationErrors.length > 0) {
      setError(validationErrors[0]);
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      await approvalsApi.updateSricSegregation(id, itemBudgetHeads);
      const r = await claimsApi.getById(id);
      setClaim(r.data);
      useToastStore.getState().addToast('Segregation details updated successfully.', 'success');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update segregation.');
    } finally {
      setSubmitting(false);
    }
  };

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

  // Compute budget segregation summaries dynamically using SRIC-entered values only
  const budgetHeadSummaries = {};
  if (claim && claim.items) {
    claim.items.forEach(it => {
      const val = itemBudgetHeads[it.id];
      const bh = (val && typeof val === 'object') ? val.budget_head : (val || it.budget_head || 'Consumable');
      const base = parseFloat(it.unit_price || 0) * parseInt(it.quantity || 1);
      const sricVal = (val && typeof val === 'object') ? val : {};
      const sricSum = base
        + parseFloat(sricVal.sric_cgst          || 0)
        + parseFloat(sricVal.sric_sgst          || 0)
        + parseFloat(sricVal.sric_igst          || 0)
        + parseFloat(sricVal.sric_other_charges || 0);
      budgetHeadSummaries[bh] = (budgetHeadSummaries[bh] || 0) + sricSum;
    });
  }

  const validationErrors = getValidationErrors();

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}><i className="ti ti-arrow-left" /></button>
        <h1 className="page-title" style={{ margin: 0 }}>Review — {claim.claim_no}</h1>
        <span className={`badge ${badge.cls}`} style={{ marginLeft: 4 }}>{badge.label}</span>
      {claim.status !== 'DRAFT' && claim.status !== 'SRIC_PENDING' && (
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {claim.status === 'DEAN_PENDING' && (
            <button 
              className="btn btn-ghost btn-sm"
              onClick={() => navigate(`/sric/claims/${claim.id}/edit-segregation`)}
              style={{ background: '#fff', border: '1px solid #d4d4d0', padding: '6px 12px', color: '#534AB7', fontWeight: 500 }}
            >
              <i className="ti ti-edit" style={{ marginRight: 6 }} />Edit Segregation
            </button>
          )}
          <button 
            className="btn btn-ghost btn-sm" 
            onClick={() => window.open(`/claims/${claim.id}/print?role=sric`, '_blank')} 
            style={{ background: '#fff', border: '1px solid #d4d4d0', padding: '6px 12px' }}
          >
            <i className="ti ti-printer" style={{ marginRight: 6 }} />Print / Download
          </button>
        </div>
      )}
      </div>

      {error && <div className="alert alert-error"><i className="ti ti-alert-circle" />{error}</div>}
      {isPending && validationErrors.map((errText, errIdx) => (
        <div key={errIdx} className="alert alert-error" style={{ marginBottom: 12 }}>
          <i className="ti ti-alert-circle" style={{ marginRight: 6 }} />
          {errText}
        </div>
      ))}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">Claim details</div>
        <div className="card-body">
          <div className="form-row form-row-2" style={{ marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: '#888' }}>Faculty (PI)</div>
              <div style={{ fontWeight: 500, marginTop: 2 }}>
                <span style={{ color: '#534AB7', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate(`/sric/faculty/${claim.faculty_id}`)}>
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
        itemBudgetHeads={itemBudgetHeads}
        setItemBudgetHeads={setItemBudgetHeads}
        isPending={isPending}
        touchedFields={touchedFields}
        setTouchedFields={setTouchedFields}
      />

      {/* Segregation Summary */}
      {claim.items && claim.items.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">Budget Segregation Summary</div>
          <div className="card-body" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {Object.entries(budgetHeadSummaries).map(([bh, amt]) => (
              <div key={bh} style={{ background: '#f5f5f4', padding: '10px 14px', borderRadius: 8, minWidth: 160, border: '1px solid #e5e5e3' }}>
                <div style={{ fontSize: 11, color: '#666', fontWeight: 500 }}>{bh}</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#27500A', marginTop: 2 }}>₹{amt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
            ))}
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
          <div className="card-header">SRIC Cell Verification</div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Remarks <span style={{ color: '#A32D2D' }}>(required if rejecting)</span></label>
              <textarea rows={3} value={remarks} onChange={e => setRemarks(e.target.value)}
                placeholder="Add remarks for verification or reason for rejection..." />
            </div>
            {validationErrors.length > 0 && (
              <div style={{ color: '#A32D2D', fontSize: 13, marginBottom: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="ti ti-alert-circle" />
                <span>Segregation mismatch. Please click "Edit Segregation" in the header to classify items first.</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-danger" onClick={() => decide('REJECTED')} disabled={submitting}>
                <i className="ti ti-x" style={{ marginRight: 6 }} />{submitting ? 'Processing...' : 'Reject & Return'}
              </button>
              <button className="btn btn-success" onClick={() => decide('APPROVED')} disabled={submitting || validationErrors.length > 0}>
                <i className="ti ti-check" style={{ marginRight: 6 }} />{submitting ? 'Processing...' : 'Verify & Forward to Dean'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="card">
            <div className="card-header">SRIC Verification Info</div>
            <div className="card-body">
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Status</div>
                  <span className={`badge ${claim.status === 'SRIC_REJECTED' ? 'badge-rejected' : 'badge-approved'}`}>
                    <i className={`ti ${claim.status === 'SRIC_REJECTED' ? 'ti-circle-x' : 'ti-circle-check'}`} style={{ marginRight: 4, fontSize: 11 }} />
                    {claim.status === 'SRIC_REJECTED' ? 'Rejected' : 'Verified'}
                  </span>
                </div>
                {sricApproval && (
                  <>
                    <div>
                      <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Processed by</div>
                      <div style={{ fontWeight: 500 }}>{sricApproval.actor_name}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Date</div>
                      <div>{new Date(sricApproval.acted_at).toLocaleString('en-IN')}</div>
                    </div>
                  </>
                )}
              </div>
              {sricApproval?.remarks && (
                <div style={{ marginTop: 14, padding: '10px 14px', background: '#fafaf9', borderRadius: 7, border: '1px solid #e5e5e3', fontSize: 13 }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Verification Remarks</div>
                  {sricApproval.remarks}
                </div>
              )}
            </div>
          </div>

        </>
      )}
    </>
  );
}

const DEAN_BUDGET_HEADS = ['Consumable', 'Contingency', 'Travel', 'Equipment', 'Others', 'Accountable Consumable'];

const applyAutoSegregation = (currentHeads, items, touchedMap = {}) => {
  if (!items || items.length === 0) return currentHeads;

  const nextHeads = { ...currentHeads };
  const invoices = {};
  items.forEach(it => {
    const key = it.bill_no || 'unknown';
    if (!invoices[key]) invoices[key] = [];
    invoices[key].push(it);
  });

  const fields = [
    { sric: 'sric_cgst', faculty: 'cgst_amount' },
    { sric: 'sric_sgst', faculty: 'sgst_amount' },
    { sric: 'sric_igst', faculty: 'igst_amount' },
    { sric: 'sric_other_charges', faculty: 'other_charges' }
  ];

  Object.keys(invoices).forEach(key => {
    const group = invoices[key];

    fields.forEach(f => {
      let facultyTotal = 0;
      group.forEach(it => {
        facultyTotal += parseFloat(it[f.faculty] || 0);
      });

      if (group.length === 1) {
        const it = group[0];
        const isTouched = touchedMap[`${it.id}_${f.sric}`];
        if (isTouched) {
          nextHeads[it.id] = {
            ...(nextHeads[it.id] || {}),
            [f.sric]: nextHeads[it.id]?.[f.sric] !== '' && nextHeads[it.id]?.[f.sric] !== undefined ? nextHeads[it.id][f.sric] : (facultyTotal !== 0 ? facultyTotal : '')
          };
        }
      } else if (group.length > 1) {
        const emptyItems = [];
        let touchedSum = 0;

        group.forEach(it => {
          const val = nextHeads[it.id]?.[f.sric];
          const isTouched = touchedMap[`${it.id}_${f.sric}`];
          
          if (!isTouched || val === '' || val === undefined) {
            emptyItems.push(it);
          } else {
            touchedSum += parseFloat(val || 0);
          }
        });

        if (emptyItems.length === 1) {
          const targetIt = emptyItems[0];
          const remainder = parseFloat((facultyTotal - touchedSum).toFixed(2));
          nextHeads[targetIt.id] = {
            ...(nextHeads[targetIt.id] || {}),
            [f.sric]: remainder !== 0 ? remainder : ''
          };
        }
      }
    });
  });

  return nextHeads;
};

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
        other_charges: 0,
        products: []
      };
    }

    const base = parseFloat(it.unit_price || 0) * parseInt(it.quantity || 1);
    const cgst = parseFloat(it.cgst_amount || 0);
    const sgst = parseFloat(it.sgst_amount || 0);
    const igst = parseFloat(it.igst_amount || 0);
    const other = parseFloat(it.other_charges || 0);
    const prodTotal = base + cgst + sgst + igst + other;

    groups[key].cgst_amount += cgst;
    groups[key].sgst_amount += sgst;
    groups[key].igst_amount += igst;
    groups[key].other_charges += other;

    groups[key].products.push({
      ...it,
      prod_total: prodTotal
    });
  });
  return Object.values(groups);
};

function BillItemsTable({ items = [], totalAmount, itemBudgetHeads, setItemBudgetHeads, isPending, touchedFields, setTouchedFields }) {
  const [selectedItem, setSelectedItem] = useState(null);
  const invoices = groupItemsByInvoice(items);

  const handleTaxChange = (itemId, field, value) => {
    const isCleared = value === '';
    setTouchedFields(prev => {
      const next = { ...prev };
      if (isCleared) {
        delete next[`${itemId}_${field}`];
      } else {
        next[`${itemId}_${field}`] = true;
      }
      return next;
    });
    setItemBudgetHeads(prev => {
      const updated = {
        ...prev,
        [itemId]: {
          ...(prev[itemId] || {}),
          [field]: value
        }
      };
      const updatedTouched = { ...touchedFields };
      if (isCleared) {
        delete updatedTouched[`${itemId}_${field}`];
      } else {
        updatedTouched[`${itemId}_${field}`] = true;
      }
      return applyAutoSegregation(updated, items, updatedTouched);
    });
  };

  return (
    <>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#444', marginBottom: 12 }}>
        Bill Invoices ({invoices.length})
      </div>

      {invoices.map((inv, idx) => {
        const invBase = inv.products.reduce((sum, p) => sum + (parseFloat(p.unit_price || 0) * parseInt(p.quantity || 1)), 0);
        const invGst = inv.cgst_amount + inv.sgst_amount + inv.igst_amount;
        const invTotal = inv.products.reduce((sum, p) => sum + p.prod_total, 0);

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
                    <th style={{ width: 220 }}>Budget Head</th>
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
                      <td>
                        <div>{p.description}</div>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        {isPending ? (
                          <div>
                            <select
                              value={itemBudgetHeads[p.id]?.budget_head || 'Consumable'}
                              onChange={e => {
                                const existing = itemBudgetHeads[p.id] || {};
                                const updated = {
                                  ...itemBudgetHeads,
                                  [p.id]: { ...existing, budget_head: e.target.value }
                                };
                                setItemBudgetHeads(applyAutoSegregation(updated, items, touchedFields));
                              }}
                              style={{ width: '100%', padding: '4px 8px', fontSize: 12, borderRadius: 6, border: '1px solid #d4d4d0' }}
                            >
                              {DEAN_BUDGET_HEADS.map(bh => (
                                <option key={bh} value={bh}>{bh}</option>
                              ))}
                            </select>

                            <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, background: '#fafafa', border: '1px solid #e4e4e7', borderRadius: 6, padding: 6 }}>
                              <div>
                                <label style={{ display: 'block', fontSize: 10, color: '#71717a', fontWeight: 500, marginBottom: 2 }}>CGST (₹)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min={0}
                                  placeholder="0.00"
                                  value={itemBudgetHeads[p.id]?.sric_cgst ?? ''}
                                  onChange={e => handleTaxChange(p.id, 'sric_cgst', e.target.value)}
                                  onWheel={e => e.target.blur()}
                                  style={{ width: '100%', padding: '3px 6px', fontSize: 11, border: '1px solid #e4e4e7', borderRadius: 4, background: '#fff' }}
                                />
                              </div>
                              <div>
                                <label style={{ display: 'block', fontSize: 10, color: '#71717a', fontWeight: 500, marginBottom: 2 }}>SGST (₹)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min={0}
                                  placeholder="0.00"
                                  value={itemBudgetHeads[p.id]?.sric_sgst ?? ''}
                                  onChange={e => handleTaxChange(p.id, 'sric_sgst', e.target.value)}
                                  onWheel={e => e.target.blur()}
                                  style={{ width: '100%', padding: '3px 6px', fontSize: 11, border: '1px solid #e4e4e7', borderRadius: 4, background: '#fff' }}
                                />
                              </div>
                              <div>
                                <label style={{ display: 'block', fontSize: 10, color: '#71717a', fontWeight: 500, marginBottom: 2 }}>IGST (₹)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min={0}
                                  placeholder="0.00"
                                  value={itemBudgetHeads[p.id]?.sric_igst ?? ''}
                                  onChange={e => handleTaxChange(p.id, 'sric_igst', e.target.value)}
                                  onWheel={e => e.target.blur()}
                                  style={{ width: '100%', padding: '3px 6px', fontSize: 11, border: '1px solid #e4e4e7', borderRadius: 4, background: '#fff' }}
                                />
                              </div>
                              <div>
                                <label style={{ display: 'block', fontSize: 10, color: '#71717a', fontWeight: 500, marginBottom: 2 }}>Other (₹)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min={0}
                                  placeholder="0.00"
                                  value={itemBudgetHeads[p.id]?.sric_other_charges ?? ''}
                                  onChange={e => handleTaxChange(p.id, 'sric_other_charges', e.target.value)}
                                  onWheel={e => e.target.blur()}
                                  style={{ width: '100%', padding: '3px 6px', fontSize: 11, border: '1px solid #e4e4e7', borderRadius: 4, background: '#fff' }}
                                />
                              </div>
                            </div>
                          </div>
                        ) : (
                          p.budget_head ? (
                            <div>
                              <span className="badge badge-approved" style={{ fontSize: 11 }}>{p.budget_head}</span>
                              {(parseFloat(p.sric_cgst) > 0 || parseFloat(p.sric_sgst) > 0 || parseFloat(p.sric_igst) > 0 || parseFloat(p.sric_other_charges) > 0) && (
                                <div style={{ fontSize: 10, color: '#666', marginTop: 4, lineHeight: 1.4 }}>
                                  <strong>Segregation:</strong>
                                  {parseFloat(p.sric_cgst) > 0 && ` CGST: ₹${parseFloat(p.sric_cgst).toFixed(2)}`}
                                  {parseFloat(p.sric_sgst) > 0 && ` SGST: ₹${parseFloat(p.sric_sgst).toFixed(2)}`}
                                  {parseFloat(p.sric_igst) > 0 && ` IGST: ₹${parseFloat(p.sric_igst).toFixed(2)}`}
                                  {parseFloat(p.sric_other_charges) > 0 && ` Other: ₹${parseFloat(p.sric_other_charges).toFixed(2)}`}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: '#888', fontStyle: 'italic', fontSize: 12 }}>—</span>
                          )
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>{p.quantity} {p.quantity_unit || 'pcs'}</td>
                      <td style={{ textAlign: 'right' }}>₹{parseFloat(p.unit_price || 0).toFixed(2)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 500 }}>₹{(parseFloat(p.unit_price || 0) * parseInt(p.quantity || 1)).toFixed(2)}</td>
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
                {(() => {
                  let invoiceSegregatedCGST = 0;
                  let invoiceSegregatedSGST = 0;
                  let invoiceSegregatedIGST = 0;
                  let invoiceSegregatedOther = 0;
                  inv.products.forEach(p => {
                    const val = itemBudgetHeads[p.id] || {};
                    invoiceSegregatedCGST += parseFloat(val.sric_cgst || 0);
                    invoiceSegregatedSGST += parseFloat(val.sric_sgst || 0);
                    invoiceSegregatedIGST += parseFloat(val.sric_igst || 0);
                    invoiceSegregatedOther += parseFloat(val.sric_other_charges || 0);
                  });
                  const cgstMatched = Math.abs(invoiceSegregatedCGST - inv.cgst_amount) <= 0.10;
                  const sgstMatched = Math.abs(invoiceSegregatedSGST - inv.sgst_amount) <= 0.10;
                  const igstMatched = Math.abs(invoiceSegregatedIGST - inv.igst_amount) <= 0.10;
                  const otherMatched = Math.abs(invoiceSegregatedOther - inv.other_charges) <= 0.10;
                  return isPending && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, fontSize: 11, marginTop: 8 }}>
                      <div style={{ color: cgstMatched ? '#27500A' : '#A32D2D', fontWeight: 600 }}>
                        CGST: ₹{invoiceSegregatedCGST.toFixed(2)} segregated  /  ₹{inv.cgst_amount.toFixed(2)} entered
                      </div>
                      <div style={{ color: sgstMatched ? '#27500A' : '#A32D2D', fontWeight: 600 }}>
                        SGST: ₹{invoiceSegregatedSGST.toFixed(2)} segregated  /  ₹{inv.sgst_amount.toFixed(2)} entered
                      </div>
                      <div style={{ color: igstMatched ? '#27500A' : '#A32D2D', fontWeight: 600 }}>
                        IGST: ₹{invoiceSegregatedIGST.toFixed(2)} segregated  /  ₹{inv.igst_amount.toFixed(2)} entered
                      </div>
                      {inv.other_charges > 0 && (
                        <div style={{ color: otherMatched ? '#27500A' : '#A32D2D', fontWeight: 600 }}>
                          Other: ₹{invoiceSegregatedOther.toFixed(2)} segregated  /  ₹{inv.other_charges.toFixed(2)} entered
                        </div>
                      )}
                    </div>
                  );
                })()}
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
