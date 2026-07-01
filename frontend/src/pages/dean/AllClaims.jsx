import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
    ALL:      { icon: 'ti-files',        color: '#3C3489' },
    PENDING:  { icon: 'ti-clock',        color: '#633806' },
    APPROVED: { icon: 'ti-circle-check', color: '#27500A' },
    REJECTED: { icon: 'ti-circle-x',     color: '#791F1F' },
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h1 className="page-title" style={{ margin: 0 }}>All Claims</h1>
        <div style={{ position: 'relative', width: 320 }}>
          <i className="ti ti-search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
          <input
            type="text"
            placeholder="Search claim no, faculty, ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 34, background: '#fff', border: '1px solid #d4d4d0' }}
          />
        </div>
      </div>

      {/* Date Range Filters */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, fontSize: 13 }}>
        <span style={{ color: '#888', fontWeight: 500 }}>
          <i className="ti ti-calendar-event" style={{ marginRight: 4 }} />From
        </span>
        <input type="date" value={startDate} max={today} onChange={e => setStartDate(e.target.value)}
          style={{ padding: '6px 10px', border: '1px solid #d4d4d0', borderRadius: 6, fontSize: 12, background: '#fff' }} />
        <span style={{ color: '#888', fontWeight: 500 }}>To</span>
        <input type="date" value={endDate} max={today} onChange={e => setEndDate(e.target.value)}
          style={{ padding: '6px 10px', border: '1px solid #d4d4d0', borderRadius: 6, fontSize: 12, background: '#fff' }} />
        <button className="btn btn-ghost btn-sm" onClick={() => { setStartDate(oneMonthAgo); setEndDate(today); }}
          style={{ fontSize: 11 }}>
          Reset to 1 month
        </button>
      </div>

      {fetchError && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          <i className="ti ti-alert-circle" /> {fetchError}
        </div>
      )}

      {/* Summary stat cards */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 20 }}>
        {FILTERS.map(f => (
          <div
            key={f}
            className="stat-card"
            onClick={() => setFilter(f)}
            style={{
              cursor: 'pointer',
              border: filter === f ? `2px solid ${filterMeta[f].color}` : '2px solid transparent',
              background: filter === f ? (f === 'ALL' ? '#EEEDFE' : f === 'PENDING' ? '#FAEEDA' : f === 'APPROVED' ? '#EAF3DE' : '#FCEBEB') : '#fafaf9',
              transition: 'all 0.15s',
              borderRadius: 10,
            }}
          >
            <div className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className={`ti ${filterMeta[f].icon}`} style={{ color: filterMeta[f].color, fontSize: 14 }} />
              {f.charAt(0) + f.slice(1).toLowerCase()}
            </div>
            <div className="stat-value" style={{ color: filterMeta[f].color }}>{counts[f]}</div>
          </div>
        ))}
      </div>

      {/* Filter tab pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '5px 16px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              border: 'none',
              background: filter === f ? filterMeta[f].color : '#e5e5e3',
              color: filter === f ? '#fff' : '#666',
              transition: 'all 0.15s',
            }}
          >
            <i className={`ti ${filterMeta[f].icon}`} style={{ marginRight: 5 }} />
            {f.charAt(0) + f.slice(1).toLowerCase()} ({counts[f]})
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto' }} />
          </div>
        ) : filteredClaims.length === 0 ? (
          <div className="empty-state">
            <i className={`ti ${filterMeta[filter].icon}`} />
            No {filter === 'ALL' ? '' : filter.toLowerCase() + ' '}claims found.
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Claim no.</th>
                <th>Faculty</th>
                <th>Faculty ID</th>
                <th>Project</th>
                <th>Purpose</th>
                <th>Amount</th>
                <th>Submitted</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredClaims.map(c => {
                const cfg = STATUS_CONFIG[c.status] || { label: c.status, badgeClass: 'badge-draft', icon: 'ti-file' };
                return (
                  <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/dean/claims/${c.id}`)}>
                    <td style={{ color: '#534AB7', fontWeight: 500 }}>{c.claim_no}</td>
                    <td>
                      <span style={{ color: '#534AB7', cursor: 'pointer', fontWeight: 500 }} onClick={e => { e.stopPropagation(); navigate(`/dean/faculty/${c.faculty_id}`); }}>
                        {c.faculty_name}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: '#888' }}>{c.employee_id || '—'}</td>
                    <td style={{ fontSize: 12 }}>{c.project_no || '—'}</td>
                    <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>
                      {c.purpose}
                    </td>
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
                        onClick={e => { e.stopPropagation(); navigate(`/dean/claims/${c.id}`); }}
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
