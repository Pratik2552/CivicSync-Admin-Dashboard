import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Route,
  Truck,
  Container,
  MessageSquareWarning,
  LogOut,
  Building2,
  ChevronRight,
} from 'lucide-react'
import { logout, getAuthUser } from '../../services/api.js'
import './Sidebar.css'

const NAV_ITEMS = [
  { to: '/admin/dashboard',       icon: LayoutDashboard,      label: 'Dashboard' },
  { to: '/admin/route-optimizer', icon: Route,                label: 'Route Optimizer' },
  { to: '/admin/drivers',         icon: Truck,                label: 'Drivers & Fleet' },
  { to: '/admin/bins',            icon: Container,            label: 'Bins' },
  { to: '/admin/grievances',      icon: MessageSquareWarning, label: 'Grievances' },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const user = getAuthUser()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="sidebar-logo">
          <Building2 size={22} />
        </div>
        <div className="sidebar-brand-text">
          <span className="sidebar-brand-name">CivicSync</span>
          <span className="sidebar-brand-sub">Municipal Admin</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Operations</div>
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
              {user.name?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{user.name}</span>
              <span className="sidebar-user-role">{user.role}</span>
            </div>
          </div>
        )}
        <button className="sidebar-logout" onClick={handleLogout}>
          <LogOut size={15} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
