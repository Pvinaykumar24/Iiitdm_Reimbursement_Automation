import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import TopbarNotificationBell from './TopbarNotificationBell';

export default function DeanLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div style={{ padding: '16px 24px', borderBottom: '1.5px solid #d5d3d0', marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{user?.name}</div>
          <div style={{ fontSize: 13, color: '#475569', marginTop: 4, fontWeight: 600 }}>Dean SR & IC&CE Office</div>
        </div>
        <NavLink to="/dean"         end className={({isActive}) => `sidebar-item${isActive?' active':''}`}><i className="ti ti-layout-dashboard" />Overview</NavLink>
        <NavLink to="/dean/pending"    className={({isActive}) => `sidebar-item${isActive?' active':''}`}><i className="ti ti-clock" />Pending claims</NavLink>
        <NavLink to="/dean/all-claims" className={({isActive}) => `sidebar-item${isActive?' active':''}`}><i className="ti ti-files" />All claims</NavLink>
        <NavLink to="/dean/budget"     className={({isActive}) => `sidebar-item${isActive?' active':''}`}><i className="ti ti-report-money" />Budget Classification</NavLink>
        <div style={{ marginTop: 'auto', borderTop: '1.5px solid #d5d3d0', padding: '12px 0' }}>
          <div className="sidebar-item" onClick={handleLogout}><i className="ti ti-logout" />Sign out</div>
        </div>
      </aside>
      <div className="layout-body">
        <header className="topbar" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ flex: 1, fontWeight: 500 }}>IIITDM Reimbursement Portal</span>
          <TopbarNotificationBell />
          <span style={{ fontSize: 12, color: '#888' }}>Dean SR Office</span>
        </header>
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}