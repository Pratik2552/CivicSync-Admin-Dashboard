import React, { useState, useEffect } from 'react';
import { Truck, Activity, TrendingUp, MapPin, RefreshCw } from 'lucide-react';
import StatCard from '../components/common/StatCard';
import './Dashboard.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const VehicleAuthorityDashboard = () => {
  const [stats, setStats] = useState({
    total_vehicles: 0,
    active_vehicles: 0,
    idle_vehicles: 0,
    maintenance_vehicles: 0,
    offline_vehicles: 0,
    total_bins_collected: 0,
    total_weight_collected_kg: 0,
    total_distance_km: 0,
  });
  const [vehicles, setVehicles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date().toLocaleTimeString());

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('civicsync_authority_token');
      
      // Fetch dashboard stats
      const statsResponse = await fetch(`${API_BASE_URL}/api/vehicle-authority/dashboard-stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData.stats || {});
      }

      // Fetch managed vehicles
      const vehiclesResponse = await fetch(`${API_BASE_URL}/api/vehicle-authority/vehicles`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (vehiclesResponse.ok) {
        const vehiclesData = await vehiclesResponse.json();
        setVehicles(vehiclesData.vehicles || []);
      }

      setLastUpdated(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return '#10b981';
      case 'idle':
        return '#f59e0b';
      case 'maintenance':
        return '#ef4444';
      case 'offline':
        return '#6b7280';
      default:
        return '#6b7280';
    }
  };

  const getStatusLabel = (status) => {
    return status?.charAt(0).toUpperCase() + status?.slice(1).toLowerCase() || 'Unknown';
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Vehicle Authority Dashboard</h1>
          <p className="dashboard-subtitle">Fleet Performance & Operations Overview</p>
        </div>
        <div className="dashboard-header-actions">
          <span className="last-updated">Last updated: {lastUpdated}</span>
          <button className="refresh-btn" onClick={fetchDashboardData} disabled={isLoading}>
            <RefreshCw size={16} className={isLoading ? 'spinning' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <StatCard
          title="Total Vehicles"
          value={stats.total_vehicles}
          icon={Truck}
          color="#3b82f6"
          trend={null}
        />
        <StatCard
          title="Active Vehicles"
          value={stats.active_vehicles}
          icon={Activity}
          color="#10b981"
          trend={null}
        />
        <StatCard
          title="Total Bins Collected"
          value={stats.total_bins_collected}
          icon={TrendingUp}
          color="#f59e0b"
          trend={null}
        />
        <StatCard
          title="Distance Covered"
          value={`${Math.round(stats.total_distance_km)} km`}
          icon={MapPin}
          color="#8b5cf6"
          trend={null}
        />
      </div>

      {/* Vehicle Status Breakdown */}
      <div className="dashboard-section">
        <div className="section-header">
          <h2 className="section-title">Fleet Status Breakdown</h2>
        </div>
        <div className="status-grid">
          <div className="status-card" style={{ borderLeftColor: '#10b981' }}>
            <div className="status-label">Active</div>
            <div className="status-value">{stats.active_vehicles}</div>
          </div>
          <div className="status-card" style={{ borderLeftColor: '#f59e0b' }}>
            <div className="status-label">Idle</div>
            <div className="status-value">{stats.idle_vehicles}</div>
          </div>
          <div className="status-card" style={{ borderLeftColor: '#ef4444' }}>
            <div className="status-label">Maintenance</div>
            <div className="status-value">{stats.maintenance_vehicles}</div>
          </div>
          <div className="status-card" style={{ borderLeftColor: '#6b7280' }}>
            <div className="status-label">Offline</div>
            <div className="status-value">{stats.offline_vehicles}</div>
          </div>
        </div>
      </div>

      {/* Vehicles List */}
      <div className="dashboard-section">
        <div className="section-header">
          <h2 className="section-title">My Vehicles</h2>
          <span className="section-subtitle">{vehicles.length} total vehicles</span>
        </div>

        {vehicles.length === 0 ? (
          <div className="empty-state">
            <Truck size={48} className="empty-icon" />
            <p>No vehicles assigned to you yet</p>
          </div>
        ) : (
          <div className="vehicles-table-container">
            <table className="vehicles-table">
              <thead>
                <tr>
                  <th>License Plate</th>
                  <th>Driver</th>
                  <th>Status</th>
                  <th>Capacity</th>
                  <th>Current Load</th>
                  <th>Territory</th>
                  <th>Bins Collected</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((vehicle) => (
                  <tr key={vehicle.id}>
                    <td className="font-bold">{vehicle.license_plate}</td>
                    <td>{vehicle.driver_name || 'Unassigned'}</td>
                    <td>
                      <span 
                        className="status-badge" 
                        style={{ backgroundColor: getStatusColor(vehicle.status) }}
                      >
                        {getStatusLabel(vehicle.status)}
                      </span>
                    </td>
                    <td>{vehicle.capacity_kg} kg</td>
                    <td>{vehicle.current_load_kg || 0} kg</td>
                    <td>{vehicle.territory_name || 'N/A'}</td>
                    <td>{vehicle.total_bins_collected || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default VehicleAuthorityDashboard;
