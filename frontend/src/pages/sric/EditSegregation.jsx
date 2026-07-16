import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { claimsApi, approvalsApi } from '../../api';
import { useToastStore } from '../../store/toastStore';

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
        nextHeads[it.id] = {
          ...(nextHeads[it.id] || {}),
          [f.sric]: facultyTotal !== 0 ? facultyTotal : ''
        };
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

const isTaxReadonly = (itemId, items) => {
  if (!items || items.length === 0) return false;
  const invoices = {};
  items.forEach(it => {
    const key = it.bill_no || 'unknown';
    if (!invoices[key]) invoices[key] = [];
    invoices[key].push(it);
  });

  let readonly = false;
  Object.keys(invoices).forEach(key => {
    const group = invoices[key];
    if (group.length === 1 && group[0].id === itemId) {
      readonly = true;
    }
  });
  return readonly;
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
    const prodTotal = base + cgst + sgst + igst;

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

export default function SricEditSegregation() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [claim, setClaim] = useState(null);
  const [loading, setLoading] = useState(true);
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

  const handleSave = async () => {
    const validationErrors = getValidationErrors();
    if (validationErrors.length > 0) {
      setError(validationErrors[0]);
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      await approvalsApi.updateSricSegregation(id, itemBudgetHeads);
      useToastStore.getState().addToast('Segregation details saved successfully.', 'success');
      navigate(`/sric/claims/${id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save segregation.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div style={{ padding: 32, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>;
  if (!claim) return <div className="alert alert-error">Claim not found.</div>;

  const validationErrors = getValidationErrors();

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ width: 40, height: 40, padding: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className="ti ti-arrow-left" style={{ fontSize: 18 }} /></button>
        <h1 className="page-title" style={{ margin: 0 }}>Edit Segregation — {claim.claim_no}</h1>
      </div>

      {error && <div className="alert alert-error" style={{ fontSize: 15, padding: '14px 18px' }}><i className="ti ti-alert-circle" style={{ fontSize: 18 }} />{error}</div>}
      {validationErrors.map((errText, errIdx) => (
        <div key={errIdx} className="alert alert-error" style={{ marginBottom: 16, fontSize: 14, padding: '12px 16px' }}>
          <i className="ti ti-alert-circle" style={{ marginRight: 8, fontSize: 16 }} />
          {errText}
        </div>
      ))}

      <div className="card" style={{ marginBottom: 28 }}>
        <div className="card-header" style={{ fontSize: 16, padding: '16px 32px' }}><i className="ti ti-info-square" style={{ marginRight: 8, color: '#744FC6' }} />General Claim Information</div>
        <div className="card-body" style={{ padding: '32px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }}>
            <div>
              <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Faculty (PI)</div>
              <div style={{ fontWeight: 700, marginTop: 6, fontSize: 16, color: '#4C4C9D' }}>{claim.faculty_name}</div>
            </div>
            <div>
              <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Project Number</div>
              <div style={{ fontWeight: 700, marginTop: 6, fontSize: 16, color: '#4C4C9D' }}>{claim.project_no || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Claim Amount</div>
              <div style={{ fontWeight: 700, marginTop: 6, fontSize: 16, color: '#4C4C9D' }}>₹{parseFloat(claim.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid #f1f5f9', marginTop: 20, paddingTop: 16 }}>
            <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Purpose of Expenditure</div>
            <div style={{ marginTop: 6, fontSize: 15, color: '#334155', fontWeight: 500 }}>{claim.purpose}</div>
          </div>
        </div>
      </div>

      <BillItemsTableEditable
        items={claim.items}
        itemBudgetHeads={itemBudgetHeads}
        setItemBudgetHeads={setItemBudgetHeads}
        touchedFields={touchedFields}
        setTouchedFields={setTouchedFields}
      />

      <div className="card" style={{ marginTop: 28, background: '#f8fafc', border: '1.5px solid #d5d3d0' }}>
        <div className="card-body" style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', padding: '20px 32px' }}>
          <button className="btn btn-ghost" style={{ height: 48, padding: '0 24px' }} onClick={() => navigate(-1)} disabled={submitting}>
            Cancel
          </button>
          <button 
            className="btn btn-primary" 
            style={{ height: 48, padding: '0 28px' }}
            onClick={handleSave} 
            disabled={submitting || validationErrors.length > 0}
          >
            <i className="ti ti-device-floppy" style={{ marginRight: 8, fontSize: 16 }} />
            {submitting ? 'Saving...' : 'Save & Return'}
          </button>
        </div>
      </div>
    </>
  );
}

function BillItemsTableEditable({ items = [], itemBudgetHeads, setItemBudgetHeads, touchedFields, setTouchedFields }) {
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
      <div style={{ fontSize: 16, fontWeight: 700, color: '#4C4C9D', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <i className="ti ti-receipt" style={{ color: '#744FC6' }} /> Supporting Bill Invoices ({invoices.length})
      </div>

      {invoices.map((inv, idx) => {
        const invBase = inv.products.reduce((sum, p) => sum + (parseFloat(p.unit_price || 0) * parseInt(p.quantity || 1)), 0);
        const invGst = inv.cgst_amount + inv.sgst_amount + inv.igst_amount;
        const invTotal = inv.products.reduce((sum, p) => sum + p.prod_total, 0) + parseFloat(inv.other_charges || 0);

        return (
          <div key={idx} className="card" style={{ marginBottom: 28, border: '1px solid #d5d3d0' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '16px 32px' }}>
              <span style={{ fontWeight: 700 }}>Invoice #{idx + 1} — No: <strong style={{ color: '#744FC6' }}>{inv.bill_no}</strong></span>
              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>
                <i className="ti ti-info-circle" style={{ marginRight: 4 }} /> Classification editor
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
                    <th style={{ width: 280 }}>Budget Head Allocation & Segregation</th>
                    <th style={{ width: 100, textAlign: 'right' }}>Qty</th>
                    <th style={{ width: 130, textAlign: 'right' }}>Unit Price</th>
                    <th style={{ width: 130, textAlign: 'right' }}>Total Base</th>
                  </tr>
                </thead>
                <tbody>
                  {inv.products.map((p, pIdx) => (
                    <tr key={p.id || pIdx}>
                      <td>{pIdx + 1}</td>
                      <td style={{ fontWeight: 600, color: '#4C4C9D' }}>{p.description}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                            style={{ width: '100%', padding: '8px 12px', fontSize: 14, borderRadius: 6, border: '1.5px solid #d5d3d0', height: 38 }}
                          >
                            {DEAN_BUDGET_HEADS.map(bh => (
                              <option key={bh} value={bh}>{bh}</option>
                            ))}
                          </select>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: '#f8fafc', border: '1.5px solid #e1e0de', borderRadius: 8, padding: 10 }}>
                            <div>
                              <label style={{ display: 'block', fontSize: 11, color: '#475569', fontWeight: 700, marginBottom: 4 }}>
                                {isTaxReadonly(p.id, items) ? 'CGST (Auto) 🔒' : 'CGST (₹)'}
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min={0}
                                placeholder="0.00"
                                value={itemBudgetHeads[p.id]?.sric_cgst ?? ''}
                                onChange={e => handleTaxChange(p.id, 'sric_cgst', e.target.value)}
                                onWheel={e => e.target.blur()}
                                readOnly={isTaxReadonly(p.id, items)}
                                style={{ 
                                  width: '100%', 
                                  padding: '6px 10px', 
                                  fontSize: 13, 
                                  border: '1.5px solid #d5d3d0', 
                                  borderRadius: 6, 
                                  background: isTaxReadonly(p.id, items) ? '#f1f5f9' : '#fff',
                                  color: isTaxReadonly(p.id, items) ? '#475569' : '#000',
                                  fontWeight: isTaxReadonly(p.id, items) ? 600 : 400,
                                  cursor: isTaxReadonly(p.id, items) ? 'not-allowed' : 'text'
                                }}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: 11, color: '#475569', fontWeight: 700, marginBottom: 4 }}>
                                {isTaxReadonly(p.id, items) ? 'SGST (Auto) 🔒' : 'SGST (₹)'}
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min={0}
                                placeholder="0.00"
                                value={itemBudgetHeads[p.id]?.sric_sgst ?? ''}
                                onChange={e => handleTaxChange(p.id, 'sric_sgst', e.target.value)}
                                onWheel={e => e.target.blur()}
                                readOnly={isTaxReadonly(p.id, items)}
                                style={{ 
                                  width: '100%', 
                                  padding: '6px 10px', 
                                  fontSize: 13, 
                                  border: '1.5px solid #d5d3d0', 
                                  borderRadius: 6, 
                                  background: isTaxReadonly(p.id, items) ? '#f1f5f9' : '#fff',
                                  color: isTaxReadonly(p.id, items) ? '#475569' : '#000',
                                  fontWeight: isTaxReadonly(p.id, items) ? 600 : 400,
                                  cursor: isTaxReadonly(p.id, items) ? 'not-allowed' : 'text'
                                }}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: 11, color: '#475569', fontWeight: 700, marginBottom: 4 }}>
                                {isTaxReadonly(p.id, items) ? 'IGST (Auto) 🔒' : 'IGST (₹)'}
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min={0}
                                placeholder="0.00"
                                value={itemBudgetHeads[p.id]?.sric_igst ?? ''}
                                onChange={e => handleTaxChange(p.id, 'sric_igst', e.target.value)}
                                onWheel={e => e.target.blur()}
                                readOnly={isTaxReadonly(p.id, items)}
                                style={{ 
                                  width: '100%', 
                                  padding: '6px 10px', 
                                  fontSize: 13, 
                                  border: '1.5px solid #d5d3d0', 
                                  borderRadius: 6, 
                                  background: isTaxReadonly(p.id, items) ? '#f1f5f9' : '#fff',
                                  color: isTaxReadonly(p.id, items) ? '#475569' : '#000',
                                  fontWeight: isTaxReadonly(p.id, items) ? 600 : 400,
                                  cursor: isTaxReadonly(p.id, items) ? 'not-allowed' : 'text'
                                }}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: 11, color: '#475569', fontWeight: 700, marginBottom: 4 }}>
                                {isTaxReadonly(p.id, items) ? 'Other (Auto) 🔒' : 'Other (₹)'}
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min={0}
                                placeholder="0.00"
                                value={itemBudgetHeads[p.id]?.sric_other_charges ?? ''}
                                onChange={e => handleTaxChange(p.id, 'sric_other_charges', e.target.value)}
                                onWheel={e => e.target.blur()}
                                readOnly={isTaxReadonly(p.id, items)}
                                style={{ 
                                  width: '100%', 
                                  padding: '6px 10px', 
                                  fontSize: 13, 
                                  border: '1.5px solid #d5d3d0', 
                                  borderRadius: 6, 
                                  background: isTaxReadonly(p.id, items) ? '#f1f5f9' : '#fff',
                                  color: isTaxReadonly(p.id, items) ? '#475569' : '#000',
                                  fontWeight: isTaxReadonly(p.id, items) ? 600 : 400,
                                  cursor: isTaxReadonly(p.id, items) ? 'not-allowed' : 'text'
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{p.quantity} {p.quantity_unit || 'pcs'}</td>
                      <td style={{ textAlign: 'right' }}>₹{parseFloat(p.unit_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#4C4C9D' }}>₹{(parseFloat(p.unit_price || 0) * parseInt(p.quantity || 1)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
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
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, fontSize: 13, marginTop: 12, background: '#f8fafc', padding: 12, borderRadius: 8, border: '1.5px solid #d5d3d0', width: '100%', maxWidth: 400 }}>
                      <div style={{ color: cgstMatched ? '#16a34a' : '#dc2626', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {cgstMatched ? <i className="ti ti-circle-check" /> : <i className="ti ti-alert-triangle" />}
                        CGST: ₹{invoiceSegregatedCGST.toFixed(2)} / ₹{inv.cgst_amount.toFixed(2)} {cgstMatched ? 'Matched' : 'Mismatched'}
                      </div>
                      <div style={{ color: sgstMatched ? '#16a34a' : '#dc2626', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {sgstMatched ? <i className="ti ti-circle-check" /> : <i className="ti ti-alert-triangle" />}
                        SGST: ₹{invoiceSegregatedSGST.toFixed(2)} / ₹{inv.sgst_amount.toFixed(2)} {sgstMatched ? 'Matched' : 'Mismatched'}
                      </div>
                      <div style={{ color: igstMatched ? '#16a34a' : '#dc2626', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {igstMatched ? <i className="ti ti-circle-check" /> : <i className="ti ti-alert-triangle" />}
                        IGST: ₹{invoiceSegregatedIGST.toFixed(2)} / ₹{inv.igst_amount.toFixed(2)} {igstMatched ? 'Matched' : 'Mismatched'}
                      </div>
                      {inv.other_charges > 0 && (
                        <div style={{ color: otherMatched ? '#16a34a' : '#dc2626', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {otherMatched ? <i className="ti ti-circle-check" /> : <i className="ti ti-alert-triangle" />}
                          Other: ₹{invoiceSegregatedOther.toFixed(2)} / ₹{inv.other_charges.toFixed(2)} {otherMatched ? 'Matched' : 'Mismatched'}
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
    </>
  );
}
