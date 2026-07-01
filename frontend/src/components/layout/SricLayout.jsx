import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import TopbarNotificationBell from './TopbarNotificationBell';

export default function SricLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div style={{ padding: '14px 18px 16px', borderBottom: '1px solid #e5e5e3', marginBottom: 8 }}>
          <div style={{ fontWeight: 500, fontSize: 13 }}>{user?.name}</div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>SRIC Cell Office</div>
        </div>
        <NavLink to="/sric"         end className={({isActive}) => `sidebar-item${isActive?' active':''}`}><i className="ti ti-layout-dashboard" />Overview</NavLink>
        <NavLink to="/sric/pending"    className={({isActive}) => `sidebar-item${isActive?' active':''}`}><i className="ti ti-clock" />Pending claims</NavLink>
        <NavLink to="/sric/all-claims" className={({isActive}) => `sidebar-item${isActive?' active':''}`}><i className="ti ti-files" />All claims</NavLink>
        <div style={{ marginTop: 'auto', borderTop: '1px solid #e5e5e3', padding: '12px 0' }}>
          <div className="sidebar-item" onClick={handleLogout}><i className="ti ti-logout" />Sign out</div>
        </div>
      </aside>
      <div className="layout-body">
        <header className="topbar" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ flex: 1, fontWeight: 500 }}>IIITDM Reimbursement Portal</span>
          <TopbarNotificationBell />
          <span style={{ fontSize: 12, color: '#888' }}>SRIC Cell Portal</span>
        </header>
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
