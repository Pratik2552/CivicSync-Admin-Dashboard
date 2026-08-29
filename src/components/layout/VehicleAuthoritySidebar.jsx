import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Truck,
  User,
  LogOut,
  X
} from 'lucide-react';
import './Sidebar.css';

const NAV_ITEMS = [
  { to: '/vehicle-authority/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/vehicle-authority/vehicles',  icon: Truck,            label: 'My Vehicles' },
  { to: '/vehicle-authority/profile',   icon: User,             label: 'Profile' },
];

export default function VehicleAuthoritySidebar({ isOpen, onClose }) {
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
    if (onClose) onClose();
    navigate('/vehicle-authority/login');
  }

  const handleLinkClick = () => {
    if (onClose) {
      onClose();
    }
  };

  const displayName = user?.full_name || user?.name || user?.email || 'Authority User';
  const avatarChar = displayName.charAt(0).toUpperCase();
  const displayRole = 'Vehicle Authority';

  return (
    <aside className={`sidebar ${isOpen ? 'mobile-open' : ''}`}>
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="sidebar-logo">
          <Truck size={22} />
        </div>
        <div className="sidebar-brand-text">
          <span className="sidebar-brand-name">CivicSync</span>
          <span className="sidebar-brand-sub">Vehicle Authority</span>
        </div>
        {onClose && (
          <button className="sidebar-close-btn" onClick={onClose} aria-label="Close menu">
            <X size={20} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Fleet Management</div>
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={handleLinkClick}
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
