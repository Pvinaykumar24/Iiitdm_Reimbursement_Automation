import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { claimsApi } from '../../api';

const STATUS_CONFIG = {
  DRAFT:            { label: 'Draft',            badgeClass: 'badge-draft',     icon: 'ti-file' },
  SRIC_PENDING:     { label: 'Pending SRIC',     badgeClass: 'badge-pending',   icon: 'ti-clock' },
  SRIC_REJECTED:    { label: 'Rejected by SRIC', badgeClass: 'badge-rejected',  icon: 'ti-circle-x' },
  SRIC_VERIFIED:    { label: 'SRIC Recommended & Forwarded to Dean', badgeClass: 'badge-approved',  icon: 'ti-circle-check' },
  DEAN_PENDING:     { label: 'Pending Dean',     badgeClass: 'badge-pending',   icon: 'ti-clock' },
  DEAN_REJECTED:    { label: 'Rejected by Dean', badgeClass: 'badge-rejected',  icon: 'ti-circle-x' },
  DEAN_FORWARDED:   { label: 'Approved by Dean', badgeClass: 'badge-approved',  icon: 'ti-circle-check' },
  ACCOUNTS_PENDING: { label: 'Accounts',         badgeClass: 'badge-accounts',  icon: 'ti-wallet' },
  PROCESSED:        { label: 'Processed',        badgeClass: 'badge-processed', icon: 'ti-discount-check' },
};

const FILTERS = ['ALL', 'PENDING', 'APPROVED', 'REJECTED'];

export default function DeanAllClaims() {
  const [claims, setClaims] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const navigate = useNavigate();

  const today = new Date().toISOString().split('T')[0];
  const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(oneMonthAgo);
  const [endDate, setEndDate] = useState(today);

  const fetchClaims = useCallback((query = '', sd, ed) => {
    setLoading(true);
    claimsApi.getAllClaims({ search: query, startDate: sd, endDate: ed })
      .then(res => {
        setClaims(Array.isArray(res.data) ? res.data : []);
      })
      .catch(err => {
        console.error(err);
        setFetchError(err.response?.data?.message || 'Failed to load claims');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchClaims(search, startDate, endDate);
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [search, startDate, endDate, fetchClaims]);

  const getClaimTab = (status) => {
    if (status === 'DEAN_PENDING') return 'PENDING';
    if (['DEAN_FORWARDED', 'PROCESSED'].includes(status)) return 'APPROVED';
    if (['DEAN_REJECTED', 'SRIC_PENDING', 'SRIC_REJECTED'].includes(status)) return 'REJECTED';
    return 'ALL';
  };

  const filteredClaims = claims.filter(c => {
    if (filter === 'ALL') return true;
    return getClaimTab(c.status) === filter;
  });

  const counts = {
    ALL:      claims.length,
    PENDING:  claims.filter(c => getClaimTab(c.status) === 'PENDING').length,
    APPROVED: claims.filter(c => getClaimTab(c.status) === 'APPROVED').length,
    REJECTED: claims.filter(c => getClaimTab(c.status) === 'REJECTED').length,
  };

  const filterMeta = {
    ALL:      { icon: 'ti-files',        color: '#744FC6' },
    PENDING:  { icon: 'ti-clock',        color: '#633806' },
    APPROVED: { icon: 'ti-circle-check', color: '#27500A' },
    REJECTED: { icon: 'ti-circle-x',     color: '#791F1F' },
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 16 }}>
        <h1 className="page-title" style={{ margin: 0 }}>All Claims</h1>
        <div style={{ position: 'relative', width: 320 }}>
          <i className="ti ti-search" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 16 }} />
          <input
            type="text"
            placeholder="Search claim no, faculty, ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 40, height: 42, fontSize: 14 }}
          />
        </div>
      </div>

      {/* Date Range Filters */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 24, fontSize: 14, flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
          <i className="ti ti-calendar-event" style={{ marginRight: 6 }} />Filter by Date:
        </span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>From</span>
          <input type="date" value={startDate} max={today} onChange={e => setStartDate(e.target.value)}
            style={{ padding: '6px 12px', border: '1.5px solid var(--neutral-taupe)', borderRadius: 6, fontSize: 13, background: 'var(--bg-white)', width: 'auto', height: 36 }} />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>To</span>
          <input type="date" value={endDate} max={today} onChange={e => setEndDate(e.target.value)}
            style={{ padding: '6px 12px', border: '1.5px solid var(--neutral-taupe)', borderRadius: 6, fontSize: 13, background: 'var(--bg-white)', width: 'auto', height: 36 }} />
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => { setStartDate(oneMonthAgo); setEndDate(today); }}
          style={{ height: 36, padding: '0 12px' }}>
          Reset
        </button>
      </div>

      {fetchError && (
        <div className="alert alert-error" style={{ marginBottom: 20 }}>
          <i className="ti ti-alert-circle" /> {fetchError}
        </div>
      )}

      {/* Summary stat cards */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        {FILTERS.map(f => {
          const isActive = filter === f;
          const bg = isActive 
            ? (f === 'ALL' ? 'var(--purple-light)' : f === 'PENDING' ? 'var(--orange-light)' : f === 'APPROVED' ? '#f0fdf4' : '#fef2f2') 
            : 'var(--bg-white)';
          const border = isActive ? `2px solid ${filterMeta[f].color}` : '2.5px solid var(--border-light)';
          
          return (
            <div
              key={f}
              className="stat-card"
              onClick={() => setFilter(f)}
              style={{
                cursor: 'pointer',
                border: border,
                background: bg,
                transition: 'all 0.15s',
                borderRadius: 12,
                padding: '16px 20px'
              }}
            >
              <div className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontWeight: 700 }}>
                <i className={`ti ${filterMeta[f].icon}`} style={{ color: filterMeta[f].color, fontSize: 15 }} />
                {f}
              </div>
              <div className="stat-value" style={{ color: filterMeta[f].color, marginTop: 4, fontFamily: "'Outfit', sans-serif" }}>{counts[f]}</div>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto' }} />
          </div>
        ) : filteredClaims.length === 0 ? (
          <div className="empty-state">
            <i className={`ti ${filterMeta[filter].icon}`} style={{ fontSize: 48, color: 'var(--text-muted)' }} />
            <p style={{ fontWeight: 600, fontSize: 15, marginTop: 12 }}>No {filter === 'ALL' ? '' : filter.toLowerCase() + ' '}claims found.</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th style={{ padding: '16px 24px' }}>Claim no.</th>
                <th>Faculty</th>
                <th>Project</th>
                <th>Amount</th>
                <th>Submitted</th>
                <th>Status</th>
                <th style={{ textAlign: 'right', paddingRight: 24 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClaims.map(c => {
                const cfg = STATUS_CONFIG[c.status] || { label: c.status, badgeClass: 'badge-draft', icon: 'ti-file' };
                const canPrint = c.status !== 'DRAFT' && c.status !== 'SRIC_PENDING';
                return (
                  <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/dean/claims/${c.id}`)}>
                    <td style={{ color: 'var(--primary-purple)', fontWeight: 700, padding: '18px 24px' }}>{c.claim_no}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ color: 'var(--primary-purple)', cursor: 'pointer', fontWeight: 700 }} onClick={e => { e.stopPropagation(); navigate(`/dean/faculty/${c.faculty_id}`); }}>
                          {c.faculty_name}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>ID: {c.employee_id || '—'}</span>
                      </div>
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--secondary-indigo)' }}>{c.project_no || '—'}</td>
                    <td style={{ fontWeight: 700, color: 'var(--text-dark)' }}>₹{parseFloat(c.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td style={{ fontWeight: 500, color: 'var(--text-muted)' }}>
                      {c.submitted_at ? new Date(c.submitted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td>
                      <span className={`badge ${cfg.badgeClass}`}>
                        <i className={`ti ${cfg.icon}`} style={{ marginRight: 6, fontSize: 13 }} />
                        {cfg.label}
                      </span>
                    </td>
                    <td onClick={e => e.stopPropagation()} style={{ textAlign: 'right', paddingRight: 24 }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ height: 32, padding: '0 12px' }}
                          onClick={e => { e.stopPropagation(); navigate(`/dean/claims/${c.id}`); }}
                        >
                          View
                        </button>
                        {canPrint && (
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '0 8px', height: 32 }}
                            title="Print Claim"
                            onClick={e => {
                              e.stopPropagation();
                              window.open(`/claims/${c.id}/print?role=dean`, '_blank');
                            }}
                          >
                            <i className="ti ti-printer" style={{ fontSize: 15 }} />
                          </button>
                        )}
                      </div>
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
