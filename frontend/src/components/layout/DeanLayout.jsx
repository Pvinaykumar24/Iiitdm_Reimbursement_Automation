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
        <div className="sidebar-profile">
          <div className="sidebar-profile-name">{user?.name}</div>
          <div className="sidebar-profile-sub">Dean SR & IC&CE Office</div>
        </div>
        <NavLink to="/dean"         end className={({isActive}) => `sidebar-item${isActive?' active':''}`}><i className="ti ti-layout-dashboard" />Overview</NavLink>
        <NavLink to="/dean/pending"    className={({isActive}) => `sidebar-item${isActive?' active':''}`}><i className="ti ti-clock" />Pending claims</NavLink>
        <NavLink to="/dean/all-claims" className={({isActive}) => `sidebar-item${isActive?' active':''}`}><i className="ti ti-files" />All claims</NavLink>
        <NavLink to="/dean/budget"     className={({isActive}) => `sidebar-item${isActive?' active':''}`}><i className="ti ti-report-money" />Budget Classification</NavLink>
        <div className="sidebar-logout-container">
          <div className="sidebar-item" onClick={handleLogout}><i className="ti ti-logout" />Sign out</div>
        </div>
      </aside>
      <div className="layout-body">
        <header className="topbar">
          <span className="topbar-title">IIITDM Reimbursement Portal</span>
          <TopbarNotificationBell />
          <span className="topbar-role">Dean SR Office</span>
        </header>
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}