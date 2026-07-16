import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import TopbarNotificationBell from './TopbarNotificationBell';

export default function FacultyLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-profile">
          <div className="sidebar-profile-name">{user?.name}</div>
          <div className="sidebar-profile-sub">Faculty · {user?.department || 'IIITDM'}</div>
        </div>
        <NavLink to="/faculty"            end className={({isActive}) => `sidebar-item${isActive?' active':''}`}><i className="ti ti-layout-dashboard" />Dashboard</NavLink>
        <NavLink to="/faculty/claims/new"     className={({isActive}) => `sidebar-item${isActive?' active':''}`}><i className="ti ti-plus" />New claim</NavLink>
        <NavLink to="/faculty/claims"         className={({isActive}) => `sidebar-item${isActive?' active':''}`}><i className="ti ti-file-text" />My claims</NavLink>
        <NavLink to="/faculty/profile"        className={({isActive}) => `sidebar-item${isActive?' active':''}`}><i className="ti ti-user" />Profile</NavLink>
        <div className="sidebar-logout-container">
          <div className="sidebar-item" onClick={handleLogout}><i className="ti ti-logout" />Sign out</div>
        </div>
      </aside>
      <div className="layout-body">
        <header className="topbar">
          <span className="topbar-title">IIITDM Reimbursement Portal</span>
          <TopbarNotificationBell />
          <span className="topbar-role">Faculty Portal</span>
        </header>
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}