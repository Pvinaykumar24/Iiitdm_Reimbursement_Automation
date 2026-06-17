import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { claimsApi } from '../../api';

const STATUS_CONFIG = {
  DEAN_PENDING:  { label: 'Pending',  badgeClass: 'badge-pending',  icon: 'ti-clock' },
  DEAN_APPROVED: { label: 'Approved', badgeClass: 'badge-approved', icon: 'ti-circle-check' },
  DEAN_REJECTED: { label: 'Rejected', badgeClass: 'badge-rejected', icon: 'ti-circle-x' },
  ACCOUNTS_PENDING: { label: 'Approved', badgeClass: 'badge-approved', icon: 'ti-circle-check' },
  PROCESSED:     { label: 'Processed', badgeClass: 'badge-processed', icon: 'ti-circle-check' },
};

const FILTERS = ['ALL', 'PENDING', 'APPROVED', 'REJECTED'];

export default function AllClaims() {
  const [pending, setPending]   = useState([]);
  const [decided, setDecided]   = useState([]);
  const [filter, setFilter]     = useState('ALL');
  const [loading, setLoading]   = useState(true);
  const [fetchError, setFetchError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      claimsApi.getPendingDean(),
      claimsApi.getDecidedDean(),
    ]).then(([p, d]) => {
      setPending(Array.isArray(p.data) ? p.data : []);
      setDecided(Array.isArray(d.data) ? d.data : []);
    }).catch(err => {
      console.error(err);
      setFetchError(err.response?.data?.message || 'Failed to load claims data');
    }).finally(() => setLoading(false));
  }, []);

  const allClaims = [
    ...pending.map(c => ({ ...c, _tab: 'PENDING', _sortDate: c.submitted_at })),
    ...decided.map(c => ({
      ...c,
      _tab: (c.status === 'DEAN_REJECTED') ? 'REJECTED' : 'APPROVED',
      _sortDate: c.decided_at || c.submitted_at,
    })),
  ].sort((a, b) => new Date(b._sortDate || 0) - new Date(a._sortDate || 0));

  const filtered = filter === 'ALL'
    ? allClaims
    : allClaims.filter(c => c._tab === filter);

  const counts = {
    ALL:      allClaims.length,
    PENDING:  allClaims.filter(c => c._tab === 'PENDING').length,
    APPROVED: allClaims.filter(c => c._tab === 'APPROVED').length,
    REJECTED: allClaims.filter(c => c._tab === 'REJECTED').length,
  };

  const filterMeta = {
    ALL:      { icon: 'ti-list',         color: '#534AB7' },
    PENDING:  { icon: 'ti-clock',        color: '#633806' },
    APPROVED: { icon: 'ti-circle-check', color: '#27500A' },
    REJECTED: { icon: 'ti-circle-x',     color: '#791F1F' },
  };

  return (
    <>
      <h1 className="page-title">All Claims</h1>

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
        ) : filtered.length === 0 ? (
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
                <th>Amount</th>
                <th>Submitted</th>
                <th>Status</th>
                <th>Decision</th>
                <th>Remarks</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const cfg = STATUS_CONFIG[c.status] || { label: c.status, badgeClass: 'badge-draft', icon: 'ti-file' };
                return (
                  <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/dean/claims/${c.id}`)}>
                    <td style={{ color: '#534AB7', fontWeight: 500 }}>{c.claim_no}</td>
                    <td>
                      {c.faculty_name}
                      <br />
                      <span style={{ fontSize: 11, color: '#888' }}>{c.department}</span>
                    </td>
                    <td style={{ fontSize: 12, color: '#888' }}>{c.department}</td>
                    <td style={{ fontSize: 12 }}>{c.funding_agency}</td>
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
                    <td style={{ fontSize: 12, color: '#888' }}>
                      {c.decided_at ? new Date(c.decided_at).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td style={{ fontSize: 12, color: '#555', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.dean_remarks || '—'}
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
