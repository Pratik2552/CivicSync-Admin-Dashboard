import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu, Truck } from 'lucide-react';
import VehicleAuthoritySidebar from './VehicleAuthoritySidebar.jsx';
import './AdminLayout.css';

const AUTHORITY_ROUTE_TITLES = {
  '/vehicle-authority/dashboard': 'Fleet Dashboard',
  '/vehicle-authority/vehicles': 'Assigned Vehicles & Map',
  '/vehicle-authority/profile': 'Authority Profile',
};

export default function VehicleAuthorityLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const currentTitle = AUTHORITY_ROUTE_TITLES[location.pathname] || 'Vehicle Authority';

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
            <Truck size={18} />
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

      <VehicleAuthoritySidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="admin-main">
        <div className="admin-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
