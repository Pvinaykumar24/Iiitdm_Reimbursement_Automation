import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { claimsApi } from '../../api';
import { useAuthStore } from '../../store/authStore';

export default function PrintClaim() {
  const { id } = useParams();
  const queryParams = new URLSearchParams(window.location.search);
  const roleParam = queryParams.get('role');
  const isFaculty = roleParam ? roleParam === 'faculty' : (user?.role === 'FACULTY');
  const [claim, setClaim] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    document.body.classList.add('print-route');
    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'auto';

    claimsApi.getById(id)
      .then(res => {
        setClaim(res.data);
      })
      .catch(err => {
        console.error(err);
        setError('Failed to load claim details.');
      })
      .finally(() => setLoading(false));

    return () => {
      document.body.classList.remove('print-route');
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, [id]);

  useEffect(() => {
    if (claim) {
      const timer = setTimeout(() => {
        window.print();
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [claim]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui' }}>
        <div className="spinner" style={{ marginBottom: 12 }} />
        <div style={{ fontSize: '14px', color: '#666' }}>Preparing official print document...</div>
      </div>
    );
  }

  if (error || !claim) {
    return (
      <div style={{ padding: 48, textAlign: 'center', fontFamily: 'system-ui', color: '#c53030' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>Error</h2>
        <p style={{ fontSize: '14px', margin: '8px 0 24px 0' }}>{error || 'Claim not found.'}</p>
        <button className="btn btn-ghost" onClick={() => window.close()} style={{ padding: '8px 16px', border: '1px solid #cbd5e0', borderRadius: 6, cursor: 'pointer' }}>Close Tab</button>
      </div>
    );
  }

  // Group items by invoice for detailed display
  const items = claim.items || [];
  const invoiceGroups = {};
  items.forEach(it => {
    const key = it.bill_no || 'unknown';
    if (!invoiceGroups[key]) {
      invoiceGroups[key] = {
        vendor_name: it.vendor_name,
        bill_no: it.bill_no,
        bill_date: it.bill_date,
        gstin_vendor: it.gstin_vendor,
        cgst_amount: 0,
        sgst_amount: 0,
        igst_amount: 0,
        other_charges: 0,
        base_total: 0,
        grand_total: 0,
        products: []
      };
    }

    const useClassified = !isFaculty && it.sric_cgst !== null && it.sric_cgst !== undefined;
    const base = parseFloat(it.unit_price || 0) * parseInt(it.quantity || 1);
    const cgst = useClassified ? parseFloat(it.sric_cgst) : parseFloat(it.cgst_amount || 0);
    const sgst = useClassified ? parseFloat(it.sric_sgst) : parseFloat(it.sgst_amount || 0);
    const igst = useClassified ? parseFloat(it.sric_igst) : parseFloat(it.igst_amount || 0);
    const other = useClassified ? parseFloat(it.sric_other_charges) : parseFloat(it.other_charges || 0);
    const prodTotal = base + cgst + sgst + igst + other;

    invoiceGroups[key].cgst_amount += cgst;
    invoiceGroups[key].sgst_amount += sgst;
    invoiceGroups[key].igst_amount += igst;
    invoiceGroups[key].other_charges += other;
    invoiceGroups[key].base_total += base;
    invoiceGroups[key].grand_total += prodTotal;

    invoiceGroups[key].products.push({
      ...it,
      base_amount: base,
      cgst,
      sgst,
      igst,
      other,
      prod_total: prodTotal
    });
  });

  const invoicesList = Object.values(invoiceGroups);

  // Compute budget heads summary (only for SRIC/Dean)
  const budgetSummary = {};
  if (!isFaculty) {
    items.forEach(it => {
      const bh = it.budget_head || 'Unclassified';
      const useClassified = it.sric_cgst !== null && it.sric_cgst !== undefined;
      const base = parseFloat(it.unit_price || 0) * parseInt(it.quantity || 1);
      const cgst = useClassified ? parseFloat(it.sric_cgst) : parseFloat(it.cgst_amount || 0);
      const sgst = useClassified ? parseFloat(it.sric_sgst) : parseFloat(it.sgst_amount || 0);
      const igst = useClassified ? parseFloat(it.sric_igst) : parseFloat(it.igst_amount || 0);
      const other = useClassified ? parseFloat(it.sric_other_charges) : parseFloat(it.other_charges || 0);

      budgetSummary[bh] = (budgetSummary[bh] || 0) + (base + cgst + sgst + igst + other);
    });
  }

  const sricApproval = claim.approvals?.find(a => a.stage === 'SRIC_REVIEW');
  const deanApproval = claim.approvals?.find(a => a.stage === 'DEAN_REVIEW');

  return (
    <>
      {/* ── Print Control Bar ── */}
      <div className="print-control-bar">
        <span style={{ fontWeight: '600', fontSize: '14px' }}>Official Claim Print Preview</span>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" onClick={() => window.print()} style={{ background: '#534AB7', color: '#fff', padding: '6px 14px', borderRadius: 6, border: 'none', fontWeight: '500', fontSize: '13px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <i className="ti ti-printer" style={{ marginRight: 6, fontSize: '15px' }} />Print / Save PDF
          </button>
          <button className="btn btn-ghost" onClick={() => window.close()} style={{ background: '#fff', color: '#333', padding: '6px 14px', borderRadius: 6, border: '1px solid #cbd5e0', fontWeight: '500', fontSize: '13px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            Close Preview
          </button>
        </div>
      </div>

      {/* ── Document Container ── */}
      <div className="print-container">
        {/* ── Document Header ── */}
        <div className="print-header">
          <img
            src="/logo.png"
            alt="IIITDM Logo"
            style={{ width: '80px', height: '80px', marginRight: '20px', flexShrink: 0 }}
          />
          <div className="print-header-text">
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 2px 0' }}>भारतीय सूचना प्रौद्योगिकी, अभिकल्पना एवं विनिर्माण संस्थान, कांचीपुरम</h2>
            <h1 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 2px 0', letterSpacing: '0.2px' }}>INDIAN INSTITUTE OF INFORMATION TECHNOLOGY,</h1>
            <h1 style={{ fontSize: '15px', fontWeight: 'bold', margin: '0 0 2px 0', letterSpacing: '0.2px' }}>DESIGN AND MANUFACTURING, KANCHEEPURAM</h1>
            <h3 style={{ fontSize: '12px', fontWeight: '500', margin: '4px 0 0 0', textTransform: 'uppercase' }}>• Dean (SR, IC & CE) Office</h3>
          </div>
        </div>

        <div className="print-divider" />

        {/* ── Document Title ── */}
        <div className="print-title-box">
          REIMBURSEMENT FORM FOR PRINCIPAL INVESTIGATORS - PROJECT
        </div>

        {/* ── Meta Fields Table ── */}
        <table className="print-meta-table">
          <tbody>
            <tr>
              <td className="meta-label">Project Number:</td>
              <td className="meta-val" colSpan="3"><strong style={{ fontSize: '13px' }}>{claim.project_title ? `${claim.project_title} / ${claim.project_agency} / ` : ''}{claim.project_no}</strong></td>
            </tr>
            <tr>
              <td className="meta-label">Claim Number:</td>
              <td className="meta-val"><strong style={{ fontSize: '13px' }}>{claim.claim_no || 'Draft'}</strong></td>
              <td className="meta-label">Date of Submission:</td>
              <td className="meta-val">{claim.submitted_at ? new Date(claim.submitted_at).toLocaleDateString('en-IN') : '—'}</td>
            </tr>
            <tr>
              <td className="meta-label">Name of PI:</td>
              <td className="meta-val">{claim.faculty_name}</td>
              <td className="meta-label">Faculty ID:</td>
              <td className="meta-val">{claim.employee_id || '—'}</td>
            </tr>
            <tr>
              <td className="meta-label">Department:</td>
              <td className="meta-val" colSpan="3">{claim.department || '—'}</td>
            </tr>
            <tr>
              <td className="meta-label">Purpose of Expenditure:</td>
              <td className="meta-val" colSpan="3" style={{ fontSize: '12px', lineHeight: '1.5' }}>{claim.purpose}</td>
            </tr>
          </tbody>
        </table>

        {/* ── Invoice Details Table ── */}
        <h4 className="section-subtitle">1. Itemized Expenditure & Bill Details</h4>
        {invoicesList.map((inv, idx) => (
          <div key={idx} className="print-invoice-section">
            <div className="print-invoice-meta-box">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                <div>Vendor Name: <strong style={{ fontSize: '12px' }}>{inv.vendor_name}</strong></div>
                <div style={{ textAlign: 'right' }}>Invoice No: <strong style={{ fontSize: '12px' }}>{inv.bill_no}</strong></div>
                <div>Vendor GSTIN: <strong style={{ fontSize: '12px' }}>{inv.gstin_vendor || '—'}</strong></div>
                <div style={{ textAlign: 'right' }}>Invoice Date: <strong style={{ fontSize: '12px' }}>{new Date(inv.bill_date).toLocaleDateString('en-IN')}</strong></div>
              </div>
            </div>

            <table className="print-items-table">
<thead>
                <tr style={{ fontSize: isFaculty ? '11px' : '9px' }}>
                  <th style={{ width: '4%' }}>#</th>
                  <th style={{ width: isFaculty ? '60%' : '30%' }}>Description</th>
                  {!isFaculty && <th style={{ width: '15%' }}>Budget Head</th>}
                  <th style={{ width: '8%', textAlign: 'right' }}>Qty</th>
                  <th style={{ width: '8%', textAlign: 'right' }}>Unit Price</th>
                  <th style={{ width: '8%', textAlign: 'right' }}>Base (₹)</th>
                  {!isFaculty && (
                    <>
                      <th style={{ width: '6%', textAlign: 'right' }}>CGST</th>
                      <th style={{ width: '6%', textAlign: 'right' }}>SGST</th>
                      <th style={{ width: '6%', textAlign: 'right' }}>IGST</th>
                      <th style={{ width: '6%', textAlign: 'right' }}>Other</th>
                      <th style={{ width: '8%', textAlign: 'right' }}>Total</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {inv.products.map((p, pIdx) => (
                  <tr key={pIdx} style={{ fontSize: isFaculty ? '11px' : '9px' }}>
                    <td style={{ textAlign: 'center' }}>{pIdx + 1}</td>
                    <td>{p.description}</td>
                    {!isFaculty && <td style={{ textAlign: 'center' }}><span className="print-head-badge">{p.budget_head || '—'}</span></td>}
                    <td style={{ textAlign: 'right' }}>{p.quantity} {p.quantity_unit}</td>
                    <td style={{ textAlign: 'right' }}>₹{parseFloat(p.unit_price || 0).toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹{p.base_amount.toFixed(2)}</td>
                    {!isFaculty && (
                      <>
                        <td style={{ textAlign: 'right' }}>₹{p.cgst.toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>₹{p.sgst.toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>₹{p.igst.toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>₹{p.other.toFixed(2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹{p.prod_total.toFixed(2)}</td>
                      </>
                    )}
                  </tr>
                ))}
                <tr className="invoice-summary-row" style={{ background: '#f7fafc', fontWeight: 'bold' }}>
                  <td colSpan={isFaculty ? 4 : 10} style={{ textAlign: 'right' }}>Sub-total (Base Amount):</td>
                  <td style={{ textAlign: 'right' }}>₹{inv.base_total.toFixed(2)}</td>
                </tr>
                {inv.cgst_amount > 0 && (
                  <tr className="invoice-summary-row" style={{ background: '#fff' }}>
                    <td colSpan={isFaculty ? 4 : 10} style={{ textAlign: 'right', fontWeight: '500' }}>CGST:</td>
                    <td style={{ textAlign: 'right' }}>₹{inv.cgst_amount.toFixed(2)}</td>
                  </tr>
                )}
                {inv.sgst_amount > 0 && (
                  <tr className="invoice-summary-row" style={{ background: '#fff' }}>
                    <td colSpan={isFaculty ? 4 : 10} style={{ textAlign: 'right', fontWeight: '500' }}>SGST:</td>
                    <td style={{ textAlign: 'right' }}>₹{inv.sgst_amount.toFixed(2)}</td>
                  </tr>
                )}
                {inv.igst_amount > 0 && (
                  <tr className="invoice-summary-row" style={{ background: '#fff' }}>
                    <td colSpan={isFaculty ? 4 : 10} style={{ textAlign: 'right', fontWeight: '500' }}>IGST:</td>
                    <td style={{ textAlign: 'right' }}>₹{inv.igst_amount.toFixed(2)}</td>
                  </tr>
                )}
                {inv.other_charges > 0 && (
                  <tr className="invoice-summary-row" style={{ background: '#fff' }}>
                    <td colSpan={isFaculty ? 4 : 10} style={{ textAlign: 'right', fontWeight: '500' }}>Other Charges / Cost:</td>
                    <td style={{ textAlign: 'right' }}>₹{inv.other_charges.toFixed(2)}</td>
                  </tr>
                )}
                <tr className="invoice-summary-row" style={{ background: '#edf2f7', fontWeight: 'bold', borderTop: '1.5px solid #000' }}>
                  <td colSpan={isFaculty ? 4 : 10} style={{ textAlign: 'right', textTransform: 'uppercase' }}>Invoice Grand Total:</td>
                  <td style={{ textAlign: 'right', fontSize: '12px' }}>₹{inv.grand_total.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ))}

        {!isFaculty && (
          <>
            <h4 className="section-subtitle">2. Budget Segregation Summary (Classified by SRIC Cell)</h4>
            <table className="print-budget-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', width: '70%' }}>Budget Head Description</th>
                  <th style={{ textAlign: 'right', width: '30%' }}>Total Classified Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(budgetSummary).map(([bh, amt]) => (
                  <tr key={bh}>
                    <td style={{ fontWeight: '500' }}>{bh}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹{amt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
                <tr style={{ background: '#f7fafc', borderTop: '2px solid #cbd5e0' }}>
                  <td style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>Grand Total Claim Amount:</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '13px' }}>₹{parseFloat(claim.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>
          </>
        )}

        {isFaculty && (
          <>
            <h4 className="section-subtitle">2. Certification & Submission</h4>
            <div style={{ display: 'flex', justifyContent: 'flex-start', margin: '14px 0 20px 0' }}>
              <div className="signature-card" style={{ width: '40%', border: '1px solid #a0aec0', borderRadius: '6px', padding: '10px', background: '#fff' }}>
                <div className="sig-header" style={{ fontWeight: 'bold', fontSize: '11px', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', marginBottom: '8px', color: '#2d3748', textTransform: 'uppercase' }}>Submitted By</div>
                <div className="sig-body" style={{ fontSize: '11px' }}>
                  <p style={{ fontWeight: '600', margin: '0 0 4px 0' }}>{claim.faculty_name}</p>
                  <p style={{ fontSize: '11px', color: '#4a5568', margin: '0 0 16px 0' }}>Principal Investigator (PI)</p>
                  <div className="sig-line" style={{ borderBottom: '1px solid #718096', marginTop: '15px' }} />
                  <p style={{ fontSize: '11px', margin: '6px 0 0 0' }}>Signature of PI / Date</p>
                </div>
              </div>
            </div>
          </>
        )}

        <style>{`
          .print-container {
            width: 210mm;
            min-height: 297mm;
            padding: 12mm 15mm;
            margin: 20px auto;
            background: #fff;
            font-family: 'Times New Roman', Times, serif, system-ui;
            color: #000;
            font-size: 12px;
            line-height: 1.4;
            box-sizing: border-box;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
          }

          .print-header {
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 12px;
          }

          .print-header-text {
            text-align: center;
          }

          .print-divider {
            border-bottom: 2px solid #000;
            margin-bottom: 14px;
          }

          .print-title-box {
            border: 1.5px solid #000;
            padding: 8px;
            text-align: center;
            font-size: 13px;
            font-weight: bold;
            margin-bottom: 16px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .print-meta-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 18px;
          }

          .print-meta-table td {
            padding: 6px 8px;
            border: 1px solid #cbd5e0;
            vertical-align: top;
          }

          .meta-label {
            font-weight: bold;
            width: 18%;
            background: #f7fafc;
            font-size: 11px;
          }

          .meta-val {
            width: 32%;
          }

          .section-subtitle {
            font-size: 12px;
            font-weight: bold;
            margin: 16px 0 8px 0;
            border-bottom: 1px solid #000;
            padding-bottom: 3px;
            text-transform: uppercase;
          }

          .print-invoice-section {
            margin-bottom: 20px;
            page-break-inside: avoid;
          }

          .print-invoice-meta-box {
            border: 1.5px solid #000;
            background: #f8fafc;
            padding: 10px 14px;
            margin-bottom: 10px;
            font-size: 12px;
            line-height: 1.5;
            color: #000;
            border-radius: 4px;
          }

          .print-items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 4px;
          }

          .print-items-table th, .print-items-table td {
            border: 1px solid #718096;
            padding: 6px 8px;
            font-size: 11px;
          }

          .print-items-table th {
            background: #f7fafc;
            font-weight: bold;
            text-align: center;
          }

          .print-head-badge {
            background: #edf2f7;
            border-radius: 4px;
            padding: 2px 5px;
            font-size: 10px;
            font-family: system-ui;
          }

          .invoice-summary-row {
            background: #f7fafc;
            font-weight: bold;
          }

          .print-budget-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            page-break-inside: avoid;
          }

          .print-budget-table th, .print-budget-table td {
            border: 1px solid #718096;
            padding: 8px 10px;
            font-size: 11px;
          }

          .print-budget-table th {
            background: #f7fafc;
            font-weight: bold;
          }

          .print-signatures-grid {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 12px;
            margin-bottom: 18px;
            page-break-inside: avoid;
          }

          .signature-card {
            border: 1px solid #a0aec0;
            border-radius: 6px;
            padding: 10px;
            background: #fff;
          }

          .sig-header {
            font-weight: bold;
            font-size: 11px;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 4px;
            margin-bottom: 8px;
            color: #2d3748;
            text-transform: uppercase;
          }

          .sig-body {
            font-size: 11px;
          }

          .sig-line {
            border-bottom: 1px solid #718096;
            margin-top: 15px;
          }

          .accounts-voucher-box {
            border: 1.5px dashed #4a5568;
            border-radius: 6px;
            padding: 12px;
            background: #fff;
            page-break-inside: avoid;
          }

          .voucher-header {
            font-weight: bold;
            font-size: 11px;
            margin-bottom: 10px;
            text-transform: uppercase;
            color: #1a202c;
            text-align: center;
            letter-spacing: 0.5px;
          }

          .print-control-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #1a202c;
            color: #fff;
            padding: 10px 24px;
            position: sticky;
            top: 0;
            z-index: 1000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            border-bottom: 1px solid #2d3748;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          }

          body.print-route, body.print-route #root {
            height: auto !important;
            min-height: 100vh !important;
            overflow: auto !important;
            background: #f0f4f8;
          }

          .spinner {
            width: 32px;
            height: 32px;
            border: 3px solid #e2e8f0;
            border-top-color: #3182ce;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }

          @keyframes spin {
            to { transform: rotate(360deg); }
          }

          @media print {
            html, body, #root {
              height: auto !important;
              min-height: auto !important;
              overflow: visible !important;
              overflow-y: visible !important;
            }
            .print-control-bar {
              display: none !important;
            }
            body {
              background: #fff;
              margin: 0;
              padding: 0;
            }
            .print-container {
              width: auto;
              min-height: auto;
              padding: 0;
              margin: 0;
              box-shadow: none;
            }
            .btn, header, sidebar, nav {
              display: none !important;
            }
            @page {
              size: A4;
              margin: 15mm 15mm 15mm 15mm;
            }
          }
        `}</style>
      </div>
    </>
  );
}
