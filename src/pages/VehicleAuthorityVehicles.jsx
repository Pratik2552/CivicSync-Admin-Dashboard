import React, { useState, useEffect } from 'react';
import { Truck, MapPin, Activity, RefreshCw, Edit, Search } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './Drivers.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// Fix Leaflet Default Icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const truckIcon = L.divIcon({
  className: 'truck-marker-icon',
  html: '<div style="font-size: 24px;">🚚</div>',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const VehicleAuthorityVehicles = () => {
  const [vehicles, setVehicles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date().toLocaleTimeString());

  const fetchVehicles = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('civicsync_authority_token');
      const response = await fetch(`${API_BASE_URL}/api/vehicle-authority/vehicles`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setVehicles(data.vehicles || []);
      }
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Error fetching vehicles:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
    const interval = setInterval(fetchVehicles, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'active': return '#10b981';
      case 'idle': return '#f59e0b';
      case 'maintenance': return '#ef4444';
      case 'offline': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getStatusLabel = (status) => {
    return status?.charAt(0).toUpperCase() + status?.slice(1).toLowerCase() || 'Unknown';
  };

  const filteredVehicles = vehicles.filter(v => 
    v.license_plate?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.driver_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.territory_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const mapCenter = vehicles.length > 0 && vehicles[0].latitude
    ? [parseFloat(vehicles[0].latitude), parseFloat(vehicles[0].longitude)]
    : [18.5204, 73.8567]; // Pune default

  return (
    <div className="drivers-container">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">My Vehicles</h1>
          <p className="dashboard-subtitle">Manage and monitor your assigned fleet</p>
        </div>
        <div className="dashboard-header-actions">
          <span className="last-updated">Last updated: {lastUpdated}</span>
          <button className="refresh-btn" onClick={fetchVehicles} disabled={isLoading}>
            <RefreshCw size={16} className={isLoading ? 'spinning' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="search-bar">
        <Search size={18} className="search-icon" />
        <input
          type="text"
          placeholder="Search by license plate, driver, or territory..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      {/* Map View */}
      <div className="dashboard-section">
        <div className="section-header">
          <h2 className="section-title">Live Vehicle Tracking</h2>
        </div>
        <div className="map-container" style={{ height: '400px', borderRadius: '8px', overflow: 'hidden' }}>
          <MapContainer
            center={mapCenter}
            zoom={12}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
            {filteredVehicles.map((vehicle) => {
              if (!vehicle.latitude || !vehicle.longitude) return null;
              return (
                <Marker
                  key={vehicle.id}
                  position={[parseFloat(vehicle.latitude), parseFloat(vehicle.longitude)]}
                  icon={truckIcon}
                >
                  <Popup>
                    <div style={{ minWidth: '200px' }}>
                      <strong>{vehicle.license_plate}</strong><br />
                      Driver: {vehicle.driver_name || 'Unassigned'}<br />
                      Status: <span style={{ color: getStatusColor(vehicle.status) }}>
                        {getStatusLabel(vehicle.status)}
                      </span><br />
                      Load: {vehicle.current_load_kg || 0} / {vehicle.capacity_kg} kg
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      </div>

      {/* Vehicles Table */}
      <div className="dashboard-section">
        <div className="section-header">
          <h2 className="section-title">Vehicle List</h2>
          <span className="section-subtitle">{filteredVehicles.length} vehicles</span>
        </div>

        {filteredVehicles.length === 0 ? (
          <div className="empty-state">
            <Truck size={48} className="empty-icon" />
            <p>{searchTerm ? 'No vehicles match your search' : 'No vehicles assigned'}</p>
          </div>
        ) : (
          <div className="vehicles-table-container">
            <table className="vehicles-table">
              <thead>
                <tr>
                  <th>License Plate</th>
                  <th>Driver</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Load</th>
                  <th>Territory</th>
                  <th>Bins Collected</th>
                  <th>Distance (km)</th>
                  <th>Efficiency</th>
                </tr>
              </thead>
              <tbody>
                {filteredVehicles.map((vehicle) => (
                  <tr key={vehicle.id} onClick={() => setSelectedVehicle(vehicle)} style={{ cursor: 'pointer' }}>
                    <td className="font-bold">{vehicle.license_plate}</td>
                    <td>{vehicle.driver_name || 'Unassigned'}</td>
                    <td>{vehicle.driver_phone || 'N/A'}</td>
                    <td>
                      <span 
                        className="status-badge" 
                        style={{ backgroundColor: getStatusColor(vehicle.status) }}
                      >
                        {getStatusLabel(vehicle.status)}
                      </span>
                    </td>
                    <td>
                      {vehicle.current_load_kg || 0} / {vehicle.capacity_kg} kg
                      <div style={{ 
                        height: '4px', 
                        backgroundColor: '#e5e7eb', 
                        borderRadius: '2px', 
                        marginTop: '4px',
                        overflow: 'hidden'
                      }}>
                        <div style={{ 
                          height: '100%', 
                          width: `${((vehicle.current_load_kg || 0) / vehicle.capacity_kg) * 100}%`,
                          backgroundColor: '#3b82f6',
                          transition: 'width 0.3s'
                        }} />
                      </div>
                    </td>
                    <td>{vehicle.territory_name || 'N/A'}</td>
                    <td>{vehicle.total_bins_collected || 0}</td>
                    <td>{Math.round(vehicle.total_distance_km || 0)}</td>
                    <td>{vehicle.route_efficiency_score || 0}%</td>
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

export default VehicleAuthorityVehicles;
