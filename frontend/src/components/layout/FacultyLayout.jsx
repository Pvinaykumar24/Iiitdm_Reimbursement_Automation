import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export default function FacultyLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div style={{ padding: '14px 18px 16px', borderBottom: '1px solid #e5e5e3', marginBottom: 8 }}>
          <div style={{ fontWeight: 500, fontSize: 13 }}>{user?.name}</div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Faculty · {user?.department || 'IIITDM'}</div>
        </div>
        <NavLink to="/faculty"            end className={({isActive}) => `sidebar-item${isActive?' active':''}`}><i className="ti ti-layout-dashboard" />Dashboard</NavLink>
        <NavLink to="/faculty/claims/new"     className={({isActive}) => `sidebar-item${isActive?' active':''}`}><i className="ti ti-plus" />New claim</NavLink>
        <NavLink to="/faculty/claims"         className={({isActive}) => `sidebar-item${isActive?' active':''}`}><i className="ti ti-file-text" />My claims</NavLink>
        <div style={{ marginTop: 'auto', borderTop: '1px solid #e5e5e3', padding: '12px 0' }}>
          <div className="sidebar-item" onClick={handleLogout}><i className="ti ti-logout" />Sign out</div>
        </div>
      </aside>
      <div className="layout-body">
        <header className="topbar">
          <span style={{ flex: 1, fontWeight: 500 }}>IIITDM Reimbursement Portal</span>
          <span style={{ fontSize: 12, color: '#888' }}>Faculty Portal</span>
        </header>
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}