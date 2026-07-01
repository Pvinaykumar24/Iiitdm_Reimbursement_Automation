import { useEffect, useState } from 'react';
import { claimsApi } from '../../api';

const BUDGET_HEAD_COLORS = {
  'Consumable':              { bg: '#EAF3DE', color: '#27500A' },
  'Contingency':             { bg: '#FEF4E6', color: '#633806' },
  'Travel':                  { bg: '#E6F0FE', color: '#0C447C' },
  'Equipment':               { bg: '#EEEDFE', color: '#3C3489' },
  'Others':                  { bg: '#f5f5f4', color: '#444' },
  'Accountable Consumable':  { bg: '#FCF0F0', color: '#791F1F' },
  'Unclassified':            { bg: '#f5f5f4', color: '#888' },
};

export default function BudgetClassification() {
  const today = new Date().toISOString().split('T')[0];
  const getFYStart = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = d.getMonth(); // 0-indexed
    const startYear = month >= 3 ? year : year - 1;
    return `${startYear}-04-01`;
  };
  const fyStart = getFYStart();

  const [startDate, setStartDate] = useState(fyStart);
  const [endDate, setEndDate] = useState(today);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    claimsApi.getBudgetSummary({ startDate, endDate })
      .then(res => setData(Array.isArray(res.data) ? res.data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  // Group data by year
  const yearMap = {};
  data.forEach(row => {
    const yr = row.year;
    if (!yearMap[yr]) yearMap[yr] = { total: 0, heads: {} };
    const amt = parseFloat(row.total || 0);
    yearMap[yr].total += amt;
    yearMap[yr].heads[row.budget_head] = (yearMap[yr].heads[row.budget_head] || 0) + amt;
  });

  const years = Object.keys(yearMap).sort((a, b) => b - a);

  return (
    <>
      <h1 className="page-title">Budget Classification</h1>
      <p style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>
        Yearly breakdown of approved claim amounts by budget head. Only Dean-approved and processed claims are included.
      </p>

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
        <button className="btn btn-ghost btn-sm" onClick={() => { setStartDate(fyStart); setEndDate(today); }}
          style={{ fontSize: 11 }}>
          Reset to Financial Year
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto' }} />
        </div>
      ) : years.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <i className="ti ti-report-money" />
            No approved claims found yet.
          </div>
        </div>
      ) : (
        years.map(year => {
          const info = yearMap[year];
          const headEntries = Object.entries(info.heads).sort((a, b) => b[1] - a[1]);

          return (
            <div className="card" key={year} style={{ marginBottom: 20 }}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>
                  <i className="ti ti-calendar" style={{ marginRight: 6 }} />
                  Financial Year {year}
                </span>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#3c3489' }}>
                  ₹{info.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="card-body">
                {/* Horizontal bar visualization */}
                <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 16, background: '#f0f0ee' }}>
                  {headEntries.map(([bh, amt]) => {
                    const pct = info.total > 0 ? (amt / info.total) * 100 : 0;
                    const colors = BUDGET_HEAD_COLORS[bh] || BUDGET_HEAD_COLORS['Others'];
                    return (
                      <div
                        key={bh}
                        title={`${bh}: ₹${amt.toLocaleString('en-IN')} (${pct.toFixed(1)}%)`}
                        style={{ width: `${pct}%`, background: colors.color, minWidth: pct > 0 ? 4 : 0, transition: 'width 0.3s ease' }}
                      />
                    );
                  })}
                </div>

                {/* Budget head cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                  {headEntries.map(([bh, amt]) => {
                    const colors = BUDGET_HEAD_COLORS[bh] || BUDGET_HEAD_COLORS['Others'];
                    const pct = info.total > 0 ? (amt / info.total) * 100 : 0;
                    return (
                      <div
                        key={bh}
                        style={{
                          background: colors.bg,
                          borderRadius: 10,
                          padding: '14px 16px',
                          border: `1px solid ${colors.color}20`,
                        }}
                      >
                        <div style={{ fontSize: 11, color: colors.color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                          {bh}
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: colors.color }}>
                          ₹{amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                        <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                          {pct.toFixed(1)}% of total
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })
      )}
    </>
  );
}
