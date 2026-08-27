import { Outlet, Navigate } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import './AdminLayout.css'

export default function AdminLayout() {
  return (
    <div className="admin-shell">
      <Sidebar />
      <div className="admin-main">
        <div className="admin-content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}