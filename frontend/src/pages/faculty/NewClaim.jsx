import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { claimsApi } from '../../api';


const QUANTITY_UNITS = ['pcs', 'kg', 'liter', 'box', 'packet', 'meter', 'other'];

const groupItemsByInvoice = (items = []) => {
  const groups = {};
  items.forEach(it => {
    const key = it.bill_no || 'unknown';
    if (!groups[key]) {
      groups[key] = {
        vendor_name: it.vendor_name,
        bill_no: it.bill_no,
        bill_date: it.bill_date ? new Date(it.bill_date).toISOString().split('T')[0] : '',
        gstin_vendor: it.gstin_vendor || '',
        cgst_percent: parseFloat(it.cgst_percent || 0),
        sgst_percent: parseFloat(it.sgst_percent || 0),
        igst_percent: parseFloat(it.igst_percent || 0),
        other_charges: parseFloat(it.other_charges || 0),
        products: []
      };
    }

    const base = parseFloat(it.unit_price || 0) * parseInt(it.quantity || 1);
    const cgst = base * parseFloat(it.cgst_percent || 0) / 100;
    const sgst = base * parseFloat(it.sgst_percent || 0) / 100;
    const igst = base * parseFloat(it.igst_percent || 0) / 100;
    const prodTotal = base + cgst + sgst + igst;

    groups[key].products.push({
      description: it.description,
      quantity: it.quantity,
      quantity_unit: it.quantity_unit || 'pcs',
      unit_price: parseFloat(it.unit_price || 0),
      total_amount: prodTotal
    });
  });
  return Object.values(groups);
};

const EMPTY_PRODUCT = {
  description: '',
  quantity: 1,
  quantity_unit: 'pcs',
  unit_price: '',
  total_amount: 0
};

const EMPTY_INVOICE = {
  vendor_name: '',
  bill_no: '',
  bill_date: '',
  gstin_vendor: '',
  cgst_percent: 0,
  sgst_percent: 0,
  igst_percent: 0,
  other_charges: 0,
  products: [{ ...EMPTY_PRODUCT }]
};

const calcProductTotal = (prod, inv) => {
  const base = parseFloat(prod.unit_price || 0) * parseInt(prod.quantity || 1);
  const cgst = base * parseFloat(inv.cgst_percent || 0) / 100;
  const sgst = base * parseFloat(inv.sgst_percent || 0) / 100;
  const igst = base * parseFloat(inv.igst_percent || 0) / 100;
  return parseFloat((base + cgst + sgst + igst).toFixed(2));
};

export default function NewClaim() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ project_no: '', purpose: '' });
  const [claimId, setClaimId] = useState(null);
  const [invoices, setInvoices] = useState([{
    ...EMPTY_INVOICE,
    products: [{ ...EMPTY_PRODUCT }]
  }]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const itemsSaved = useRef(false);

  useState(() => {
    const draftIdParam = new URLSearchParams(window.location.search).get('draftId');
    if (draftIdParam) {
      claimsApi.getById(draftIdParam).then(res => {
        const claimData = res.data;
        setClaimId(claimData.id);
        setForm({ project_no: claimData.project_no, purpose: claimData.purpose });
        if (claimData.items && claimData.items.length > 0) {
          const reconstructed = groupItemsByInvoice(claimData.items);
          setInvoices(reconstructed);
          itemsSaved.current = true;
        }
      }).catch(console.error);
    }
  });

  const handleStep1 = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      if (claimId) {
        await claimsApi.editDraft(claimId, form);
      } else {
        const { data } = await claimsApi.create(form);
        setClaimId(data.id);
      }
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create claim');
    } finally { setLoading(false); }
  };

  const updateInvoiceHeader = (invIdx, field, val) => {
    const nextInvoices = invoices.map((inv, i) => {
      if (i !== invIdx) return inv;
      const updatedInv = { ...inv, [field]: val };
      updatedInv.products = updatedInv.products.map(p => ({
        ...p,
        total_amount: calcProductTotal(p, updatedInv)
      }));
      return updatedInv;
    });
    setInvoices(nextInvoices);
  };

  const updateProduct = (invIdx, prodIdx, field, val) => {
    const nextInvoices = invoices.map((inv, i) => {
      if (i !== invIdx) return inv;
      const nextProducts = inv.products.map((p, j) => {
        if (j !== prodIdx) return p;
        const updatedProd = { ...p, [field]: val };
        updatedProd.total_amount = calcProductTotal(updatedProd, inv);
        return updatedProd;
      });
      return { ...inv, products: nextProducts };
    });
    setInvoices(nextInvoices);
  };

  const addInvoice = () => {
    setInvoices([...invoices, {
      ...EMPTY_INVOICE,
      products: [{ ...EMPTY_PRODUCT }]
    }]);
  };

  const removeInvoice = (invIdx) => {
    setInvoices(invoices.filter((_, i) => i !== invIdx));
  };

  const addProduct = (invIdx) => {
    const nextInvoices = invoices.map((inv, i) => {
      if (i !== invIdx) return inv;
      return {
        ...inv,
        products: [...inv.products, { ...EMPTY_PRODUCT }]
      };
    });
    setInvoices(nextInvoices);
  };

  const removeProduct = (invIdx, prodIdx) => {
    const nextInvoices = invoices.map((inv, i) => {
      if (i !== invIdx) return inv;
      return {
        ...inv,
        products: inv.products.filter((_, j) => j !== prodIdx)
      };
    });
    setInvoices(nextInvoices);
  };

  const handleStep2 = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      if (itemsSaved.current) {
        await claimsApi.clearItems(claimId);
      }

      const flatItems = [];
      for (const inv of invoices) {
        inv.products.forEach((prod, pIdx) => {
          flatItems.push({
            vendor_name: inv.vendor_name,
            bill_no: inv.bill_no,
            bill_date: inv.bill_date,
            gstin_vendor: inv.gstin_vendor || null,
            cgst_percent: parseFloat(inv.cgst_percent || 0),
            sgst_percent: parseFloat(inv.sgst_percent || 0),
            igst_percent: parseFloat(inv.igst_percent || 0),
            other_charges: pIdx === 0 ? parseFloat(inv.other_charges || 0) : 0,
            description: prod.description,
            quantity: parseInt(prod.quantity || 1),
            quantity_unit: prod.quantity_unit || 'pcs',
            unit_price: parseFloat(prod.unit_price || 0),
            total_amount: prod.total_amount + (pIdx === 0 ? parseFloat(inv.other_charges || 0) : 0)
          });
        });
      }

      for (const item of flatItems) {
        await claimsApi.addItem(claimId, item);
      }
      itemsSaved.current = true;
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save invoice items');
    } finally { setLoading(false); }
  };

  const handleSubmit = async () => {
    setError(''); setLoading(true);
    try {
      await claimsApi.submit(claimId);
      navigate('/faculty/claims');
    } catch (err) {
      setError(err.response?.data?.message || 'Submission failed');
    } finally { setLoading(false); }
  };

  const grandTotal = invoices.reduce((sum, inv) => {
    const invProdTotal = inv.products.reduce((s, p) => s + (p.total_amount || 0), 0);
    return sum + invProdTotal + parseFloat(inv.other_charges || 0);
  }, 0);

  const totalItemsCount = invoices.reduce((sum, inv) => sum + inv.products.length, 0);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}><i className="ti ti-arrow-left" /></button>
        <h1 className="page-title" style={{ margin: 0 }}>New reimbursement claim</h1>
      </div>

      {/* ── Stepper ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['Project details', 'Bill items', 'Review & submit'].map((label, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
            padding: '4px 12px', borderRadius: 20,
            background: step === i+1 ? '#EEEDFE' : step > i+1 ? '#EAF3DE' : '#f5f5f4',
            color: step === i+1 ? '#3C3489' : step > i+1 ? '#27500A' : '#888',
            fontWeight: step === i+1 ? 500 : 400
          }}>
            {step > i+1 ? <i className="ti ti-check" /> : <span>{i+1}</span>}
            {label}
          </div>
        ))}
      </div>

      {error && <div className="alert alert-error"><i className="ti ti-alert-circle" />{error}</div>}

      {/* ── Step 1: Project details ── */}
      {step === 1 && (
        <div className="card">
          <div className="card-header">Step 1 — Project details</div>
          <div className="card-body">
            <form onSubmit={handleStep1}>
              <div className="form-group">
                <label className="form-label">Project number / name *</label>
                <input
                  type="text"
                  value={form.project_no}
                  onChange={e => setForm({ ...form, project_no: e.target.value })}
                  placeholder="e.g., DST/2024/001 or SERB Project on Robotics"
                  required
                />
                <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                  Enter your funding agency project number or a short project name.
                </div>
              </div>



              <div className="form-group">
                <label className="form-label">Purpose of expenditure *</label>
                <textarea
                  rows={3}
                  value={form.purpose}
                  onChange={e => setForm({ ...form, purpose: e.target.value })}
                  placeholder="e.g., AC Repair + Everest Stabilizer 5KVA for Lab 417B"
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Creating...' : 'Continue →'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Step 2: Bill items ── */}
      {step === 2 && (
        <form onSubmit={handleStep2}>
          <div className="alert alert-warning">
            <i className="ti ti-alert-triangle" />
            Bills older than 60 days or exceeding ₹25,000 per item will be rejected.
          </div>

          {/* Project & budget head summary bar */}
          <div style={{
            background: '#fafaf9', border: '1px solid #e5e5e3', borderRadius: 8,
            padding: '10px 14px', marginBottom: 16, fontSize: 12, display: 'flex', gap: 20, flexWrap: 'wrap'
          }}>
            <span><span style={{ color: '#888' }}>Project: </span><strong>{form.project_no}</strong></span>
          </div>

          {invoices.map((inv, idx) => (
            <div key={idx} className="card" style={{ marginBottom: 20, border: '1px solid #d4d4d0' }}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f5f5f4' }}>
                <span>Billing Invoice {idx + 1}</span>
                {invoices.length > 1 && (
                  <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }} onClick={() => removeInvoice(idx)}>
                    <i className="ti ti-trash" style={{ color: '#A32D2D', marginRight: 4 }} /> Remove Invoice
                  </button>
                )}
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                
                {/* Header Info */}
                <div className="form-row form-row-4">
                  <div className="form-group">
                    <label className="form-label">Vendor name *</label>
                    <input type="text" value={inv.vendor_name} onChange={e => updateInvoiceHeader(idx, 'vendor_name', e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Vendor GSTIN (optional)</label>
                    <input type="text" value={inv.gstin_vendor} onChange={e => updateInvoiceHeader(idx, 'gstin_vendor', e.target.value)} placeholder="Optional" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Bill date *</label>
                    <input type="date" value={inv.bill_date} onChange={e => updateInvoiceHeader(idx, 'bill_date', e.target.value)} max={new Date().toISOString().split('T')[0]} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Bill / invoice no. *</label>
                    <input type="text" value={inv.bill_no} onChange={e => updateInvoiceHeader(idx, 'bill_no', e.target.value)} required />
                  </div>
                </div>

                {/* Products Section */}
                <div style={{ background: '#fcfcfb', border: '1px dashed #d4d4d0', borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#534AB7', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Products / Items</div>
                  
                  {inv.products.map((prod, pIdx) => (
                    <div key={pIdx} style={{ display: 'grid', gridTemplateColumns: '30px 2fr 80px 100px 120px 100px 40px', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ textAlign: 'center', fontWeight: 500, fontSize: 13, color: '#666' }}>{pIdx + 1}</div>
                      <div>
                        <input type="text" placeholder="Item description *" value={prod.description} onChange={e => updateProduct(idx, pIdx, 'description', e.target.value)} required />
                      </div>
                      <div>
                        <input type="number" min={1} placeholder="Qty" value={prod.quantity} onChange={e => updateProduct(idx, pIdx, 'quantity', e.target.value)} required />
                      </div>
                      <div>
                        <select value={prod.quantity_unit} onChange={e => updateProduct(idx, pIdx, 'quantity_unit', e.target.value)} required>
                          {QUANTITY_UNITS.map(unit => (
                            <option key={unit} value={unit}>{unit}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <input type="number" step="0.01" min={0} placeholder="Unit Price (₹) *" value={prod.unit_price} onChange={e => updateProduct(idx, pIdx, 'unit_price', e.target.value)} required />
                      </div>
                      <div style={{ fontWeight: 500, textAlign: 'right', paddingRight: 10, fontSize: 13 }}>
                        ₹{(prod.total_amount || 0).toFixed(2)}
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        {inv.products.length > 1 && (
                          <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '4px 6px', border: 'none', background: 'transparent' }} onClick={() => removeProduct(idx, pIdx)}>
                            <i className="ti ti-trash" style={{ color: '#A32D2D', fontSize: 14 }} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 6, background: '#fff' }} onClick={() => addProduct(idx)}>
                    <i className="ti ti-plus" style={{ marginRight: 4 }} /> Add new item
                  </button>
                </div>

                {/* Tax & Extra Row */}
                <div className="form-row form-row-4" style={{ marginTop: 4 }}>
                  <div className="form-group">
                    <label className="form-label">CGST %</label>
                    <input type="number" step="0.01" min={0} value={inv.cgst_percent} onChange={e => updateInvoiceHeader(idx, 'cgst_percent', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">SGST %</label>
                    <input type="number" step="0.01" min={0} value={inv.sgst_percent} onChange={e => updateInvoiceHeader(idx, 'sgst_percent', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">IGST %</label>
                    <input type="number" step="0.01" min={0} value={inv.igst_percent} onChange={e => updateInvoiceHeader(idx, 'igst_percent', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Other charges (₹)</label>
                    <input type="number" step="0.01" min={0} value={inv.other_charges} onChange={e => updateInvoiceHeader(idx, 'other_charges', e.target.value)} />
                  </div>
                </div>

                {/* Calculation Info */}
                <div style={{ fontSize: 12, color: '#666', background: '#fafaf9', padding: '10px 14px', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    Products Base: ₹{inv.products.reduce((sum, p) => sum + (parseFloat(p.unit_price || 0) * parseInt(p.quantity || 1)), 0).toFixed(2)} · 
                    GST: ₹{inv.products.reduce((sum, p) => {
                      const base = parseFloat(p.unit_price || 0) * parseInt(p.quantity || 1);
                      const tax = base * (parseFloat(inv.cgst_percent || 0) + parseFloat(inv.sgst_percent || 0) + parseFloat(inv.igst_percent || 0)) / 100;
                      return sum + tax;
                    }, 0).toFixed(2)} · 
                    Other charges: ₹{parseFloat(inv.other_charges || 0).toFixed(2)}
                  </div>
                  <div>
                    <strong style={{ color: '#1a1a1a', fontSize: 13 }}>Invoice Total: ₹{(
                      inv.products.reduce((sum, p) => sum + p.total_amount, 0) + parseFloat(inv.other_charges || 0)
                    ).toFixed(2)}</strong>
                  </div>
                </div>

              </div>
            </div>
          ))}

          <button type="button" className="btn btn-ghost" style={{ width: '100%', marginBottom: 16, background: '#fff' }} onClick={addInvoice}>
            <i className="ti ti-plus" style={{ marginRight: 6 }} /> Add new bill invoice
          </button>

          <div style={{ background: '#EEEDFE', borderRadius: 8, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, color: '#534AB7' }}>Claim total ({totalItemsCount} item{totalItemsCount>1?'s':''})</div>
              <div style={{ fontSize: 22, fontWeight: 500, color: '#26215C' }}>₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : 'Review →'}</button>
            </div>
          </div>
        </form>
      )}

      {/* ── Step 3: Review & Submit ── */}
      {step === 3 && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">Review claim details</div>
            <div className="card-body">
              <div className="form-row form-row-2" style={{ marginBottom: 16 }}>
                <div><div style={{ fontSize: 11, color: '#888' }}>Project</div><div style={{ fontWeight: 500, marginTop: 2 }}>{form.project_no}</div></div>
                <div><div style={{ fontSize: 11, color: '#888' }}>Purpose</div><div style={{ fontWeight: 500, marginTop: 2, fontSize: 13 }}>{form.purpose}</div></div>
              </div>
            </div>
          </div>

          <div style={{ fontSize: 14, fontWeight: 600, color: '#444', marginBottom: 10 }}>Invoices List</div>

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
                  <span>Billing Invoice {idx + 1} — No: <strong>{inv.bill_no}</strong></span>
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
                        <th style={{ width: 100, textAlign: 'right' }}>Qty</th>
                        <th style={{ width: 120, textAlign: 'right' }}>Unit Price</th>
                        <th style={{ width: 120, textAlign: 'right' }}>Total</th>
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
              <div style={{ fontSize: 14, color: '#26215C', fontWeight: 500 }}>Reimbursement Claim Grand Total</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#3c3489' }}>₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            </div>
          </div>

          <div className="alert alert-info"><i className="ti ti-info-circle" />Once submitted, this claim will be forwarded to Dean SR for review. Attach physical bills to the printed copy and submit to the Dean office.</div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setStep(2)}>← Edit items</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>{loading ? 'Submitting...' : 'Submit claim →'}</button>
          </div>
        </div>
      )}
    </>
  );
}