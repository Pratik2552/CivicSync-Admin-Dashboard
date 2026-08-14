import React, { useState, useMemo, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Polyline, Rectangle, Popup, useMap } from 'react-leaflet';
import { RefreshCw, MapPin, Settings, Info, CheckCircle, AlertTriangle, Map, Search, Plus, Maximize2, Minimize2, Truck, Navigation } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { optimizeFleetRoutes, reassignBin, getVehiclesAdmin, getBins } from '../services/api.js';
import './RouteOptimizer.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const PALETTE_COLORS = ['#2563eb', '#16a34a', '#d97706', '#7c3aed', '#db2777', '#0891b2'];

// Helper component to smoothly re-center map when bounds or fullscreen changes
function MapRecenter({ bounds, isFullscreen }) {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);
    return () => clearTimeout(timer);
  }, [isFullscreen, map]);

  useEffect(() => {
    if (bounds) {
      map.fitBounds([
        [bounds.minLat, bounds.minLng],
        [bounds.maxLat, bounds.maxLng]
      ], { padding: [30, 30] });
    }
  }, [bounds, map]);

  return null;
}

export default function RouteOptimizer() {
  const [dbDrivers, setDbDrivers] = useState([]);
  const [liveVehicles, setLiveVehicles] = useState([]);
  const [driverTerritories, setDriverTerritories] = useState([]);
  const [generatedBins, setGeneratedBins] = useState([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isSearchingGeocode, setIsSearchingGeocode] = useState(false);
  const [optimizedRoutes, setOptimizedRoutes] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  
  const [selectedDriverId, setSelectedDriverId] = useState('ALL');
  const [activeMapFocusBounds, setActiveMapFocusBounds] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const mapColumnRef = useRef(null);

  // Form State: Territory Assignment & Search
  const [targetDriverId, setTargetDriverId] = useState('');
  const [colonyName, setColonyName] = useState('');
  const [minLat, setMinLat] = useState('19.9900');
  const [maxLat, setMaxLat] = useState('20.0100');
  const [minLng, setMinLng] = useState('73.7700');
  const [maxLng, setMaxLng] = useState('73.7900');

  // Manual Override Form State
  const [reassignBinId, setReassignBinId] = useState('');
  const [reassignBinDriverId, setReassignBinDriverId] = useState('');
  const [overrideMsg, setOverrideMsg] = useState('');

  // Toggle Fullscreen Handler using Browser Fullscreen API
  const toggleFullscreen = () => {
    if (!mapColumnRef.current) return;

    if (!document.fullscreenElement) {
      mapColumnRef.current.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Load Live Drivers & Bins from Database on Mount
  useEffect(() => {
    async function loadDataAndTelemetry() {
      try {
        const dbBins = await getBins();
        if (dbBins && dbBins.length > 0) {
          setGeneratedBins(dbBins);
        }

        const vehiclesList = await getVehiclesAdmin();
        const activeVehicles = vehiclesList.filter((v) => (v.status || '').toLowerCase() !== 'maintenance');
        
        setDbDrivers(activeVehicles);
        setLiveVehicles(activeVehicles);

        if (activeVehicles.length > 0 && driverTerritories.length === 0) {
          const dynamicTerritories = activeVehicles.map((v, idx) => {
            const vId = String(v.id || v.vehicle_id);
            const dName = v.driver_name || v.driverName || `Driver (${vId})`;
            
            const centerLat = parseFloat(v.latitude || v.min_lat || 19.9975);
            const centerLng = parseFloat(v.longitude || v.min_lng || 73.7898);

            return {
              driverId: vId,
              driverName: dName,
              zoneName: v.territory_name || v.ward || `Territory ${vId}`,
              color: PALETTE_COLORS[idx % PALETTE_COLORS.length],
              bounds: {
                minLat: parseFloat(v.min_lat || (centerLat - 0.008).toFixed(4)),
                maxLat: parseFloat(v.max_lat || (centerLat + 0.008).toFixed(4)),
                minLng: parseFloat(v.min_lng || (centerLng - 0.008).toFixed(4)),
                maxLng: parseFloat(v.max_lng || (centerLng + 0.008).toFixed(4)),
              }
            };
          });

          setDriverTerritories(dynamicTerritories);
          setTargetDriverId(dynamicTerritories[0]?.driverId || '');
        }
      } catch (err) {
        console.error('Failed to load database drivers/bins:', err);
      }
    }

    loadDataAndTelemetry();

    const interval = setInterval(async () => {
      try {
        const vehiclesList = await getVehiclesAdmin();
        const activeVehicles = vehiclesList.filter((v) => (v.status || '').toLowerCase() !== 'maintenance');
        setLiveVehicles(activeVehicles);
      } catch (err) {
        console.error('Telemetry polling error:', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // OpenStreetMap Geocoding: Auto-search place inside Nashik
  const handleGeocodeLocation = async () => {
    if (!colonyName.trim()) {
      setErrorMsg('Please enter a place or colony name first.');
      return;
    }

    setIsSearchingGeocode(true);
    setErrorMsg('');
    setStatusMsg('');

    try {
      const query = encodeURIComponent(`${colonyName.trim()}, Nashik, Maharashtra, India`);
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&bounded=1&viewbox=73.65,20.10,73.90,19.85`;

      const res = await fetch(url);
      const data = await res.json();

      if (data && data.length > 0) {
        const place = data[0];
        let bounds = { minLat: 0, maxLat: 0, minLng: 0, maxLng: 0 };

        if (place.boundingbox && place.boundingbox.length === 4) {
          bounds = {
            minLat: parseFloat(parseFloat(place.boundingbox[0]).toFixed(4)),
            maxLat: parseFloat(parseFloat(place.boundingbox[1]).toFixed(4)),
            minLng: parseFloat(parseFloat(place.boundingbox[2]).toFixed(4)),
            maxLng: parseFloat(parseFloat(place.boundingbox[3]).toFixed(4)),
          };
        } else {
          const centerLat = parseFloat(place.lat);
          const centerLng = parseFloat(place.lon);
          bounds = {
            minLat: parseFloat((centerLat - 0.008).toFixed(4)),
            maxLat: parseFloat((centerLat + 0.008).toFixed(4)),
            minLng: parseFloat((centerLng - 0.008).toFixed(4)),
            maxLng: parseFloat((centerLng + 0.008).toFixed(4)),
          };
        }

        setMinLat(bounds.minLat.toString());
        setMaxLat(bounds.maxLat.toString());
        setMinLng(bounds.minLng.toString());
        setMaxLng(bounds.maxLng.toString());

        setActiveMapFocusBounds(bounds);
        setStatusMsg(`Location "${place.display_name.split(',')[0]}" found! Boundaries auto-filled.`);
      } else {
        setErrorMsg(`Could not find "${colonyName}" in Nashik.`);
      }
    } catch (err) {
      console.error('Geocoding Error:', err);
      setErrorMsg('Failed to search coordinates.');
    } finally {
      setIsSearchingGeocode(false);
    }
  };

  const handleAssignTerritorySubmit = (e) => {
    e.preventDefault();
    if (!targetDriverId || !colonyName || !minLat || !maxLat || !minLng || !maxLng) return;

    const newBounds = {
      minLat: parseFloat(minLat),
      maxLat: parseFloat(maxLat),
      minLng: parseFloat(minLng),
      maxLng: parseFloat(maxLng)
    };

    const updatedTerritories = driverTerritories.map((t) => {
      if (t.driverId === targetDriverId) {
        return { ...t, zoneName: colonyName, bounds: newBounds };
      }
      return t;
    });

    setDriverTerritories(updatedTerritories);
    setOptimizedRoutes([]);
    setStatusMsg(`Territory "${colonyName}" assigned to Driver ${targetDriverId}.`);
    setTimeout(() => setStatusMsg(''), 5000);
  };

  const handleOptimize = async () => {
    setIsOptimizing(true);
    setErrorMsg('');
    setStatusMsg('');

    try {
      const depotLat = 19.9975;
      const depotLng = 73.7898;

      const vehiclesPayload = driverTerritories.map((t) => ({
        vehicleId: t.driverId,
        driverName: t.driverName,
        capacity: 1000,
        currentLoad: 0,
        minLat: t.bounds.minLat,
        maxLat: t.bounds.maxLat,
        minLng: t.bounds.minLng,
        maxLng: t.bounds.maxLng,
      }));

      const result = await optimizeFleetRoutes(depotLat, depotLng, vehiclesPayload, generatedBins);

      if (result && result.routes) {
        setOptimizedRoutes(result.routes);
        setStatusMsg(`Successfully optimized routes for ${result.routes.length} driver territories!`);
      } else if (result && result.error) {
        setErrorMsg(result.error);
      }
    } catch (err) {
      console.error('Optimization error:', err);
      setErrorMsg(err.message || 'Route optimization failed.');
    } finally {
      setIsOptimizing(false);
    }
  };

  async function handleReassignBinSubmit(e) {
    e.preventDefault();
    if (!reassignBinId || !reassignBinDriverId) return;
    try {
      await reassignBin(reassignBinId, reassignBinDriverId);
      setOverrideMsg(`Bin ${reassignBinId} reassigned to driver ${reassignBinDriverId}.`);
      setReassignBinId('');
      setReassignBinDriverId('');
      setTimeout(() => setOverrideMsg(''), 6000);
    } catch (err) {
      setOverrideMsg(`Failed to reassign bin: ${err.message}`);
    }
  }

  const visibleRoutes = useMemo(() => {
    if (selectedDriverId === 'ALL') return optimizedRoutes;
    return optimizedRoutes.filter((r) => String(r.vehicleId) === String(selectedDriverId));
  }, [selectedDriverId, optimizedRoutes]);

  const selectedRoute = useMemo(() => {
    return optimizedRoutes.find((r) => String(r.vehicleId) === String(selectedDriverId)) || null;
  }, [selectedDriverId, optimizedRoutes]);

  const parsePolylineCoords = (geometry) => {
    if (!geometry || !geometry.coordinates) return [];
    return geometry.coordinates.map((coord) => [coord[1], coord[0]]);
  };

  return (
    <div className="ro-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Driver Territory &amp; Fleet Optimizer</h1>
          <p className="page-subheading">
            Search places in Nashik, assign colony boundaries to drivers, view geofenced territories, and run OR-Tools route planning.
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="ro-toolbar" style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          id="btn-optimize-routes"
          className="btn btn-primary btn-lg"
          onClick={handleOptimize}
          disabled={isOptimizing}
        >
          <RefreshCw size={16} className={isOptimizing ? 'spin' : ''} />
          {isOptimizing ? 'Optimizing Fleet Routes…' : 'Optimize Fleet Routes'}
        </button>

        {statusMsg && (
          <div className="alert alert-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, margin: 0, padding: '0.5rem 1rem' }}>
            <CheckCircle size={15} /> {statusMsg}
          </div>
        )}

        {errorMsg && (
          <div className="alert alert-error" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, margin: 0, padding: '0.5rem 1rem' }}>
            <AlertTriangle size={15} /> {errorMsg}
          </div>
        )}

        <div style={{ marginLeft: 'auto' }}>
          <select
            id="driver-inspector"
            className="form-select"
            value={selectedDriverId}
            onChange={(e) => setSelectedDriverId(e.target.value)}
          >
            <option value="ALL">All Drivers &amp; Territories ({driverTerritories.length})</option>
            {driverTerritories.map((t) => (
              <option key={t.driverId} value={t.driverId}>
                {t.driverName} ({t.zoneName})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main 2-column layout */}
      <div className="ro-body" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginTop: '1rem' }}>
        
        {/* LEFT: Map Panel with Fullscreen Wrapper */}
        <div 
          ref={mapColumnRef} 
          className={`ro-map-col ${isFullscreen ? 'ro-fullscreen-mode' : ''}`}
        >
          <div className="panel ro-map-panel-box">
            <div className="panel-header" style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3><MapPin size={16} style={{ marginRight: 6 }} /> Territory Geofences &amp; Dustbin Locations</h3>
                <small className="text-muted">Depot: Nashik Central (19.9975, 73.7898)</small>
              </div>
              <button 
                type="button" 
                className="btn btn-secondary btn-sm" 
                onClick={toggleFullscreen}
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Map"}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.4rem 0.75rem' }}
              >
                {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
              </button>
            </div>

            <div className={`ro-map-content-area ${isFullscreen ? 'fullscreen-active' : ''}`}>
              <div className="ro-map-view-container">
                <MapContainer
                  center={[19.9975, 73.7898]}
                  zoom={12}
                  style={{ height: '100%', width: '100%', borderRadius: 6 }}
                >
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; CARTO'
                  />

                  <MapRecenter bounds={activeMapFocusBounds} isFullscreen={isFullscreen} />

                  {/* 1. Driver Territory Boundaries */}
                  {driverTerritories.map((t) => {
                    if (selectedDriverId !== 'ALL' && selectedDriverId !== t.driverId) return null;
                    return (
                      <Rectangle
                        key={t.driverId}
                        bounds={[
                          [t.bounds.minLat, t.bounds.minLng],
                          [t.bounds.maxLat, t.bounds.maxLng],
                        ]}
                        pathOptions={{
                          color: t.color,
                          weight: 2,
                          fillColor: t.color,
                          fillOpacity: 0.12,
                          dashArray: '6,6',
                        }}
                      >
                        <Popup>
                          <div>
                            <strong>{t.zoneName}</strong><br />
                            Assigned Driver: {t.driverName} ({t.driverId})
                          </div>
                        </Popup>
                      </Rectangle>
                    );
                  })}

                  {/* 2. Fixed Database Dustbins */}
                  {generatedBins.map((bin) => {
                    if (selectedDriverId !== 'ALL' && String(selectedDriverId) !== String(bin.assignedDriverId || bin.driver_id)) return null;
                    const territory = driverTerritories.find((t) => String(t.driverId) === String(bin.assignedDriverId || bin.driver_id));
                    const color = territory ? territory.color : '#ef4444';

                    const lat = parseFloat(bin.latitude || bin.lat);
                    const lng = parseFloat(bin.longitude || bin.lng);
                    if (isNaN(lat) || isNaN(lng)) return null;

                    return (
                      <CircleMarker
                        key={bin.id}
                        center={[lat, lng]}
                        radius={6}
                        pathOptions={{
                          color: color,
                          fillColor: '#ffffff',
                          fillOpacity: 1,
                          weight: 2.5,
                        }}
                      >
                        <Popup>
                          <div>
                            <strong>{bin.id}</strong><br />
                            Ward: {bin.ward || 'Nashik Central'}<br />
                            Fill Level: {bin.fill_level || 0}%<br />
                            Payload Weight: {bin.current_weight_kg || Math.floor((bin.fill_level || 0) * 3.5)} kg
                          </div>
                        </Popup>
                      </CircleMarker>
                    );
                  })}

                  {/* 3. Live Moving Vehicle Drivers from DB */}
                  {liveVehicles.map((vehicle) => {
                    const vId = String(vehicle.id || vehicle.vehicle_id);
                    if (selectedDriverId !== 'ALL' && selectedDriverId !== vId) return null;
                    
                    const lat = parseFloat(vehicle.latitude);
                    const lng = parseFloat(vehicle.longitude);
                    if (isNaN(lat) || isNaN(lng)) return null;

                    return (
                      <CircleMarker
                        key={`live-vehicle-${vId}`}
                        center={[lat, lng]}
                        radius={9}
                        pathOptions={{
                          color: '#1e293b',
                          fillColor: vehicle.status === 'Full' ? '#ef4444' : '#10b981',
                          fillOpacity: 0.9,
                          weight: 3,
                        }}
                      >
                        <Popup>
                          <div style={{ fontSize: '0.85rem' }}>
                            <strong>{vehicle.driver_name || `Driver ${vId}`}</strong><br />
                            Speed: {vehicle.speed || 0} km/h<br />
                            Payload Load: <strong>{vehicle.payload_kg || 0} / {vehicle.capacity_kg || 1000} kg</strong><br />
                            Status: <span style={{ fontWeight: 600, color: vehicle.status === 'Full' ? '#ef4444' : '#16a34a' }}>{vehicle.status || 'In Service'}</span>
                          </div>
                        </Popup>
                      </CircleMarker>
                    );
                  })}

                  {/* 4. Render Driving Routes */}
                  {visibleRoutes.map((route, idx) => {
                    const polylineCoords = parsePolylineCoords(route.geometry);
                    const territory = driverTerritories.find((t) => String(t.driverId) === String(route.vehicleId));
                    const color = territory ? territory.color : '#2563eb';

                    return (
                      <React.Fragment key={route.vehicleId || idx}>
                        {polylineCoords.length > 0 && (
                          <Polyline
                            positions={polylineCoords}
                            pathOptions={{ color, weight: 4, opacity: 0.85 }}
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                </MapContainer>
              </div>

              {/* Fullscreen Fleet Cards Sidebar */}
              {isFullscreen && (
                <div className="ro-fullscreen-sidebar">
                  <div className="ro-sidebar-header">
                    <h4><Truck size={16} style={{ marginRight: 6 }} /> Active Fleet Telemetry ({liveVehicles.length})</h4>
                    <small className="text-muted">Live DB Drivers &amp; Payloads</small>
                  </div>
                  <div className="ro-sidebar-list">
                    {liveVehicles.length > 0 ? (
                      liveVehicles.map((v) => {
                        const vId = String(v.id || v.vehicle_id);
                        const loadKg = v.payload_kg || 150;
                        const capacityKg = v.capacity_kg || 1000;
                        const loadPercent = Math.min(100, Math.round((loadKg / capacityKg) * 100));

                        return (
                          <div key={`sidebar-card-${vId}`} className="ro-fleet-card">
                            <div className="ro-fleet-card-header">
                              <strong>{v.driver_name || v.driverName || `Driver ${vId}`}</strong>
                              <span className={`badge ${v.status === 'Full' ? 'badge-danger' : 'badge-success'}`}>
                                {v.status || 'Active'}
                              </span>
                            </div>
                            <div className="ro-fleet-kv">
                              <span>Plate:</span> <strong>{v.license_plate || 'MH-15-AX-4021'}</strong>
                            </div>
                            <div className="ro-fleet-kv">
                              <span>Speed:</span> <strong>{v.speed || 18} km/h</strong>
                            </div>
                            <div className="ro-fleet-progress-box">
                              <div className="ro-fleet-progress-label">
                                <span>Payload</span>
                                <span>{loadKg} / {capacityKg} kg ({loadPercent}%)</span>
                              </div>
                              <div className="ro-progress-bar">
                                <div className="ro-progress-fill" style={{ width: `${loadPercent}%`, background: loadPercent > 80 ? '#ef4444' : '#2563eb' }} />
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-muted" style={{ textAlign: 'center', padding: '2rem' }}>No drivers found in database.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Map Legend */}
            <div className="ro-legend" style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
              {driverTerritories.map((t) => (
                <span key={t.driverId} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}>
                  <span style={{ width: 12, height: 12, borderRadius: 2, background: t.color, display: 'inline-block' }} />
                  <strong>{t.driverName}:</strong> {t.zoneName}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Territory Search & Assignment Panel */}
        <div className="ro-details-col" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* Territory Search & Assignment Card */}
          <div className="panel" style={{ background: '#fff', borderRadius: 8, padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div className="panel-header" style={{ marginBottom: '0.5rem' }}>
              <h3><Map size={16} style={{ marginRight: 6 }} /> Place Search &amp; Territory Plotter</h3>
            </div>
            <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
              Select a driver and type a colony/ward name in Nashik. Click <strong>Search &amp; Plot</strong> to automatically locate coordinates.
            </p>

            <form onSubmit={handleAssignTerritorySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Select Driver</label>
                <select
                  className="form-select"
                  value={targetDriverId}
                  onChange={(e) => setTargetDriverId(e.target.value)}
                >
                  {driverTerritories.map((t) => (
                    <option key={t.driverId} value={t.driverId}>
                      {t.driverName} ({t.driverId})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Colony / Place Name in Nashik</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Gangapur Road, CIDCO, Panchavati"
                    value={colonyName}
                    onChange={(e) => setColonyName(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleGeocodeLocation}
                    disabled={isSearchingGeocode}
                    style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <Search size={14} className={isSearchingGeocode ? 'spin' : ''} />
                    {isSearchingGeocode ? 'Locating...' : 'Search & Plot'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div className="form-group">
                  <label className="form-label">Min Lat</label>
                  <input
                    type="number"
                    step="0.0001"
                    className="form-input"
                    value={minLat}
                    onChange={(e) => setMinLat(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Max Lat</label>
                  <input
                    type="number"
                    step="0.0001"
                    className="form-input"
                    value={maxLat}
                    onChange={(e) => setMaxLat(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Min Lng</label>
                  <input
                    type="number"
                    step="0.0001"
                    className="form-input"
                    value={minLng}
                    onChange={(e) => setMinLng(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Max Lng</label>
                  <input
                    type="number"
                    step="0.0001"
                    className="form-input"
                    value={maxLng}
                    onChange={(e) => setMaxLng(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '0.25rem' }}>
                <Plus size={14} style={{ marginRight: 4 }} /> Save Territory Boundaries
              </button>
            </form>
          </div>

          {/* Route Summary */}
          <div className="panel ro-details-panel" style={{ background: '#fff', borderRadius: 8, padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div className="panel-header" style={{ marginBottom: '0.5rem' }}>
              <h3><Info size={14} style={{ marginRight: 6 }} /> Route Summary</h3>
            </div>
            <div className="panel-body">
              {optimizedRoutes.length === 0 ? (
                <p className="text-muted" style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.85rem' }}>
                  Click <strong>"Optimize Fleet Routes"</strong> to generate driving routes.
                </p>
              ) : selectedDriverId === 'ALL' ? (
                <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th>Driver</th>
                      <th>Bins</th>
                      <th>Dist</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {optimizedRoutes.map((r) => (
                      <tr key={r.vehicleId}>
                        <td style={{ fontWeight: 600 }}>{r.driver?.name || r.vehicleId}</td>
                        <td>{r.assignedBinCount}</td>
                        <td>{r.totalDistanceKm} km</td>
                        <td>{r.totalDurationMinutes} min</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : selectedRoute ? (
                <div className="ro-driver-detail" style={{ fontSize: '0.85rem' }}>
                  <div className="ro-detail-kv"><span>Driver</span><strong>{selectedRoute.driver?.name}</strong></div>
                  <div className="ro-detail-kv"><span>Distance</span><strong>{selectedRoute.totalDistanceKm} km</strong></div>
                  <div className="ro-detail-kv"><span>Duration</span><strong>{selectedRoute.totalDurationMinutes} mins</strong></div>
                  <div className="ro-detail-kv"><span>Payload</span><strong>{selectedRoute.driver?.assignedLoadKg} kg</strong></div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Manual Dispatch Override Panel */}
          <div className="panel ro-override-panel" style={{ background: '#fff', borderRadius: 8, padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div className="panel-header" style={{ marginBottom: '0.5rem' }}>
              <h3><Settings size={14} style={{ marginRight: 6 }} /> Manual Dispatch Override</h3>
            </div>
            <div className="panel-body">
              {overrideMsg && (
                <div className="ro-override-success" style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                  <CheckCircle size={13} /> {overrideMsg}
                </div>
              )}

              <form onSubmit={handleReassignBinSubmit} className="ro-override-form" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <select
                  className="form-select"
                  value={reassignBinId}
                  onChange={(e) => setReassignBinId(e.target.value)}
                  required
                >
                  <option value="">Select Bin…</option>
                  {generatedBins.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.id} ({b.ward || 'Nashik'})
                    </option>
                  ))}
                </select>
                <select
                  className="form-select"
                  value={reassignBinDriverId}
                  onChange={(e) => setReassignBinDriverId(e.target.value)}
                  required
                >
                  <option value="">Select Target Driver…</option>
                  {dbDrivers.map((d) => (
                    <option key={d.id || d.vehicle_id} value={d.id || d.vehicle_id}>
                      {d.driver_name || d.driverName || d.id} ({d.id || d.vehicle_id})
                    </option>
                  ))}
                </select>
                <button type="submit" className="btn btn-secondary btn-sm">
                  Reassign Bin
                </button>
              </form>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}