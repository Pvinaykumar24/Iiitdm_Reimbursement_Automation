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
        <div className="sidebar-profile">
          <div className="sidebar-profile-name">{user?.name}</div>
          <div className="sidebar-profile-sub">SRIC Cell Office</div>
        </div>
        <NavLink to="/sric"         end className={({isActive}) => `sidebar-item${isActive?' active':''}`}><i className="ti ti-layout-dashboard" />Overview</NavLink>
        <NavLink to="/sric/pending"    className={({isActive}) => `sidebar-item${isActive?' active':''}`}><i className="ti ti-clock" />Pending claims</NavLink>
        <NavLink to="/sric/all-claims" className={({isActive}) => `sidebar-item${isActive?' active':''}`}><i className="ti ti-files" />All claims</NavLink>
        <NavLink to="/sric/budget"     className={({isActive}) => `sidebar-item${isActive?' active':''}`}><i className="ti ti-report-money" />Budget Classification</NavLink>
        <NavLink to="/sric/projects"   className={({isActive}) => `sidebar-item${isActive?' active':''}`}><i className="ti ti-folder" />Manage Projects</NavLink>
        <div className="sidebar-logout-container">
          <div className="sidebar-item" onClick={handleLogout}><i className="ti ti-logout" />Sign out</div>
        </div>
      </aside>
      <div className="layout-body">
        <header className="topbar">
          <span className="topbar-title">IIITDM Reimbursement Portal</span>
          <TopbarNotificationBell />
          <span className="topbar-role">SRIC Cell Portal</span>
        </header>
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
