import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Route,
  Truck,
  Container,
  MessageSquareWarning,
  LogOut,
  Building2,
  CreditCard,
  Car,
  Users,
  ShieldAlert,
  BarChart2
} from 'lucide-react'
import { logout, getAuthUser } from '../../services/api.js'
import './Sidebar.css'

const NAV_ITEMS = [
  { to: '/admin/dashboard',              icon: LayoutDashboard,      label: 'Dashboard' },
  { to: '/admin/route-optimizer',        icon: Route,                label: 'Route Optimizer' },
  { to: '/admin/drivers',                icon: Truck,                label: 'Drivers & Fleet' },
  { to: '/admin/vehicle-profiles',       icon: Car,                 label: 'Vehicle Profiles' },
  { to: '/admin/bins',                   icon: Container,            label: 'Bins' },
  { to: '/admin/grievances',             icon: MessageSquareWarning, label: 'Grievances' },
  { to: '/admin/dead-animal-complaints', icon: ShieldAlert,          label: 'Dead Animal Alerts' },
  { to: '/admin/operational-cost',        icon: BarChart2,             label: 'Operational Costs' },
  { to: '/admin/carbon-cards',           icon: CreditCard,           label: 'Carbon Cards' },
  { to: '/admin/live-users',             icon: Users,                label: 'Live Users' },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const user = getAuthUser()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  // Fallback string evaluation for full_name or name
  const displayName = user?.full_name || user?.name || user?.email || 'Admin'
  const avatarChar = displayName.charAt(0).toUpperCase()
  const displayRole = user?.role || 'Administrator'

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
  )
}