import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu, Building2 } from 'lucide-react'
import Sidebar from './Sidebar.jsx'
import './AdminLayout.css'

const ROUTE_TITLES = {
  '/admin/dashboard': 'Operations Dashboard',
  '/admin/route-optimizer': 'Route Optimizer & Fleet Map',
  '/admin/drivers': 'Drivers & Fleet Management',
  '/admin/vehicle-profiles': 'Vehicle Profiles',
  '/admin/bins': 'Municipal Dustbins',
  '/admin/grievances': 'Public Grievances',
  '/admin/dead-animal-complaints': 'Dead Animal Alerts',
  '/admin/operational-cost': 'Operational Cost Analysis',
  '/admin/carbon-cards': 'Carbon Card Holders',
  '/admin/live-users': 'Live Citizens & Users',
}

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  const currentTitle = ROUTE_TITLES[location.pathname] || 'Municipal Admin'

  return (
    <div className="admin-shell">
      {/* Mobile Top Navigation Bar */}
      <header className="mobile-header">
        <button
          className="mobile-menu-btn"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle navigation menu"
        >
          <Menu size={22} />
        </button>
        <div className="mobile-brand">
          <div className="mobile-brand-icon">
            <Building2 size={18} />
          </div>
          <div className="mobile-brand-title">
            <span className="mobile-brand-name">CivicSync</span>
            <span className="mobile-page-name">{currentTitle}</span>
          </div>
        </div>
      </header>

      {/* Backdrop for mobile drawer */}
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation overlay"
        />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="admin-main">
        <div className="admin-content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}