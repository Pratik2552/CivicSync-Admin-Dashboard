import React, { useState, useEffect } from 'react';
import { AlertTriangle, Truck, Clock, Route, RefreshCw } from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet Default Icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Components
import StatCard from '../components/common/StatCard';
import AlertItem from '../components/common/AlertItem';

// Data imports
import { BINS, getBinStats } from '../data/bins';
import { DRIVERS, getFleetStats } from '../data/drivers';
import { ALERTS, getUnacknowledgedCount } from '../data/alerts';

import './Dashboard.css';

// Custom div icon for trucks
const truckIcon = L.divIcon({
  className: 'truck-marker-icon',
  html: '<div style="font-size: 20px;">🚚</div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const Dashboard = () => {
  const [lastUpdated, setLastUpdated] = useState(new Date().toLocaleTimeString());
  const [binStats, setBinStats] = useState({ total: 0, critical: 0, collectedToday: 0 });
  const [fleetStats, setFleetStats] = useState({ total: 0, active: 0, inTransit: 0 });
  const [unackAlerts, setUnackAlerts] = useState(0);

  const refreshData = () => {
    setBinStats(getBinStats());
    setFleetStats(getFleetStats());
    setUnackAlerts(getUnacknowledgedCount());
    setLastUpdated(new Date().toLocaleTimeString());
  };

  useEffect(() => {
    refreshData();
  }, []);

  const criticalBins = BINS.filter(bin => bin.fillLevel > 85);
  const activeDrivers = DRIVERS.filter(d => d.status === 'active' || d.status === 'in_transit');

  const getBinColor = (fillLevel) => {
    if (fillLevel < 50) return '#22c55e'; // green
    if (fillLevel <= 85) return '#F59E0B'; // yellow
    return '#ef4444'; // red
  };

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Executive Overview</h1>
          <p className="last-updated">Last Updated: {lastUpdated}</p>
        </div>
        <button className="btn btn-outline" onClick={refreshData}>
          <RefreshCw size={16} className="btn-icon" />
          Refresh
        </button>
      </div>

      <div className="kpi-grid">
        <StatCard 
          label="Critical Bins" 
          value={binStats.critical} 
          icon={AlertTriangle} 
          iconColor="var(--color-danger)" 
          borderColor="var(--color-danger)"
          trend="up"
          trendLabel="vs last hour"
        />
        <StatCard 
          label="Active Fleet" 
          value={fleetStats.active + fleetStats.in_transit} 
          icon={Truck} 
          iconColor="var(--color-green)" 
          borderColor="var(--color-green)"
          trend="neutral"
          trendLabel="on route"
        />
        <StatCard 
          label="Avg. Resolution Time" 
          value="2.4 hrs" 
          icon={Clock} 
          iconColor="var(--color-primary)" 
          borderColor="var(--color-primary)"
          trend="down"
          trendLabel="vs yesterday"
        />
        <StatCard 
          label="Distance Saved Today" 
          value="42.3 km" 
          icon={Route} 
          iconColor="var(--color-primary)" 
          borderColor="var(--color-primary)"
          trend="up"
          trendLabel="via optimization"
        />
      </div>

      <div className="main-content-row">
        <div className="map-panel panel">
          <div className="panel-header">
            <h2 className="panel-title">Live City Operations Map</h2>
            <div className="map-legend">
              <span className="legend-item"><span className="legend-dot" style={{backgroundColor: '#22c55e'}}></span> Low &lt;50%</span>
              <span className="legend-item"><span className="legend-dot" style={{backgroundColor: '#F59E0B'}}></span> Medium 50-85%</span>
              <span className="legend-item"><span className="legend-dot" style={{backgroundColor: '#ef4444'}}></span> Critical &gt;85%</span>
              <span className="legend-item">🚚 Vehicle</span>
            </div>
          </div>
          <div className="map-container-wrapper">
            <MapContainer center={[18.5204, 73.8567]} zoom={12} style={{ height: '420px', width: '100%', zIndex: 0 }}>
              <TileLayer
                attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              />
              {BINS.map(bin => (
                <CircleMarker
                  key={bin.id}
                  center={[bin.lat, bin.lng]}
                  radius={8}
                  fillColor={getBinColor(bin.fillLevel)}
                  fillOpacity={0.85}
                  color="#ffffff"
                  weight={1.5}
                >
                  <Popup>
                    <div className="bin-popup">
                      <strong>Bin {bin.id}</strong><br/>
                      Ward: {bin.ward}<br/>
                      Fill Level: {bin.fillLevel}%<br/>
                      Battery: {bin.batteryLevel}%<br/>
                      Last Collection: {bin.lastCollection}
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
              
              {activeDrivers.map(driver => (
                <Marker
                  key={driver.id}
                  position={[driver.lat, driver.lng]}
                  icon={truckIcon}
                >
                  <Popup>
                    <div className="driver-popup">
                      <strong>{driver.name}</strong><br/>
                      Plate: {driver.licensePlate}<br/>
                      Load: {driver.currentLoad.toLocaleString()} / {driver.maxCapacity.toLocaleString()} kg<br/>
                      Status: {driver.status}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>

        <div className="alert-panel panel">
          <div className="panel-header">
            <h2 className="panel-title">Alert Stream</h2>
            {unackAlerts > 0 && <span className="badge badge-danger">{unackAlerts} New</span>}
          </div>
          <div className="alert-stream-list">
            {ALERTS.length > 0 ? (
              [...ALERTS].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map(alert => (
                <AlertItem key={alert.id} alert={alert} />
              ))
            ) : (
              <div className="empty-state">No active alerts at this time.</div>
            )}
          </div>
        </div>
      </div>

      <div className="operational-summary">
        <div className="summary-item">
          <span className="summary-label">Total Bins</span>
          <span className="summary-value">{binStats.total || BINS.length}</span>
        </div>
        <div className="summary-divider"></div>
        <div className="summary-item">
          <span className="summary-label">Bins Collected Today</span>
          <span className="summary-value">482</span>
        </div>
        <div className="summary-divider"></div>
        <div className="summary-item">
          <span className="summary-label">Open Complaints</span>
          <span className="summary-value">14</span>
        </div>
        <div className="summary-divider"></div>
        <div className="summary-item">
          <span className="summary-label">Drivers on Route</span>
          <span className="summary-value">{fleetStats.active + fleetStats.inTransit}</span>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
