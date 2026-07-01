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

export default function SricAllClaims() {
  const [claims, setClaims] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const navigate = useNavigate();

  const fetchClaims = useCallback((query = '') => {
    setLoading(true);
    claimsApi.getAllClaims({ search: query })
      .then(res => {
        setClaims(Array.isArray(res.data) ? res.data : []);
      })
      .catch(err => {
        console.error(err);
        setFetchError(err.response?.data?.message || 'Failed to load claims');
      })
      .finally(() => setLoading(false));
  }, []);

  // Simple debounce helper
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchClaims(search);
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [search, fetchClaims]);

  const getClaimTab = (status) => {
    if (['SRIC_PENDING', 'DEAN_PENDING', 'ACCOUNTS_PENDING'].includes(status)) return 'PENDING';
    if (['SRIC_VERIFIED', 'DEAN_FORWARDED', 'PROCESSED'].includes(status)) return 'APPROVED';
    if (['SRIC_REJECTED', 'DEAN_REJECTED'].includes(status)) return 'REJECTED';
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
    ALL:      { icon: 'ti-list',         color: '#534AB7' },
    PENDING:  { icon: 'ti-clock',        color: '#633806' },
    APPROVED: { icon: 'ti-circle-check', color: '#27500A' },
    REJECTED: { icon: 'ti-circle-x',     color: '#791F1F' },
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: 0 }}>All Claims Database</h1>
        <div style={{ position: 'relative', width: 320 }}>
          <i className="ti ti-search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
          <input
            type="text"
            placeholder="Search claims, faculty name, dept..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 34, background: '#fff', border: '1px solid #d4d4d0' }}
          />
        </div>
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
                <th>Dept</th>
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
                  <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/sric/claims/${c.id}`)}>
                    <td style={{ color: '#534AB7', fontWeight: 500 }}>{c.claim_no}</td>
                    <td>
                      <span style={{ color: '#534AB7', cursor: 'pointer', fontWeight: 500 }} onClick={e => { e.stopPropagation(); navigate(`/sric/faculty/${c.faculty_id}`); }}>
                        {c.faculty_name}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: '#888' }}>{c.department || '—'}</td>
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
                        onClick={e => { e.stopPropagation(); navigate(`/sric/claims/${c.id}`); }}
                      >
                        Verify
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
