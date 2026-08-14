import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AdminLayout from './components/layout/AdminLayout.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import RouteOptimizer from './pages/RouteOptimizer.jsx'
import Drivers from './pages/Drivers.jsx'
import Bins from './pages/Bins.jsx'
import Grievances from './pages/Grievances.jsx'

function ProtectedRoute({ children }) {
  const isAuth = localStorage.getItem('civicsync_admin_token')
  return isAuth ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="route-optimizer" element={<RouteOptimizer />} />
          <Route path="drivers" element={<Drivers />} />
          <Route path="bins" element={<Bins />} />
          <Route path="grievances" element={<Grievances />} />
        </Route>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
