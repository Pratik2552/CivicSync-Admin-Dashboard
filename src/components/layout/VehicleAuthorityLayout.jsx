import { Outlet } from 'react-router-dom';
import VehicleAuthoritySidebar from './VehicleAuthoritySidebar.jsx';
import './AdminLayout.css';

export default function VehicleAuthorityLayout() {
  return (
    <div className="admin-shell">
      <VehicleAuthoritySidebar />
      <div className="admin-main">
        <div className="admin-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
