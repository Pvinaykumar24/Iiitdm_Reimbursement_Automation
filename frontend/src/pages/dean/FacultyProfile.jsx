import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { claimsApi } from '../../api';

const STATUS_CONFIG = {
  DRAFT:            { label: 'Draft',            badgeClass: 'badge-draft',     icon: 'ti-file' },
  SRIC_PENDING:     { label: 'Pending SRIC',     badgeClass: 'badge-pending',   icon: 'ti-clock' },
  SRIC_REJECTED:    { label: 'Rejected by SRIC', badgeClass: 'badge-rejected',  icon: 'ti-circle-x' },
  SRIC_VERIFIED:    { label: 'Verified by SRIC', badgeClass: 'badge-approved',  icon: 'ti-circle-check' },
  DEAN_PENDING:     { label: 'Pending Dean',     badgeClass: 'badge-pending',   icon: 'ti-clock' },
  DEAN_REJECTED:    { label: 'Rejected by Dean', badgeClass: 'badge-rejected',  icon: 'ti-circle-x' },
  DEAN_FORWARDED:   { label: 'Approved by Dean', badgeClass: 'badge-approved',  icon: 'ti-circle-check' },
  ACCOUNTS_PENDING: { label: 'Accounts',         badgeClass: 'badge-accounts',  icon: 'ti-wallet' },
  PROCESSED:        { label: 'Processed',        badgeClass: 'badge-processed', icon: 'ti-discount-check' },
};

export default function DeanFacultyProfileView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    claimsApi.getFacultyProfile(id)
      .then(res => setData(res.data))
      .catch(err => {
        console.error(err);
        setError(err.response?.data?.message || 'Failed to load faculty profile');
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={{ padding: 32, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>;
  if (error) return <div className="alert alert-error">{error}</div>;
  if (!data) return <div className="alert alert-error">Faculty profile not found.</div>;

  const { profile, claims } = data;
  const totalAmount = claims.reduce((s, c) => s + parseFloat(c.total_amount || 0), 0);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}><i className="ti ti-arrow-left" /></button>
        <h1 className="page-title" style={{ margin: 0 }}>Faculty Profile: {profile.name}</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Profile Card */}
        <div className="card">
          <div className="card-header">Employee Details</div>
          <div className="card-body">
            <div className="form-row form-row-2" style={{ gap: '16px 24px' }}>
              <div>
                <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Full Name</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 3 }}>{profile.name}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Employee ID</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 3 }}>{profile.employee_id || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Department</div>
                <div style={{ fontSize: 14, fontWeight: 500, marginTop: 3 }}>{profile.department || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Designation</div>
                <div style={{ fontSize: 14, fontWeight: 500, marginTop: 3 }}>{profile.designation || 'Faculty Member'}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Email Address</div>
                <div style={{ fontSize: 14, marginTop: 3 }}>{profile.email}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Phone Number</div>
                <div style={{ fontSize: 14, marginTop: 3 }}>{profile.phone || '—'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Claim Stats Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">Claims Summary</div>
          <div className="card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: '#888' }}>Total Claims Submitted</div>
              <div style={{ fontSize: 24, fontWeight: 600, color: '#534AB7', marginTop: 4 }}>{claims.length}</div>
            </div>
            <div style={{ borderTop: '1px solid #f0f0ee' }} />
            <div>
              <div style={{ fontSize: 11, color: '#888' }}>Total Amount Claimed</div>
              <div style={{ fontSize: 24, fontWeight: 600, color: '#27500A', marginTop: 4 }}>₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">All Submitted Claims ({claims.length})</div>
        {claims.length === 0 ? (
          <div className="empty-state">
            <i className="ti ti-file-off" />
            No claims submitted by this faculty member.
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Claim no.</th>
                <th>Project</th>
                <th>Purpose</th>
                <th>Amount</th>
                <th>Submitted</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {claims.map(c => {
                const cfg = STATUS_CONFIG[c.status] || { label: c.status, badgeClass: 'badge-draft', icon: 'ti-file' };
                return (
                  <tr key={c.id}>
                    <td style={{ color: '#534AB7', fontWeight: 500 }}>{c.claim_no}</td>
                    <td style={{ fontSize: 12 }}>{c.project_no || '—'}</td>
                    <td style={{ fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.purpose}</td>
                    <td style={{ fontWeight: 500 }}>₹{parseFloat(c.total_amount || 0).toLocaleString('en-IN')}</td>
                    <td style={{ fontSize: 12, color: '#888' }}>
                      {c.submitted_at ? new Date(c.submitted_at).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td>
                      <span className={`badge ${cfg.badgeClass}`}>
                        <i className={`ti ${cfg.icon}`} style={{ marginRight: 4, fontSize: 11 }} />
                        {cfg.label}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => navigate(`/dean/claims/${c.id}`)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
