import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { claimsApi, projectsApi } from '../../api';

const EMPTY_ITEM = {
  vendor_name: '', bill_no: '', bill_date: '', description: '',
  quantity: 1, unit_price: '', cgst_percent: 0, sgst_percent: 0,
  igst_percent: 0, total_amount: 0, gstin_vendor: ''
};

const calcTotal = (item) => {
  const base = parseFloat(item.unit_price || 0) * parseInt(item.quantity || 1);
  const cgst = base * parseFloat(item.cgst_percent || 0) / 100;
  const sgst = base * parseFloat(item.sgst_percent || 0) / 100;
  const igst = base * parseFloat(item.igst_percent || 0) / 100;
  return parseFloat((base + cgst + sgst + igst).toFixed(2));
};

export default function NewClaim() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [projects, setProjects] = useState([]);
  const [budgetHeads, setBudgetHeads] = useState([]);
  const [form, setForm] = useState({ project_id: '', budget_head_id: '', purpose: '' });
  const [claimId, setClaimId] = useState(null);
  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    projectsApi.getMy().then(r => setProjects(r.data)).catch(console.error);
  }, []);

  useEffect(() => {
    if (form.project_id) {
      projectsApi.getBudgetHeads(form.project_id).then(r => setBudgetHeads(r.data));
    }
  }, [form.project_id]);

  const handleStep1 = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data } = await claimsApi.create(form);
      setClaimId(data.id);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create claim');
    } finally { setLoading(false); }
  };

  const updateItem = (idx, field, val) => {
    const updated = items.map((it, i) => {
      if (i !== idx) return it;
      const next = { ...it, [field]: val };
      next.total_amount = calcTotal(next);
      return next;
    });
    setItems(updated);
  };

  const addItem = () => setItems([...items, { ...EMPTY_ITEM }]);
  const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));

  const handleStep2 = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      for (const item of items) {
        await claimsApi.addItem(claimId, item);
      }
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add items');
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

  const grandTotal = items.reduce((s, it) => s + (it.total_amount || 0), 0);
  const selectedProject = projects.find(p => p.id === form.project_id);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}><i className="ti ti-arrow-left" /></button>
        <h1 className="page-title" style={{ margin: 0 }}>New reimbursement claim</h1>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['Project details', 'Bill items', 'Review & submit'].map((label, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
            padding: '4px 12px', borderRadius: 20,
            background: step === i+1 ? '#EEEDFE' : step > i+1 ? '#EAF3DE' : '#f5f5f4',
            color: step === i+1 ? '#3C3489' : step > i+1 ? '#27500A' : '#888',
            fontWeight: step === i+1 ? 500 : 400 }}>
            {step > i+1 ? <i className="ti ti-check" /> : <span>{i+1}</span>}
            {label}
          </div>
        ))}
      </div>

      {error && <div className="alert alert-error"><i className="ti ti-alert-circle" />{error}</div>}

      {step === 1 && (
        <div className="card">
          <div className="card-header">Step 1 — Project details</div>
          <div className="card-body">
            <form onSubmit={handleStep1}>
              <div className="form-group">
                <label className="form-label">Select project *</label>
                <select value={form.project_id} onChange={e => setForm({...form, project_id: e.target.value, budget_head_id: ''})} required>
                  <option value="">-- Select your project --</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.project_no} — {p.title} ({p.funding_agency})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Budget head *</label>
                <select value={form.budget_head_id} onChange={e => setForm({...form, budget_head_id: e.target.value})} required disabled={!form.project_id}>
                  <option value="">-- Select budget head --</option>
                  {budgetHeads.map(bh => <option key={bh.id} value={bh.id}>{bh.head_name} (Allocated: ₹{parseFloat(bh.allocated).toLocaleString('en-IN')})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Purpose of expenditure *</label>
                <textarea rows={3} value={form.purpose} onChange={e => setForm({...form, purpose: e.target.value})}
                  placeholder="e.g., AC Repair + Everest Stabilizer 5KVA for Lab 417B" required />
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Creating...' : 'Continue →'}</button>
            </form>
          </div>
        </div>
      )}

      {step === 2 && (
        <form onSubmit={handleStep2}>
          <div className="alert alert-warning">
            <i className="ti ti-alert-triangle" />
            Bills older than 60 days or exceeding ₹25,000 per item will be rejected.
          </div>

          {selectedProject && (
            <div style={{ background: '#fafaf9', border: '1px solid #e5e5e3', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, display: 'flex', gap: 20 }}>
              <span><span style={{ color: '#888' }}>Project: </span><strong>{selectedProject.project_no}</strong></span>
              <span><span style={{ color: '#888' }}>Agency: </span><strong>{selectedProject.funding_agency}</strong></span>
            </div>
          )}

          {items.map((item, idx) => (
            <div key={idx} className="card" style={{ marginBottom: 12 }}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Bill item {idx + 1}</span>
                {items.length > 1 && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeItem(idx)}>
                    <i className="ti ti-trash" style={{ color: '#A32D2D' }} />
                  </button>
                )}
              </div>
              <div className="card-body">
                <div className="form-row form-row-2">
                  <div className="form-group"><label className="form-label">Vendor name *</label><input type="text" value={item.vendor_name} onChange={e=>updateItem(idx,'vendor_name',e.target.value)} required /></div>
                  <div className="form-group"><label className="form-label">Bill / invoice no. *</label><input type="text" value={item.bill_no} onChange={e=>updateItem(idx,'bill_no',e.target.value)} required /></div>
                </div>
                <div className="form-row form-row-3">
                  <div className="form-group"><label className="form-label">Bill date *</label><input type="date" value={item.bill_date} onChange={e=>updateItem(idx,'bill_date',e.target.value)} required /></div>
                  <div className="form-group"><label className="form-label">Quantity *</label><input type="number" min={1} value={item.quantity} onChange={e=>updateItem(idx,'quantity',e.target.value)} required /></div>
                  <div className="form-group"><label className="form-label">Unit price (₹) *</label><input type="number" step="0.01" min={0} value={item.unit_price} onChange={e=>updateItem(idx,'unit_price',e.target.value)} required /></div>
                </div>
                <div className="form-group"><label className="form-label">Item description *</label><input type="text" value={item.description} onChange={e=>updateItem(idx,'description',e.target.value)} placeholder="Describe the item purchased" required /></div>
                <div className="form-row form-row-4">
                  <div className="form-group"><label className="form-label">CGST %</label><input type="number" step="0.01" min={0} value={item.cgst_percent} onChange={e=>updateItem(idx,'cgst_percent',e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">SGST %</label><input type="number" step="0.01" min={0} value={item.sgst_percent} onChange={e=>updateItem(idx,'sgst_percent',e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">IGST %</label><input type="number" step="0.01" min={0} value={item.igst_percent} onChange={e=>updateItem(idx,'igst_percent',e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Vendor GSTIN</label><input type="text" value={item.gstin_vendor} onChange={e=>updateItem(idx,'gstin_vendor',e.target.value)} placeholder="Optional" /></div>
                </div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                  Base: ₹{(parseFloat(item.unit_price||0)*parseInt(item.quantity||1)).toFixed(2)} ·
                  CGST: ₹{(parseFloat(item.unit_price||0)*parseInt(item.quantity||1)*parseFloat(item.cgst_percent||0)/100).toFixed(2)} ·
                  SGST: ₹{(parseFloat(item.unit_price||0)*parseInt(item.quantity||1)*parseFloat(item.sgst_percent||0)/100).toFixed(2)} ·
                  IGST: ₹{(parseFloat(item.unit_price||0)*parseInt(item.quantity||1)*parseFloat(item.igst_percent||0)/100).toFixed(2)} ·
                  <strong style={{ color: '#1a1a1a' }}> Item total: ₹{(item.total_amount||0).toFixed(2)}</strong>
                </div>
              </div>
            </div>
          ))}

          <button type="button" className="btn btn-ghost" style={{ width: '100%', marginBottom: 16 }} onClick={addItem}>
            <i className="ti ti-plus" style={{ marginRight: 6 }} /> Add another bill item
          </button>

          <div style={{ background: '#EEEDFE', borderRadius: 8, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, color: '#534AB7' }}>Claim total ({items.length} item{items.length>1?'s':''})</div>
              <div style={{ fontSize: 22, fontWeight: 500, color: '#26215C' }}>₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : 'Review →'}</button>
            </div>
          </div>
        </form>
      )}

      {step === 3 && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">Review before submitting</div>
            <div className="card-body">
              <div className="form-row form-row-3" style={{ marginBottom: 16 }}>
                <div><div style={{ fontSize: 11, color: '#888' }}>Project</div><div style={{ fontWeight: 500, marginTop: 2 }}>{selectedProject?.project_no}</div></div>
                <div><div style={{ fontSize: 11, color: '#888' }}>Funding agency</div><div style={{ fontWeight: 500, marginTop: 2 }}>{selectedProject?.funding_agency}</div></div>
                <div><div style={{ fontSize: 11, color: '#888' }}>Purpose</div><div style={{ fontWeight: 500, marginTop: 2, fontSize: 13 }}>{form.purpose}</div></div>
              </div>
              <table className="table">
                <thead><tr><th>#</th><th>Vendor</th><th>Bill no.</th><th>Date</th><th>Description</th><th style={{textAlign:'right'}}>Amount</th></tr></thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i}>
                      <td>{i+1}</td>
                      <td>{it.vendor_name}</td>
                      <td>{it.bill_no}</td>
                      <td>{it.bill_date}</td>
                      <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.description}</td>
                      <td style={{ textAlign: 'right', fontWeight: 500 }}>₹{parseFloat(it.total_amount).toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr><td colSpan={5} style={{ textAlign:'right', fontWeight:500 }}>Grand total</td><td style={{ textAlign:'right', fontWeight:600, color:'#534AB7' }}>₹{grandTotal.toFixed(2)}</td></tr>
                </tbody>
              </table>
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