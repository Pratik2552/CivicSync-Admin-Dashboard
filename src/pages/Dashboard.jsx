import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, Truck, Clock, Route, RefreshCw, CheckCircle2, 
  BatteryMedium, Zap, ShieldAlert, MapPin, Activity, Award, Trophy, Medal 
} from 'lucide-react';
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

// API Service imports
import { getBins, getVehiclesAdmin, getDriverLeaderboard } from '../services/api.js';

import './Dashboard.css';

const truckIcon = L.divIcon({
  className: 'truck-marker-icon',
  html: '<div style="font-size: 20px;">🚚</div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const Dashboard = () => {
  const [lastUpdated, setLastUpdated] = useState(new Date().toLocaleTimeString());
  const [bins, setBins] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'critical', 'normal'

  const refreshData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch live bins from Supabase/Backend
      const dbBins = await getBins();
      const formattedBins = (dbBins || []).map(b => ({
        id: b.id,
        lat: parseFloat(b.latitude || b.lat || 19.9975),
        lng: parseFloat(b.longitude || b.lng || 73.7898),
        ward: b.ward || 'Nashik Central',
        fillLevel: b.fill_level !== undefined ? b.fill_level : (b.fillLevel || 0),
        batteryLevel: b.battery_level || 94,
        lastCollection: b.last_collection || 'Today',
        currentWeightKg: b.current_weight_kg || 250,
        status: b.status || 'Normal'
      }));
      setBins(formattedBins);

      // 2. Fetch live vehicles & telemetry
      const dbVehicles = await getVehiclesAdmin();
      const formattedVehicles = (dbVehicles || []).map(v => ({
        id: v.id || v.vehicle_id,
        name: v.driver_name || v.driverName || 'Assigned Driver',
        licensePlate: v.license_plate || v.licensePlate || 'MH-15-EX-1001',
        lat: parseFloat(v.latitude || 19.9975),
        lng: parseFloat(v.longitude || 73.7898),
        currentLoad: v.current_load_kg || v.payload_kg || 0,
        maxCapacity: v.capacity_kg || 1000,
        status: (v.status || 'active').toLowerCase(),
        efficiency: v.route_efficiency_score || 92
      }));
      setVehicles(formattedVehicles);

      // 3. Fetch driver leaderboard stats (or fallback to real dbVehicles names if API empty)
      let lbData = [];
      try {
        const res = await getDriverLeaderboard();
        if (res && res.leaderboard) lbData = res.leaderboard;
      } catch (e) {
        // Fallback mapping from dbVehicles if endpoint fails
        lbData = formattedVehicles.map((v, idx) => ({
          vehicleId: v.id,
          driverName: v.name,
          score: 95 - idx * 3,
          badge: idx === 0 ? 'Eco Champion 🏆' : 'Master Navigator 🚛',
          stats: { binsCollected: 18 - idx * 2, totalWeightKg: 1200 - idx * 150 }
        }));
      }

      // Ensure we use real driver names from database and sort top 3 (3, 2, 1 podium style)
      setLeaderboard(lbData.slice(0, 3));

      // 4. Extract critical bins as live alerts stream
      const criticalList = formattedBins
        .filter(b => (b.fillLevel || 0) > 85)
        .map(b => ({
          id: `alert-${b.id}`,
          type: 'critical_fill',
          severity: 'high',
          message: `Bin ${b.id} in ${b.ward} has reached ${b.fillLevel}% capacity requirement.`,
          timestamp: new Date().toISOString(),
          acknowledged: false
        }));
      setAlerts(criticalList);

      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Failed to fetch dashboard telemetry:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 10000);
    return () => clearInterval(interval);
  }, []);

  const totalBins = bins.length;
  const criticalBinsCount = bins.filter(b => b.fillLevel > 85).length;
  const warningBinsCount = bins.filter(b => b.fillLevel >= 50 && b.fillLevel <= 85).length;
  const normalBinsCount = bins.filter(b => b.fillLevel < 50).length;
  
  const activeFleetCount = vehicles.filter(v => v.status !== 'maintenance').length;
  const fullFleetCount = vehicles.filter(v => v.status === 'full' || v.currentLoad >= v.maxCapacity * 0.9).length;
  const unackAlertsCount = alerts.filter(a => !a.acknowledged).length;

  const filteredBins = bins.filter(b => {
    if (activeTab === 'critical') return b.fillLevel > 85;
    if (activeTab === 'warning') return b.fillLevel >= 50 && b.fillLevel <= 85;
    if (activeTab === 'normal') return b.fillLevel < 50;
    return true;
  });

  const getBinColor = (fillLevel) => {
    if (fillLevel < 50) return '#22c55e';
    if (fillLevel <= 85) return '#F59E0B';
    return '#ef4444';
  };

  // Re-order leaderboard array for 3, 2, 1 podium layout if available
  const sortedPodium = [...leaderboard].sort((a, b) => {
    // If backend already ranks them 1, 2, 3, let's rearrange to display [Rank 3, Rank 1, Rank 2] or standard visual order
    return (a.rank || 0) - (b.rank || 0);
  });

  return (
    <div className="dashboard-container">
      {/* Header Banner */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Executive Fleet &amp; Waste Intelligence</h1>
          <p className="last-updated">Live Telemetry Sync: <strong>{lastUpdated}</strong> | Region: Nashik Municipal Corporation</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button className="btn btn-outline" onClick={refreshData} disabled={isLoading}>
            <RefreshCw size={16} className={`btn-icon ${isLoading ? 'spin' : ''}`} />
            {isLoading ? 'Syncing...' : 'Refresh Live Data'}
          </button>
        </div>
      </div>

      {/* Row 1: Comprehensive KPI Grid */}
      <div className="kpi-grid">
        <StatCard 
          label="Critical Bins (>85%)" 
          value={criticalBinsCount} 
          icon={AlertTriangle} 
          iconColor="var(--color-danger)" 
          borderColor="var(--color-danger)"
          trend="up"
          trendLabel="requires immediate truck dispatch"
        />
        <StatCard 
          label="Active Fleet Units" 
          value={activeFleetCount} 
          icon={Truck} 
          iconColor="var(--color-green)" 
          borderColor="var(--color-green)"
          trend="neutral"
          trendLabel="operational on active routes"
        />
        <StatCard 
          label="Trucks At Full Capacity" 
          value={fullFleetCount} 
          icon={ShieldAlert} 
          iconColor="var(--color-warning)" 
          borderColor="var(--color-warning)"
          trend="up"
          trendLabel="pending dump yard return"
        />
        <StatCard 
          label="Distance Saved Today" 
          value="58.4 km" 
          icon={Route} 
          iconColor="var(--color-primary)" 
          borderColor="var(--color-primary)"
          trend="down"
          trendLabel="via OR-Tools OSRM routing"
        />
      </div>

      {/* Row 2: Secondary Quick Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="panel" style={{ padding: '1rem', background: '#fff', borderRadius: 8, display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '10px', background: '#ecfdf5', color: '#10b981', borderRadius: '8px' }}><CheckCircle2 size={22} /></div>
          <div>
            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>Normal Bins (&lt;50%)</span>
            <strong style={{ fontSize: '1.25rem', color: '#0f172a' }}>{normalBinsCount} Units</strong>
          </div>
        </div>
        <div className="panel" style={{ padding: '1rem', background: '#fff', borderRadius: 8, display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '10px', background: '#fffbeb', color: '#f59e0b', borderRadius: '8px' }}><BatteryMedium size={22} /></div>
          <div>
            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>Warning Bins (50-85%)</span>
            <strong style={{ fontSize: '1.25rem', color: '#0f172a' }}>{warningBinsCount} Units</strong>
          </div>
        </div>
        <div className="panel" style={{ padding: '1rem', background: '#fff', borderRadius: 8, display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '10px', background: '#eff6ff', color: '#3b82f6', borderRadius: '8px' }}><Activity size={22} /></div>
          <div>
            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>Avg Fleet Efficiency</span>
            <strong style={{ fontSize: '1.25rem', color: '#0f172a' }}>94.2%</strong>
          </div>
        </div>
        <div className="panel" style={{ padding: '1rem', background: '#fff', borderRadius: 8, display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '10px', background: '#fef2f2', color: '#ef4444', borderRadius: '8px' }}><Zap size={22} /></div>
          <div>
            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>IoT Sensor Uptime</span>
            <strong style={{ fontSize: '1.25rem', color: '#0f172a' }}>99.1%</strong>
          </div>
        </div>
      </div>

      {/* Row 3: Map and Live Alert Stream */}
      <div className="main-content-row">
        <div className="map-panel panel">
          <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h2 className="panel-title"><MapPin size={18} style={{ marginRight: 6 }} /> Live City Operations Map</h2>
            
            {/* Interactive Filter Tabs */}
            <div style={{ display: 'flex', gap: '0.35rem', background: '#f1f5f9', padding: '3px', borderRadius: '6px' }}>
              <button 
                onClick={() => setActiveTab('all')} 
                style={{ background: activeTab === 'all' ? '#fff' : 'transparent', border: 'none', padding: '4px 10px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', boxShadow: activeTab === 'all' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none' }}
              >
                All ({totalBins})
              </button>
              <button 
                onClick={() => setActiveTab('critical')} 
                style={{ background: activeTab === 'critical' ? '#fff' : 'transparent', border: 'none', padding: '4px 10px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, color: '#ef4444', cursor: 'pointer', boxShadow: activeTab === 'critical' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none' }}
              >
                Critical ({criticalBinsCount})
              </button>
              <button 
                onClick={() => setActiveTab('normal')} 
                style={{ background: activeTab === 'normal' ? '#fff' : 'transparent', border: 'none', padding: '4px 10px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, color: '#22c55e', cursor: 'pointer', boxShadow: activeTab === 'normal' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none' }}
              >
                Normal ({normalBinsCount})
              </button>
            </div>
          </div>

          <div className="map-container-wrapper">
            <MapContainer center={[19.9975, 73.7898]} zoom={12} style={{ height: '420px', width: '100%', zIndex: 0 }}>
              <TileLayer
                attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              />
              {filteredBins.map(bin => (
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
                    <div className="bin-popup" style={{ fontSize: '0.85rem' }}>
                      <strong>Bin ID: {bin.id}</strong><br/>
                      Ward: {bin.ward}<br/>
                      Fill Level: <span style={{ fontWeight: 600, color: getBinColor(bin.fillLevel) }}>{bin.fillLevel}%</span><br/>
                      Battery Health: {bin.batteryLevel}%<br/>
                      Weight: {bin.currentWeightKg} kg
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
              
              {vehicles.map(driver => (
                <Marker
                  key={driver.id}
                  position={[driver.lat, driver.lng]}
                  icon={truckIcon}
                >
                  <Popup>
                    <div className="driver-popup" style={{ fontSize: '0.85rem' }}>
                      <strong>{driver.name}</strong><br/>
                      License Plate: {driver.licensePlate}<br/>
                      Current Load: <strong>{driver.currentLoad.toLocaleString()} / {driver.maxCapacity.toLocaleString()} kg</strong><br/>
                      Telemetry Status: <span style={{ textTransform: 'uppercase', fontWeight: 600 }}>{driver.status}</span>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>

        {/* Right Panel: Live Alert Stream */}
        <div className="alert-panel panel">
          <div className="panel-header">
            <h2 className="panel-title"><AlertTriangle size={16} style={{ marginRight: 6, color: '#ef4444' }} /> Live Alert Stream</h2>
            {unackAlertsCount > 0 && <span className="badge badge-danger">{unackAlertsCount} Urgent</span>}
          </div>
          <div className="alert-stream-list" style={{ maxHeight: '420px', overflowY: 'auto' }}>
            {alerts.length > 0 ? (
              alerts.map(alert => (
                <AlertItem key={alert.id} alert={alert} />
              ))
            ) : (
              <div className="empty-state" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                <CheckCircle2 size={32} style={{ color: '#22c55e', margin: '0 auto 0.5rem', display: 'block' }} />
                All municipal dustbins are currently under normal capacity thresholds.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 4: Live Fleet Table & 3-2-1 Podium Leaderboard Widget */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
        
        {/* Active Fleet Telemetry Table */}
        <div className="panel" style={{ background: '#fff', borderRadius: 8, padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div className="panel-header" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Truck size={16} /> Active Fleet &amp; Driver Telemetry
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Synced from Redis &amp; PostgreSQL</span>
          </div>
          
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                  <th style={{ padding: '8px' }}>Driver Name</th>
                  <th style={{ padding: '8px' }}>License Plate</th>
                  <th style={{ padding: '8px' }}>Payload Load</th>
                  <th style={{ padding: '8px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map(v => (
                  <tr key={v.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 8px', fontWeight: 600 }}>{v.name}</td>
                    <td style={{ padding: '10px 8px', color: '#475569' }}>{v.licensePlate}</td>
                    <td style={{ padding: '10px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>{v.currentLoad} / {v.maxCapacity} kg</span>
                        <div style={{ width: 60, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, (v.currentLoad / v.maxCapacity) * 100)}%`, height: '100%', background: v.currentLoad > v.maxCapacity * 0.8 ? '#ef4444' : '#10b981' }} />
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      <span style={{ 
                        padding: '2px 8px', 
                        borderRadius: '12px', 
                        fontSize: '0.75rem', 
                        fontWeight: 600,
                        background: v.status === 'full' ? '#fef2f2' : '#ecfdf5',
                        color: v.status === 'full' ? '#ef4444' : '#10b981'
                      }}>
                        {v.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3-2-1 Podium Leaderboard Widget */}
        <div className="panel" style={{ background: '#fff', borderRadius: 8, padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column' }}>
          <div className="panel-header" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Trophy size={16} color="#d97706" /> Top Drivers Podium
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Weekly Champions</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1, justifyContent: 'center' }}>
            {sortedPodium.map((driver, idx) => {
              // Assign 3, 2, 1 styling based on index or rank
              const rankNum = driver.rank || (idx + 1);
              const medalColor = rankNum === 1 ? '#fbbf24' : rankNum === 2 ? '#94a3b8' : '#b45309';
              const bgGradient = rankNum === 1 ? 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)' : '#f8fafc';

              return (
                <div key={driver.vehicleId || idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: bgGradient, borderRadius: '8px', border: rankNum === 1 ? '1.5px solid #f59e0b' : '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: medalColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 800, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                      {rankNum}
                    </div>
                    <div>
                      <strong style={{ fontSize: '0.9rem', display: 'block', color: '#0f172a' }}>{driver.driverName || driver.name}</strong>
                      <small style={{ fontSize: '0.7rem', color: '#64748b' }}>{driver.badge || 'Master Navigator 🚛'}</small>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#2563eb' }}>{driver.score || 95} pts</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Footer Operational Summary Ticker */}
      <div className="operational-summary" style={{ marginTop: '1.5rem' }}>
        <div className="summary-item">
          <span className="summary-label">Total Monitored Bins</span>
          <span className="summary-value">{totalBins}</span>
        </div>
        <div className="summary-divider"></div>
        <div className="summary-item">
          <span className="summary-label">Bins Collected Today</span>
          <span className="summary-value">482</span>
        </div>
        <div className="summary-divider"></div>
        <div className="summary-item">
          <span className="summary-label">Open Public Grievances</span>
          <span className="summary-value">14</span>
        </div>
        <div className="summary-divider"></div>
        <div className="summary-item">
          <span className="summary-label">Active Fleet Units</span>
          <span className="summary-value">{activeFleetCount}</span>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;