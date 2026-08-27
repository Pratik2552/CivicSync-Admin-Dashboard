import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Truck,
  User,
  LogOut,
  Settings
} from 'lucide-react';
import './Sidebar.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const NAV_ITEMS = [
  { to: '/vehicle-authority/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/vehicle-authority/vehicles',  icon: Truck,            label: 'My Vehicles' },
  { to: '/vehicle-authority/profile',   icon: User,             label: 'Profile' },
];

export default function VehicleAuthoritySidebar() {
  const navigate = useNavigate();
  
  // Get user from localStorage
  const getAuthUser = () => {
    try {
      const userStr = localStorage.getItem('civicsync_authority_user');
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  };

  const user = getAuthUser();

  function handleLogout() {
    localStorage.removeItem('civicsync_authority_token');
    localStorage.removeItem('civicsync_authority_user');
    navigate('/vehicle-authority/login');
  }

  const displayName = user?.full_name || user?.name || user?.email || 'Authority User';
  const avatarChar = displayName.charAt(0).toUpperCase();
  const displayRole = 'Vehicle Authority';

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="sidebar-logo">
          <Truck size={22} />
        </div>
        <div className="sidebar-brand-text">
          <span className="sidebar-brand-name">CivicSync</span>
          <span className="sidebar-brand-sub">Vehicle Authority</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Fleet Management</div>
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          >
            <Icon size={17} className="sidebar-icon" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User + Logout */}
      <div className="sidebar-footer">
        {user && (
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">
              {avatarChar}
            </div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{displayName}</span>
              <span className="sidebar-user-role">{displayRole}</span>
            </div>
          </div>
        )}
        <button className="sidebar-logout" onClick={handleLogout}>
          <LogOut size={15} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
