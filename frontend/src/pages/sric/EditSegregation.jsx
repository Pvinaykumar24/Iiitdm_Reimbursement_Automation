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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}><i className="ti ti-arrow-left" /></button>
        <h1 className="page-title" style={{ margin: 0 }}>Edit Segregation — {claim.claim_no}</h1>
      </div>

      {error && <div className="alert alert-error"><i className="ti ti-alert-circle" />{error}</div>}
      {validationErrors.map((errText, errIdx) => (
        <div key={errIdx} className="alert alert-error" style={{ marginBottom: 12 }}>
          <i className="ti ti-alert-circle" style={{ marginRight: 6 }} />
          {errText}
        </div>
      ))}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">Claim details</div>
        <div className="card-body" style={{ fontSize: 13 }}>
          <div style={{ display: 'flex', gap: 24, marginBottom: 10 }}>
            <div><span style={{ color: '#888' }}>PI:</span> <strong>{claim.faculty_name}</strong></div>
            <div><span style={{ color: '#888' }}>Project:</span> <strong>{claim.project_no || '—'}</strong></div>
            <div><span style={{ color: '#888' }}>Total Amount:</span> <strong>₹{parseFloat(claim.total_amount).toLocaleString('en-IN')}</strong></div>
          </div>
          <div><span style={{ color: '#888' }}>Purpose:</span> {claim.purpose}</div>
        </div>
      </div>

      <BillItemsTableEditable
        items={claim.items}
        itemBudgetHeads={itemBudgetHeads}
        setItemBudgetHeads={setItemBudgetHeads}
        touchedFields={touchedFields}
        setTouchedFields={setTouchedFields}
      />

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-body" style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={() => navigate(-1)} disabled={submitting}>
            Cancel
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleSave} 
            disabled={submitting || validationErrors.length > 0}
          >
            <i className="ti ti-device-floppy" style={{ marginRight: 6 }} />
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
      <div style={{ fontSize: 15, fontWeight: 600, color: '#444', marginBottom: 12 }}>
        Bill Invoices ({invoices.length})
      </div>

      {invoices.map((inv, idx) => {
        const invBase = inv.products.reduce((sum, p) => sum + (parseFloat(p.unit_price || 0) * parseInt(p.quantity || 1)), 0);
        const invGst = inv.cgst_amount + inv.sgst_amount + inv.igst_amount;
        const invTotal = inv.products.reduce((sum, p) => sum + p.prod_total, 0) + parseFloat(inv.other_charges || 0);

        return (
          <div key={idx} className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              Invoice {idx + 1} — No: <strong>{inv.bill_no}</strong>
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
                    <tr key={p.id || pIdx}>
                      <td>{pIdx + 1}</td>
                      <td>{p.description}</td>
                      <td>
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
                  return (
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
    </>
  );
}
