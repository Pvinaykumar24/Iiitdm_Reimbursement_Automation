import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { claimsApi, projectsApi } from '../../api';


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
        cgst_type: 'value',
        sgst_type: 'value',
        igst_type: 'value',
        other_type: 'value',
        cgst_value: 0,
        sgst_value: 0,
        igst_value: 0,
        other_value: 0,
        cgst_percent: '',
        sgst_percent: '',
        igst_percent: '',
        other_percent: '',
        products: []
      };
    }

    const base = parseFloat(it.unit_price || 0) * (parseInt(it.quantity) || 0);
    const cgst = parseFloat(it.cgst_amount || 0);
    const sgst = parseFloat(it.sgst_amount || 0);
    const igst = parseFloat(it.igst_amount || 0);
    const other = parseFloat(it.other_charges || 0);

    groups[key].cgst_value += cgst;
    groups[key].sgst_value += sgst;
    groups[key].igst_value += igst;
    groups[key].other_value += other;

    groups[key].products.push({
      description: it.description,
      quantity: it.quantity,
      quantity_unit: it.quantity_unit || 'pcs',
      unit_price: parseFloat(it.unit_price || 0),
      total_amount: base
    });
  });

  Object.values(groups).forEach(inv => {
    inv.cgst_value = inv.cgst_value > 0 ? String(inv.cgst_value) : '';
    inv.sgst_value = inv.sgst_value > 0 ? String(inv.sgst_value) : '';
    inv.igst_value = inv.igst_value > 0 ? String(inv.igst_value) : '';
    inv.other_value = inv.other_value > 0 ? String(inv.other_value) : '';
  });

  return Object.values(groups);
};

const EMPTY_PRODUCT = {
  description: '',
  quantity: '',
  quantity_unit: 'pcs',
  unit_price: '',
  total_amount: 0
};

const EMPTY_INVOICE = {
  vendor_name: '',
  bill_no: '',
  bill_date: '',
  gstin_vendor: '',
  cgst_percent: '',
  sgst_percent: '',
  igst_percent: '',
  other_percent: '',
  cgst_type: 'percent',
  sgst_type: 'percent',
  igst_type: 'percent',
  other_type: 'value',
  cgst_value: '',
  sgst_value: '',
  igst_value: '',
  other_value: '',
  products: [{ ...EMPTY_PRODUCT }]
};

const getEffectiveInvoiceTaxes = (inv) => {
  const baseTotal = inv.products.reduce((sum, p) => sum + (parseFloat(p.unit_price || 0) * (parseInt(p.quantity) || 0)), 0);
  
  let cgst_amt = parseFloat(inv.cgst_value || 0);
  if (inv.cgst_type === 'percent') {
    cgst_amt = baseTotal * parseFloat(inv.cgst_percent || 0) / 100;
  }
  
  let sgst_amt = parseFloat(inv.sgst_value || 0);
  if (inv.sgst_type === 'percent') {
    sgst_amt = baseTotal * parseFloat(inv.sgst_percent || 0) / 100;
  }

  let igst_amt = parseFloat(inv.igst_value || 0);
  if (inv.igst_type === 'percent') {
    igst_amt = baseTotal * parseFloat(inv.igst_percent || 0) / 100;
  }

  let other_amt = parseFloat(inv.other_value || 0);
  if (inv.other_type === 'percent') {
    other_amt = baseTotal * parseFloat(inv.other_percent || 0) / 100;
  }
  
  return { cgst_amt, sgst_amt, igst_amt, other_amt };
};

const calcProductTotal = (prod) => {
  return parseFloat((parseFloat(prod.unit_price || 0) * (parseInt(prod.quantity) || 0)).toFixed(2));
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
  const [submitted, setSubmitted] = useState(false);
  const [myProjects, setMyProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const itemsSaved = useRef(false);

  useEffect(() => {
    // Fetch PI's assigned projects
    setProjectsLoading(true);
    projectsApi.getMy()
      .then(res => {
        setMyProjects(res.data);
      })
      .catch(err => {
        console.error('Failed to fetch assigned projects:', err);
      })
      .finally(() => setProjectsLoading(false));

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
  }, []);

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
      return { ...inv, [field]: val };
    });
    setInvoices(nextInvoices);
  };

  const updateProduct = (invIdx, prodIdx, field, val) => {
    const nextInvoices = invoices.map((inv, i) => {
      if (i !== invIdx) return inv;
      const nextProducts = inv.products.map((p, j) => {
        if (j !== prodIdx) return p;
        const updatedProd = { ...p, [field]: val };
        updatedProd.total_amount = calcProductTotal(updatedProd);
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
        const baseTotal = inv.products.reduce((sum, p) => sum + (parseFloat(p.unit_price || 0) * (parseInt(p.quantity) || 0)), 0);
        const { cgst_amt, sgst_amt, igst_amt, other_amt } = getEffectiveInvoiceTaxes(inv);

        inv.products.forEach((prod) => {
          const base = parseFloat(prod.unit_price || 0) * (parseInt(prod.quantity) || 0);
          const ratio = baseTotal > 0 ? (base / baseTotal) : 0;
          
          const itemCgst = parseFloat((cgst_amt * ratio).toFixed(2));
          const itemSgst = parseFloat((sgst_amt * ratio).toFixed(2));
          const itemIgst = parseFloat((igst_amt * ratio).toFixed(2));
          const itemOther = parseFloat((other_amt * ratio).toFixed(2));

          flatItems.push({
            vendor_name: inv.vendor_name,
            bill_no: inv.bill_no,
            bill_date: inv.bill_date,
            gstin_vendor: inv.gstin_vendor || null,
            cgst_amount: itemCgst,
            sgst_amount: itemSgst,
            igst_amount: itemIgst,
            other_charges: itemOther,
            description: prod.description,
            quantity: parseInt(prod.quantity || 1),
            quantity_unit: prod.quantity_unit || 'pcs',
            unit_price: parseFloat(prod.unit_price || 0),
            total_amount: parseFloat((base + itemCgst + itemSgst + itemIgst + itemOther).toFixed(2))
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
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Submission failed');
    } finally { setLoading(false); }
  };

  const grandTotal = invoices.reduce((sum, inv) => {
    const invBase = inv.products.reduce((s, p) => s + (p.total_amount || 0), 0);
    const { cgst_amt, sgst_amt, igst_amt, other_amt } = getEffectiveInvoiceTaxes(inv);
    return sum + invBase + cgst_amt + sgst_amt + igst_amt + other_amt;
  }, 0);

  const totalItemsCount = invoices.reduce((sum, inv) => sum + inv.products.length, 0);

  if (submitted) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px 24px', maxWidth: 600, margin: '40px auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ fontSize: 54, color: '#27500A', marginBottom: 16 }}>✓</div>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: '#1a1a1a', marginBottom: 10 }}>Claim Submitted Successfully!</h2>
        <p style={{ color: '#666', fontSize: 13, lineHeight: 1.6, marginBottom: 24, maxWidth: 460 }}>
          Your reimbursement claim has been successfully generated and forwarded to the <strong>SRIC Cell</strong>. Please print the official reimbursement form below and submit it along with physical bill receipts to the SRIC Section.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            className="btn btn-ghost"
            style={{ background: '#f5f5f4', border: '1px solid #d4d4d0', padding: '8px 16px' }}
            onClick={() => navigate('/faculty/claims')}
          >
            Go to My Claims
          </button>
          <button
            className="btn btn-primary"
            style={{ padding: '8px 16px' }}
            onClick={() => window.open(`/claims/${claimId}/print?role=faculty`, '_blank')}
          >
            <i className="ti ti-printer" style={{ marginRight: 6 }} />Print / Download Form
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}><i className="ti ti-arrow-left" /></button>
        <h1 className="page-title" style={{ margin: 0 }}>New reimbursement claim</h1>
      </div>

      {/* ── Stepper ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {['Project details', 'Bill items', 'Review & submit'].map((label, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 8, fontSize: '14px',
            padding: '8px 18px', borderRadius: '30px',
            background: step === i + 1 ? '#f3f0fc' : step > i + 1 ? '#dcfce7' : '#f1f5f9',
            color: step === i + 1 ? '#744FC6' : step > i + 1 ? '#15803d' : '#64748b',
            fontWeight: step >= i + 1 ? 600 : 500,
            border: '1px solid',
            borderColor: step === i + 1 ? '#d5d3d0' : step > i + 1 ? '#bbf7d0' : '#e1e0de',
            boxShadow: step === i + 1 ? '0 2px 4px rgba(83,74,183,0.08)' : 'none',
          }}>
            {step > i + 1 ? <i className="ti ti-circle-check" style={{ fontSize: 16 }} /> : <span style={{ background: step === i + 1 ? '#744FC6' : '#94a3b8', color: '#fff', width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{i + 1}</span>}
            {label}
          </div>
        ))}
      </div>

      {error && <div className="alert alert-error" style={{ fontSize: 15, padding: '14px 18px' }}><i className="ti ti-alert-circle" style={{ fontSize: 18 }} />{error}</div>}

      {/* ── Step 1: Project details ── */}
      {step === 1 && (
        <div className="card" style={{ maxWidth: 800 }}>
          <div className="card-header" style={{ fontSize: 18, padding: '20px 32px' }}>Step 1 — Project & Purpose</div>
          <div className="card-body" style={{ padding: '32px' }}>
            <form onSubmit={handleStep1}>
              <div className="form-group" style={{ marginBottom: 24 }}>
                <label className="form-label" style={{ fontSize: 15, marginBottom: 8 }}>Project Funding *</label>
                {projectsLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, color: '#64748b', padding: '10px 14px' }}>
                    <div className="spinner" style={{ width: 20, height: 20 }} />
                    Loading assigned projects...
                  </div>
                ) : myProjects.length === 0 ? (
                  <div style={{ padding: '16px 20px', background: '#fef2f2', border: '1.5px solid #fecaca', color: '#b91c1c', borderRadius: 8, fontSize: '15px', fontWeight: 600, lineHeight: 1.5 }}>
                    <i className="ti ti-alert-circle" style={{ marginRight: 8, fontSize: 18, verticalAlign: 'middle' }} />
                    No assigned projects found. Please contact the SRIC Cell to assign a project to your profile before creating a claim.
                  </div>
                ) : (
                  <select
                    value={form.project_no}
                    onChange={e => setForm({ ...form, project_no: e.target.value })}
                    required
                    style={{ width: '100%', padding: '12px 16px', fontSize: '15px', borderRadius: 8, border: '1.5px solid #d5d3d0', background: '#fff', outline: 'none', height: 48 }}
                  >
                    <option value="">-- Select Assigned Project --</option>
                    {myProjects.map(p => (
                      <option key={p.id} value={p.project_no}>
                        {p.project_no} — {p.title}
                      </option>
                    ))}
                  </select>
                )}
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>
                  Select the project funding this reimbursement claim from your assigned list.
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 28 }}>
                <label className="form-label" style={{ fontSize: 15, marginBottom: 8 }}>Purpose of Expenditure *</label>
                <textarea
                  rows={4}
                  value={form.purpose}
                  onChange={e => setForm({ ...form, purpose: e.target.value })}
                  placeholder="Provide a detailed purpose (e.g., AC Repair + Everest Stabilizer 5KVA for Lab 417B)"
                  required
                  style={{ padding: '12px 16px', fontSize: '15px', lineHeight: 1.5 }}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ padding: '12px 28px', fontSize: 15, height: 48 }} disabled={loading || projectsLoading || myProjects.length === 0}>
                {loading ? 'Creating...' : 'Continue to Invoice & Items →'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Step 2: Bill items ── */}
      {step === 2 && (
        <form onSubmit={handleStep2}>
          <div style={{ height: 4 }} />

          {/* Project & budget head summary bar */}
          <div style={{
            background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: 10,
            padding: '14px 20px', marginBottom: 24, fontSize: 14, display: 'flex', gap: 24, flexWrap: 'wrap', color: '#1e3a8a', fontWeight: 500
          }}>
            <span><i className="ti ti-folder-open" style={{ marginRight: 6 }} /><span style={{ color: '#60a5fa' }}>Selected Project: </span><strong>{form.project_no}</strong></span>
            <span><i className="ti ti-notes" style={{ marginRight: 6 }} /><span style={{ color: '#60a5fa' }}>Purpose: </span><strong>{form.purpose}</strong></span>
          </div>

          {invoices.map((inv, idx) => (
            <div key={idx} className="card" style={{ marginBottom: 28, border: '1px solid #d5d3d0' }}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '16px 32px' }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#4C4C9D' }}>Billing Invoice #{idx + 1}</span>
                {invoices.length > 1 && (
                  <button type="button" className="btn btn-danger btn-sm" style={{ padding: '6px 12px' }} onClick={() => removeInvoice(idx)}>
                    <i className="ti ti-trash" style={{ marginRight: 6 }} /> Remove Invoice
                  </button>
                )}
              </div>
              <div className="card-body" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: 24 }}>

                {/* Header Info */}
                <div className="form-row form-row-4">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Vendor Name *</label>
                    <input type="text" value={inv.vendor_name} onChange={e => updateInvoiceHeader(idx, 'vendor_name', e.target.value)} required style={{ height: 44 }} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Vendor GSTIN (optional)</label>
                    <input type="text" value={inv.gstin_vendor} onChange={e => updateInvoiceHeader(idx, 'gstin_vendor', e.target.value)} placeholder="e.g. 33AAAAA0000A1Z1" style={{ height: 44 }} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Bill Date *</label>
                    <input type="date" value={inv.bill_date} onChange={e => updateInvoiceHeader(idx, 'bill_date', e.target.value)} max={new Date().toISOString().split('T')[0]} required style={{ height: 44 }} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Bill / Invoice No. *</label>
                    <input type="text" value={inv.bill_no} onChange={e => updateInvoiceHeader(idx, 'bill_no', e.target.value)} required style={{ height: 44 }} />
                  </div>
                </div>

                {/* Products Section */}
                <div style={{ background: '#f8fafc', border: '1.5px dashed #d5d3d0', borderRadius: 10, padding: '20px 24px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#744FC6', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <i className="ti ti-shopping-cart" style={{ fontSize: 16 }} /> Products / Items list
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '40px 2.5fr 100px 110px 140px 120px 45px', gap: 12, marginBottom: 10, fontSize: 12, fontWeight: 700, color: '#475569', paddingBottom: 8, borderBottom: '1.5px solid #d5d3d0' }}>
                    <div style={{ textAlign: 'center' }}>#</div>
                    <div>Item Description *</div>
                    <div>Qty *</div>
                    <div>Unit</div>
                    <div>Unit Price (₹) *</div>
                    <div style={{ textAlign: 'right', paddingRight: 10 }}>Total (₹)</div>
                    <div></div>
                  </div>

                  {inv.products.map((prod, pIdx) => (
                    <div key={pIdx} style={{ display: 'grid', gridTemplateColumns: '40px 2.5fr 100px 110px 140px 120px 45px', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ textAlign: 'center', fontWeight: 600, fontSize: 14, color: '#64748b' }}>{pIdx + 1}</div>
                      <div>
                        <input type="text" placeholder="Item description *" value={prod.description} onChange={e => updateProduct(idx, pIdx, 'description', e.target.value)} required style={{ height: 40 }} />
                      </div>
                      <div>
                        <input type="number" min={1} placeholder="Qty" value={prod.quantity} onChange={e => updateProduct(idx, pIdx, 'quantity', e.target.value)} required style={{ height: 40 }} />
                      </div>
                      <div>
                        <select value={prod.quantity_unit} onChange={e => updateProduct(idx, pIdx, 'quantity_unit', e.target.value)} required style={{ height: 40, padding: '8px 12px' }}>
                          {QUANTITY_UNITS.map(unit => (
                            <option key={unit} value={unit}>{unit}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <input type="number" step="0.01" min={0} placeholder="Price ₹" value={prod.unit_price} onChange={e => updateProduct(idx, pIdx, 'unit_price', e.target.value)} required style={{ height: 40 }} />
                      </div>
                      <div style={{ fontWeight: 700, textAlign: 'right', paddingRight: 10, fontSize: 15, color: '#4C4C9D' }}>
                        ₹{(prod.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        {inv.products.length > 1 && (
                          <button type="button" className="btn btn-danger" style={{ padding: '6px 8px', background: 'transparent', borderColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => removeProduct(idx, pIdx)} title="Delete item">
                            <i className="ti ti-trash" style={{ color: '#dc2626', fontSize: 16 }} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8, background: '#fff', padding: '8px 16px', fontSize: 13 }} onClick={() => addProduct(idx)}>
                    <i className="ti ti-plus" style={{ marginRight: 6 }} /> Add new product item
                  </button>
                </div>

                {/* Tax & Extra Row */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Taxes & Other Charges</div>
                  <div className="form-row form-row-4">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        CGST
                        <select 
                          value={inv.cgst_type || 'percent'} 
                          onChange={e => updateInvoiceHeader(idx, 'cgst_type', e.target.value)}
                          style={{ width: 'auto', border: 'none', background: 'transparent', padding: 0, fontSize: 12, cursor: 'pointer', outline: 'none', color: '#744FC6', fontWeight: 700 }}
                        >
                          <option value="percent">% Percentage</option>
                          <option value="value">₹ Absolute Amount</option>
                        </select>
                      </label>
                      {inv.cgst_type === 'value' ? (
                        <input type="number" step="0.01" min={0} placeholder="CGST Amt ₹" value={inv.cgst_value || ''} onChange={e => updateInvoiceHeader(idx, 'cgst_value', e.target.value)} style={{ height: 42 }} />
                      ) : (
                        <input type="number" step="0.01" min={0} placeholder="CGST % Rate" value={inv.cgst_percent || ''} onChange={e => updateInvoiceHeader(idx, 'cgst_percent', e.target.value)} style={{ height: 42 }} />
                      )}
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        SGST
                        <select 
                          value={inv.sgst_type || 'percent'} 
                          onChange={e => updateInvoiceHeader(idx, 'sgst_type', e.target.value)}
                          style={{ width: 'auto', border: 'none', background: 'transparent', padding: 0, fontSize: 12, cursor: 'pointer', outline: 'none', color: '#744FC6', fontWeight: 700 }}
                        >
                          <option value="percent">% Percentage</option>
                          <option value="value">₹ Absolute Amount</option>
                        </select>
                      </label>
                      {inv.sgst_type === 'value' ? (
                        <input type="number" step="0.01" min={0} placeholder="SGST Amt ₹" value={inv.sgst_value || ''} onChange={e => updateInvoiceHeader(idx, 'sgst_value', e.target.value)} style={{ height: 42 }} />
                      ) : (
                        <input type="number" step="0.01" min={0} placeholder="SGST % Rate" value={inv.sgst_percent || ''} onChange={e => updateInvoiceHeader(idx, 'sgst_percent', e.target.value)} style={{ height: 42 }} />
                      )}
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        IGST
                        <select 
                          value={inv.igst_type || 'percent'} 
                          onChange={e => updateInvoiceHeader(idx, 'igst_type', e.target.value)}
                          style={{ width: 'auto', border: 'none', background: 'transparent', padding: 0, fontSize: 12, cursor: 'pointer', outline: 'none', color: '#744FC6', fontWeight: 700 }}
                        >
                          <option value="percent">% Percentage</option>
                          <option value="value">₹ Absolute Amount</option>
                        </select>
                      </label>
                      {inv.igst_type === 'value' ? (
                        <input type="number" step="0.01" min={0} placeholder="IGST Amt ₹" value={inv.igst_value || ''} onChange={e => updateInvoiceHeader(idx, 'igst_value', e.target.value)} style={{ height: 42 }} />
                      ) : (
                        <input type="number" step="0.01" min={0} placeholder="IGST % Rate" value={inv.igst_percent || ''} onChange={e => updateInvoiceHeader(idx, 'igst_percent', e.target.value)} style={{ height: 42 }} />
                      )}
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        Other Charges
                        <select 
                          value={inv.other_type || 'value'} 
                          onChange={e => updateInvoiceHeader(idx, 'other_type', e.target.value)}
                          style={{ width: 'auto', border: 'none', background: 'transparent', padding: 0, fontSize: 12, cursor: 'pointer', outline: 'none', color: '#744FC6', fontWeight: 700 }}
                        >
                          <option value="percent">% Percentage</option>
                          <option value="value">₹ Absolute Amount</option>
                        </select>
                      </label>
                      {inv.other_type === 'percent' ? (
                        <input type="number" step="0.01" min={0} placeholder="Other % Rate" value={inv.other_percent || ''} onChange={e => updateInvoiceHeader(idx, 'other_percent', e.target.value)} style={{ height: 42 }} />
                      ) : (
                        <input type="number" step="0.01" min={0} placeholder="Other Amt ₹" value={inv.other_value || ''} onChange={e => updateInvoiceHeader(idx, 'other_value', e.target.value)} style={{ height: 42 }} />
                      )}
                    </div>
                  </div>
                </div>

                {/* Calculation Info */}
                <div style={{ fontSize: 13, color: '#475569', background: '#f8fafc', border: '1px solid #e1e0de', padding: '14px 20px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <span>Base Amount: <strong>₹{inv.products.reduce((sum, p) => sum + (parseFloat(p.unit_price || 0) * (parseInt(p.quantity) || 0)), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                    <span>•</span>
                    <span>GST Total: <strong>₹{(() => {
                      const { cgst_amt, sgst_amt, igst_amt } = getEffectiveInvoiceTaxes(inv);
                      return (cgst_amt + sgst_amt + igst_amt).toLocaleString('en-IN', { minimumFractionDigits: 2 });
                    })()}</strong></span>
                    <span>•</span>
                    <span>Other Charges: <strong>₹{(() => {
                      const { other_amt } = getEffectiveInvoiceTaxes(inv);
                      return other_amt.toLocaleString('en-IN', { minimumFractionDigits: 2 });
                    })()}</strong></span>
                  </div>
                  <div>
                    <strong style={{ color: '#744FC6', fontSize: 15 }}>Invoice Total: ₹{(() => {
                      const baseTotal = inv.products.reduce((sum, p) => sum + (parseFloat(p.unit_price || 0) * (parseInt(p.quantity) || 0)), 0);
                      const { cgst_amt, sgst_amt, igst_amt, other_amt } = getEffectiveInvoiceTaxes(inv);
                      return (baseTotal + cgst_amt + sgst_amt + igst_amt + other_amt).toLocaleString('en-IN', { minimumFractionDigits: 2 });
                    })()}</strong>
                  </div>
                </div>

              </div>
            </div>
          ))}

          <button type="button" className="btn btn-ghost" style={{ width: '100%', marginBottom: 28, background: '#fff', height: 48, fontSize: 15 }} onClick={addInvoice}>
            <i className="ti ti-plus" style={{ marginRight: 6 }} /> Add new billing invoice
          </button>

          <div style={{
            background: 'linear-gradient(135deg, #f3f0fc 0%, #eeebfc 100%)',
            border: '1.5px solid #d5d3d0',
            borderRadius: 12,
            padding: '20px 28px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
          }}>
            <div>
              <div style={{ fontSize: 13, color: '#744FC6', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Reimbursement Claim Grand Total ({totalItemsCount} item{totalItemsCount !== 1 ? 's' : ''})</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#4C4C9D', fontFamily: "'Outfit', sans-serif", marginTop: 4 }}>₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="button" className="btn btn-ghost" style={{ height: 48, padding: '0 24px' }} onClick={() => setStep(1)}><i className="ti ti-arrow-left" style={{ marginRight: 6 }} /> Back</button>
              <button type="submit" className="btn btn-primary" style={{ height: 48, padding: '0 28px' }} disabled={loading}>{loading ? 'Saving...' : 'Review Claim Details →'}</button>
            </div>
          </div>
        </form>
      )}

      {/* ── Step 3: Review & Submit ── */}
      {step === 3 && (
        <div>
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header" style={{ fontSize: 16, padding: '16px 32px' }}>Review claim project details</div>
            <div className="card-body" style={{ padding: '32px' }}>
              <div className="form-row form-row-2">
                <div>
                  <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Project Number</div>
                  <div style={{ fontWeight: 700, marginTop: 4, fontSize: 16, color: '#4C4C9D' }}>{form.project_no}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Purpose of Expenditure</div>
                  <div style={{ fontWeight: 500, marginTop: 4, fontSize: 15, color: '#334155' }}>{form.purpose}</div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ fontSize: 16, fontWeight: 700, color: '#4C4C9D', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="ti ti-receipt" style={{ color: '#744FC6' }} /> Billing Invoices Summary
          </div>

          {invoices.map((inv, idx) => {
            const invBase = inv.products.reduce((sum, p) => sum + (parseFloat(p.unit_price || 0) * (parseInt(p.quantity) || 0)), 0);
            const { cgst_amt, sgst_amt, igst_amt, other_amt } = getEffectiveInvoiceTaxes(inv);
            const invGst = cgst_amt + sgst_amt + igst_amt;
            const invTotal = invBase + invGst + other_amt;

            return (
              <div key={idx} className="card" style={{ marginBottom: 24, border: '1px solid #e1e0de' }}>
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '16px 32px' }}>
                  <span style={{ fontWeight: 700 }}>Invoice #{idx + 1} — No: <strong style={{ color: '#744FC6' }}>{inv.bill_no}</strong></span>
                  <span style={{ fontSize: 14, color: '#64748b', fontWeight: 500 }}>Bill Date: {new Date(inv.bill_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
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
                        <th style={{ width: 140, textAlign: 'right' }}>Quantity</th>
                        <th style={{ width: 150, textAlign: 'right' }}>Unit Price</th>
                        <th style={{ width: 150, textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inv.products.map((p, pIdx) => (
                        <tr key={pIdx}>
                          <td>{pIdx + 1}</td>
                          <td style={{ fontWeight: 500, color: '#4C4C9D' }}>{p.description}</td>
                          <td style={{ textAlign: 'right', fontWeight: 500 }}>{p.quantity} {p.quantity_unit}</td>
                          <td style={{ textAlign: 'right' }}>₹{parseFloat(p.unit_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#4C4C9D' }}>₹{p.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, fontSize: 14, color: '#334155', fontWeight: '600' }}>
                    <div>Base Amount: ₹{invBase.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                    {(cgst_amt > 0 || sgst_amt > 0 || igst_amt > 0) && (
                      <div style={{ color: '#475569' }}>
                        GST ({[
                          cgst_amt > 0 && `CGST: ₹${cgst_amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
                          sgst_amt > 0 && `SGST: ₹${sgst_amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
                          igst_amt > 0 && `IGST: ₹${igst_amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                        ].filter(Boolean).join(', ')}): ₹{invGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    )}
                    {other_amt > 0 && <div>Other Charges: ₹{other_amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>}
                    <div style={{ fontSize: 16, color: '#744FC6', fontWeight: 800, marginTop: 6, borderTop: '1px solid #e1e0de', paddingTop: 6, width: '100%', textAlign: 'right' }}>
                      Invoice Total: ₹{invTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="card" style={{ marginBottom: 24, background: 'linear-gradient(135deg, #f3f0fc 0%, #eeebfc 100%)', borderColor: '#d5d3d0' }}>
            <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px' }}>
              <div style={{ fontSize: 15, color: '#744FC6', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Reimbursement Claim Grand Total</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#4C4C9D', fontFamily: "'Outfit', sans-serif" }}>₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            </div>
          </div>

          <div className="alert alert-info" style={{ fontSize: 15, padding: '14px 18px', borderLeft: '4px solid #3b82f6', background: '#eff6ff' }}>
            <i className="ti ti-info-circle" style={{ fontSize: 18, marginTop: 2 }} />
            <span>Once submitted, this claim will be forwarded to the <strong>SRIC SECTION</strong> for review. Please submit the physical bills and vouchers to the SRIC SECTION for final verification and matching.</span>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="btn btn-ghost" style={{ height: 48, padding: '0 24px' }} onClick={() => setStep(2)}><i className="ti ti-arrow-left" style={{ marginRight: 6 }} /> Edit items</button>
            <button className="btn btn-primary" style={{ height: 48, padding: '0 28px' }} onClick={handleSubmit} disabled={loading}>
              <i className="ti ti-circle-check" style={{ marginRight: 6, fontSize: 16 }} /> {loading ? 'Submitting...' : 'Submit Claim →'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}