import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AdminLayout from './components/layout/AdminLayout.jsx'
import VehicleAuthorityLayout from './components/layout/VehicleAuthorityLayout.jsx'
import Login from './pages/Login.jsx'
import VehicleAuthorityLogin from './pages/VehicleAuthorityLogin.jsx'
import Dashboard from './pages/Dashboard.jsx'
import RouteOptimizer from './pages/RouteOptimizer.jsx'
import Drivers from './pages/Drivers.jsx'
import Bins from './pages/Bins.jsx'
import Grievances from './pages/Grievances.jsx'
import CarbonCardHolders from './pages/CarbonCardHolders.jsx'
import VehicleProfiles from './pages/VehicleProfiles.jsx'
import LiveUsers from './pages/LiveUsers.jsx'
import DeadAnimalComplaints from './pages/DeadAnimalComplaints.jsx'
import OperationalCostAnalysis from './pages/OperationalCostAnalysis.jsx'
import VehicleAuthorityDashboard from './pages/VehicleAuthorityDashboard.jsx'
import VehicleAuthorityVehicles from './pages/VehicleAuthorityVehicles.jsx'
import VehicleAuthorityProfile from './pages/VehicleAuthorityProfile.jsx'

function ProtectedRoute({ children }) {
  const isAuth = localStorage.getItem('civicsync_admin_token')
  return isAuth ? children : <Navigate to="/login" replace />
}

function ProtectedAuthorityRoute({ children }) {
  const isAuth = localStorage.getItem('civicsync_authority_token')
  return isAuth ? children : <Navigate to="/vehicle-authority/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Admin Routes */}
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
          <Route path="dead-animal-complaints" element={<DeadAnimalComplaints />} />
          <Route path="operational-cost" element={<OperationalCostAnalysis />} />
          <Route path="carbon-cards" element={<CarbonCardHolders />} />
          <Route path="vehicle-profiles" element={<VehicleProfiles />} />
          <Route path="live-users" element={<LiveUsers />} />
        </Route>

        {/* Vehicle Authority Routes */}
        <Route path="/vehicle-authority/login" element={<VehicleAuthorityLogin />} />
        <Route
          path="/vehicle-authority"
          element={
            <ProtectedAuthorityRoute>
              <VehicleAuthorityLayout />
            </ProtectedAuthorityRoute>
          }
        >
          <Route index element={<Navigate to="/vehicle-authority/dashboard" replace />} />
          <Route path="dashboard" element={<VehicleAuthorityDashboard />} />
          <Route path="vehicles" element={<VehicleAuthorityVehicles />} />
          <Route path="profile" element={<VehicleAuthorityProfile />} />
        </Route>

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}