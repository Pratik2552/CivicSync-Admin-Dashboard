import React, { useState, useMemo, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Polyline, Polygon, Rectangle, Marker, Popup, useMap } from 'react-leaflet';
import { RefreshCw, MapPin, Settings, Info, CheckCircle, AlertTriangle, Map, Search, Plus, Maximize2, Minimize2, Truck, Navigation, Check, X, UserCheck } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { optimizeFleetRoutes, reassignBin, getVehiclesAdmin, getBins, getKMLAdminData, toggleKMLBinCollection, assignDriverToKMLZone } from '../services/api.js';
import './RouteOptimizer.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const PALETTE_COLORS = ['#2563eb', '#16a34a', '#d97706', '#7c3aed', '#db2777', '#0891b2'];

// Helper component — only fits bounds on first load and after explicit optimization, never during polling
function MapRecenter({ bounds, isFullscreen }) {
  const map = useMap();
  const hasFitRef = useRef(false);
  const prevBoundsRef = useRef(null);
  const prevFullscreenRef = useRef(isFullscreen);

  // Only invalidate size when fullscreen actually changes
  useEffect(() => {
    const fullscreenChanged = prevFullscreenRef.current !== isFullscreen;
    prevFullscreenRef.current = isFullscreen;
    if (fullscreenChanged) {
      const timer = setTimeout(() => { map.invalidateSize(); }, 150);
      return () => clearTimeout(timer);
    }
  }, [isFullscreen, map]);

  useEffect(() => {
    if (!bounds) return;

    // Detect if bounds actually changed (i.e., user ran optimization or first load)
    const boundsKey = `${bounds.minLat},${bounds.maxLat},${bounds.minLng},${bounds.maxLng}`;
    const prevKey = prevBoundsRef.current;
    prevBoundsRef.current = boundsKey;

    // Skip if bounds haven't changed since last fit (polling didn't change them)
    if (hasFitRef.current && boundsKey === prevKey) return;

    map.fitBounds([
      [bounds.minLat, bounds.minLng],
      [bounds.maxLat, bounds.maxLng]
    ], { padding: [30, 30] });
    hasFitRef.current = true;
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
  const [routeViewMode, setRouteViewMode] = useState('ALL'); // 'BEFORE' (Old Route), 'AFTER' (New Route), 'ALL' (Both)

  const mapColumnRef = useRef(null);

  // Form State: Territory Assignment & Search
  const [targetDriverId, setTargetDriverId] = useState('');
  const [colonyName, setColonyName] = useState('');
  const [minLat, setMinLat] = useState('19.8800');
  const [maxLat, setMaxLat] = useState('19.9200');
  const [minLng, setMinLng] = useState('74.4700');
  const [maxLng, setMaxLng] = useState('74.5000');

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

  const [kmlData, setKmlData] = useState(null);

  // Form State: Driver to Zone Assignment
  const [selectedDriverForZone, setSelectedDriverForZone] = useState('');
  const [selectedZoneForAssign, setSelectedZoneForAssign] = useState('ZONE A');

  const createGarbageTruckIcon = (label, color = '#2563eb') => {
    return L.divIcon({
      className: 'custom-garbage-truck-marker',
      html: `<div style="background:${color};color:white;padding:4px 8px;border-radius:16px;border:2px solid white;box-shadow:0 3px 8px rgba(0,0,0,0.35);font-size:12px;font-weight:bold;white-space:nowrap;display:flex;align-items:center;gap:4px;">🚛 <span>${label}</span></div>`,
      iconSize: [110, 30],
      iconAnchor: [55, 15],
    });
  };

  const handleAssignDriverToZone = async (e) => {
    e.preventDefault();
    if (!selectedDriverForZone || !selectedZoneForAssign) {
      setErrorMsg('Please select a driver and a zone.');
      return;
    }

    try {
      const selectedDriverObj = dbDrivers.find(d => String(d.id || d.vehicle_id) === String(selectedDriverForZone));
      const driverName = selectedDriverObj?.driver_name || selectedDriverObj?.driverName || `Driver ${selectedDriverForZone}`;
      const licensePlate = selectedDriverObj?.license_plate || 'MH-15-XX-9999';

      const res = await assignDriverToKMLZone(selectedDriverForZone, driverName, licensePlate, selectedZoneForAssign);
      if (res && res.success) {
        setStatusMsg(`Driver ${driverName} (${licensePlate}) assigned to ${selectedZoneForAssign}!`);
        // Refresh KML data
        const freshKML = await getKMLAdminData();
        if (freshKML && freshKML.success) setKmlData(freshKML);
        setTimeout(() => setStatusMsg(''), 5000);
      }
    } catch (err) {
      console.error('Failed to assign driver to zone:', err);
      setErrorMsg('Failed to assign driver to zone.');
    }
  };

  const handleToggleBin = async (binName, currentStatus) => {
    try {
      const res = await toggleKMLBinCollection(binName, !currentStatus);
      if (res && res.success) {
        setStatusMsg(`Bin ${binName} collection status changed to ${!currentStatus ? 'YES (Collected)' : 'NO (Pending)'}`);
        // Refresh KML data
        const freshKML = await getKMLAdminData();
        if (freshKML && freshKML.success) setKmlData(freshKML);
        setTimeout(() => setStatusMsg(''), 4000);
      }
    } catch (err) {
      console.error('Failed to toggle bin collection:', err);
    }
  };

  // Load Live Drivers, Bins & KML Data from Database on Mount
  useEffect(() => {
    async function loadDataAndTelemetry() {
      try {
        const kmlRes = await getKMLAdminData().catch(() => null);
        if (kmlRes && kmlRes.success) {
          setKmlData(kmlRes);
        }

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
            
            const centerLat = parseFloat(v.latitude || v.min_lat || (kmlRes?.depot?.lat || 19.892379));
            const centerLng = parseFloat(v.longitude || v.min_lng || (kmlRes?.depot?.lng || 74.484606));

            return {
              driverId: vId,
              driverName: dName,
              zoneName: v.territory_name || v.ward || `Territory ${vId}`,
              color: PALETTE_COLORS[idx % PALETTE_COLORS.length],
              bounds: {
                minLat: parseFloat(v.min_lat || (centerLat - 0.025).toFixed(4)),
                maxLat: parseFloat(v.max_lat || (centerLat + 0.025).toFixed(4)),
                minLng: parseFloat(v.min_lng || (centerLng - 0.025).toFixed(4)),
                maxLng: parseFloat(v.max_lng || (centerLng + 0.025).toFixed(4)),
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

        const freshKML = await getKMLAdminData().catch(() => null);
        if (freshKML && freshKML.success) {
          setKmlData(freshKML);
        }
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
      const depotLat = kmlData?.depot?.lat || 19.892379;
      const depotLng = kmlData?.depot?.lng || 74.484606;

      const vehiclesPayload = driverTerritories.map((t) => ({
        vehicleId: t.driverId,
        driverName: t.driverName,
        zoneName: t.zoneName,
        capacity: 1000,
        currentLoad: 0,
        minLat: t.bounds.minLat,
        maxLat: t.bounds.maxLat,
        minLng: t.bounds.minLng,
        maxLng: t.bounds.maxLng,
      }));

      // Combine KML Bins and Database Bins
      const kmlBinsFormatted = (kmlData?.bins || []).map((b) => ({
        id: b.name || b.id,
        latitude: parseFloat(b.lat),
        longitude: parseFloat(b.lng),
        fill_level: b.isCollected ? 0 : 85,
        current_weight_kg: 250,
        ward: b.zone || 'KML Zone'
      }));

      // Ensure ONLY KML bins are optimized, to isolate territories perfectly
      const binsToOptimize = [...kmlBinsFormatted];

      const result = await optimizeFleetRoutes(depotLat, depotLng, vehiclesPayload, binsToOptimize);

      if (result && result.routes && result.routes.length > 0) {
        setOptimizedRoutes(result.routes);
        setRouteViewMode('AFTER'); // Automatically switch view mode to After Optimization!
        setStatusMsg(`Successfully optimized routes for ${result.routes.length} driver territories!`);

        // Compute bounding box to auto-center map on new routes
        let minL = 90, maxL = -90, minG = 180, maxG = -180;
        result.routes.forEach(r => {
          if (r.geometry && r.geometry.coordinates) {
            r.geometry.coordinates.forEach(([lng, lat]) => {
              if (lat < minL) minL = lat;
              if (lat > maxL) maxL = lat;
              if (lng < minG) minG = lng;
              if (lng > maxG) maxG = lng;
            });
          }
        });

        if (minL < maxL && minG < maxG) {
          setActiveMapFocusBounds({ minLat: minL - 0.005, maxLat: maxL + 0.005, minLng: minG - 0.005, maxLng: maxG + 0.005 });
        }
      } else if (result && result.error) {
        setErrorMsg(result.error);
      } else {
        setErrorMsg('No routes generated. Please check driver territory bounds or bins.');
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
            Assign territories to drivers, then click <strong>Optimize Fleet Routes</strong> to compute the shortest collection path per vehicle using <strong>Nearest Neighbour + 2-opt (CVRP)</strong>. Routes are geofenced to each driver's territory.
          </p>
        </div>
        {/* Algorithm Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0.5rem 1rem',
          background: 'linear-gradient(135deg,#1e40af,#6d28d9)', borderRadius: 8,
          color: '#fff', fontSize: '0.8rem', fontWeight: 700, boxShadow: '0 2px 8px rgba(37,99,235,0.4)'
        }}>
          <Navigation size={14} />
          Algorithm: Nearest Neighbour + 2-opt · Territory-Geofenced CVRP
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
      <div className="ro-body">
        
        {/* LEFT: Map Panel with Fullscreen Wrapper */}
        <div 
          ref={mapColumnRef} 
          className={`ro-map-col ${isFullscreen ? 'ro-fullscreen-mode' : ''}`}
        >
          <div className="panel ro-map-panel-box">
            <div className="panel-header" style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3><MapPin size={16} style={{ marginRight: 6 }} /> Territory Geofences &amp; Fleet Map</h3>
                <small className="text-muted">Depot: Nashik Central ({kmlData?.depot?.lat || 19.89518}, {kmlData?.depot?.lng || 74.48668})</small>
              </div>

              {/* Before vs After Optimization Route View Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#f1f5f9', padding: '3px 4px', borderRadius: 8, border: '1px solid #cbd5e1' }}>
                <button
                  type="button"
                  onClick={() => setRouteViewMode('BEFORE')}
                  title="Show original baseline KML path"
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    borderRadius: 6,
                    border: 'none',
                    cursor: 'pointer',
                    background: routeViewMode === 'BEFORE' ? '#2563eb' : 'transparent',
                    color: routeViewMode === 'BEFORE' ? '#ffffff' : '#475569',
                    boxShadow: routeViewMode === 'BEFORE' ? '0 1px 4px rgba(37,99,235,0.3)' : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  📍 Before Optimization (Old Path)
                </button>

                <button
                  type="button"
                  onClick={() => setRouteViewMode('AFTER')}
                  title="Show newly calculated NN + 2-opt shortest route"
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    borderRadius: 6,
                    border: 'none',
                    cursor: 'pointer',
                    background: routeViewMode === 'AFTER' ? '#16a34a' : 'transparent',
                    color: routeViewMode === 'AFTER' ? '#ffffff' : '#475569',
                    boxShadow: routeViewMode === 'AFTER' ? '0 1px 4px rgba(22,163,74,0.3)' : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  ⚡ After Optimization (New Route)
                </button>

                <button
                  type="button"
                  onClick={() => setRouteViewMode('ALL')}
                  title="Overlay both old and new routes on map"
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    borderRadius: 6,
                    border: 'none',
                    cursor: 'pointer',
                    background: routeViewMode === 'ALL' ? '#0f172a' : 'transparent',
                    color: routeViewMode === 'ALL' ? '#ffffff' : '#475569',
                    boxShadow: routeViewMode === 'ALL' ? '0 1px 4px rgba(15,23,42,0.3)' : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  👁️ Show Both
                </button>
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
                  center={kmlData?.depot ? [kmlData.depot.lat, kmlData.depot.lng] : [19.892379, 74.484606]}
                  zoom={14}
                  style={{ height: '100%', width: '100%', borderRadius: 6 }}
                >
                  <TileLayer
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
                  />

                  <MapRecenter bounds={activeMapFocusBounds} isFullscreen={isFullscreen} />

                  {/* KML 1. Official KML Zone Polygons (ZONE A & ZONE B) */}
                  {kmlData?.zones?.map((zone) => {
                    const isZoneA = zone.name.includes('ZONE A');
                    const color = isZoneA ? '#2563eb' : '#16a34a';
                    return (
                      <Polygon
                        key={`kml-zone-${zone.id}`}
                        positions={zone.coordinates}
                        pathOptions={{
                          color: color,
                          weight: 3,
                          fillColor: color,
                          fillOpacity: 0.18,
                          dashArray: '4,4',
                        }}
                      >
                        <Popup>
                          <div style={{ fontSize: '0.85rem' }}>
                            <strong style={{ color }}>📍 {zone.name}</strong><br />
                            <strong>Assigned Driver:</strong> {zone.assignedDriverName || 'Unassigned'}<br />
                            <strong>Vehicle Plate:</strong> {zone.assignedLicensePlate || 'MH-15-XX-0000'}
                          </div>
                        </Popup>
                      </Polygon>
                    );
                  })}

                  {/* KML 2. Official Marked Path Routes (Before Optimization) */}
                  {(routeViewMode === 'BEFORE' || routeViewMode === 'ALL') && kmlData?.routes?.map((route) => {
                    const isTruck1 = route.name.includes('TRUCK-001');
                    const isTruck2 = route.name.includes('TRUCK-002');
                    const color = isTruck1 ? '#2563eb' : isTruck2 ? '#9333ea' : '#d97706';
                    return (
                      <Polyline
                        key={`kml-route-${route.id}`}
                        positions={route.coordinates}
                        pathOptions={{
                          color: color,
                          weight: routeViewMode === 'ALL' ? 3.5 : 5,
                          opacity: routeViewMode === 'ALL' ? 0.5 : 0.85,
                          dashArray: routeViewMode === 'ALL' ? '6,6' : (route.name.includes('Google') ? '6,6' : null),
                        }}
                      >
                        <Popup>
                          <div>
                            <strong>📍 Original Route (Before Optimization)</strong><br />
                            Route: {route.name}
                          </div>
                        </Popup>
                      </Polyline>
                    );
                  })}

                  {/* KML 3. Pickup Bins / Stops (Green = YES Collected, Red = NO Pending) */}
                  {kmlData?.bins?.map((bin) => {
                    const isCollected = bin.isCollected;
                    const markerColor = isCollected ? '#16a34a' : '#dc2626';

                    return (
                      <CircleMarker
                        key={`kml-bin-${bin.id}`}
                        center={[bin.lat, bin.lng]}
                        radius={9}
                        pathOptions={{
                          color: '#ffffff',
                          fillColor: markerColor,
                          fillOpacity: 1,
                          weight: 2.5,
                        }}
                      >
                        <Popup>
                          <div style={{ fontSize: '0.85rem', textAlign: 'center' }}>
                            <strong>🗑️ {bin.name}</strong><br />
                            Zone: <strong>{bin.zone}</strong><br />
                            Status: <span style={{ 
                              fontWeight: 700, 
                              color: isCollected ? '#16a34a' : '#dc2626',
                              padding: '2px 6px',
                              borderRadius: 4,
                              background: isCollected ? '#dcfce7' : '#fee2e2'
                            }}>
                              {isCollected ? '✅ COLLECTED (YES)' : '🔴 PENDING (NO)'}
                            </span>
                            <div style={{ marginTop: 8 }}>
                              <button
                                onClick={() => handleToggleBin(bin.name, isCollected)}
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '0.75rem',
                                  borderRadius: 4,
                                  border: 'none',
                                  cursor: 'pointer',
                                  background: isCollected ? '#dc2626' : '#16a34a',
                                  color: '#fff',
                                  fontWeight: 600,
                                }}
                              >
                                {isCollected ? 'Mark as NO (Pending)' : 'Mark as YES (Collected)'}
                              </button>
                            </div>
                          </div>
                        </Popup>
                      </CircleMarker>
                    );
                  })}

                  {/* KML 4. Depot Location */}
                  {kmlData?.depot && (
                    <React.Fragment>
                      <CircleMarker
                        center={[kmlData.depot.lat, kmlData.depot.lng]}
                        radius={12}
                        pathOptions={{
                          color: '#ffffff',
                          fillColor: '#0f172a',
                          fillOpacity: 1,
                          weight: 3,
                        }}
                      >
                        <Popup>
                          <div style={{ textAlign: 'center' }}>
                            <strong>🏢 CENTRAL DEPOT</strong><br />
                            <small>Start location for all vehicles</small>
                          </div>
                        </Popup>
                      </CircleMarker>

                      <CircleMarker
                        center={[kmlData.depot.lat + 0.015, kmlData.depot.lng + 0.025]}
                        radius={12}
                        pathOptions={{
                          color: '#ffffff',
                          fillColor: '#b91c1c', // red color for Dump Yard
                          fillOpacity: 1,
                          weight: 3,
                        }}
                      >
                        <Popup>
                          <div style={{ textAlign: 'center' }}>
                            <strong>🏭 DUMP YARD</strong><br />
                            <small>All vehicles return here after collection</small>
                          </div>
                        </Popup>
                      </CircleMarker>
                    </React.Fragment>
                  )}

                  {/* KML 5. Assigned Garbage Trucks on Map */}
                  {kmlData?.trucks?.map((truck) => {
                    const isZoneA = truck.zone === 'ZONE A';
                    const truckColor = isZoneA ? '#2563eb' : '#16a34a';
                    return (
                      <Marker
                        key={`garbage-truck-${truck.id}`}
                        position={[truck.lat, truck.lng]}
                        icon={createGarbageTruckIcon(`${truck.driverName || 'Driver'} (${truck.zone})`, truckColor)}
                      >
                        <Popup>
                          <div style={{ fontSize: '0.85rem' }}>
                            <strong style={{ color: truckColor }}>🚛 Garbage Truck: {truck.licensePlate || truck.id}</strong><br />
                            <strong>Assigned Driver:</strong> {truck.driverName}<br />
                            <strong>Territory:</strong> {truck.zone}<br />
                            <strong>Capacity:</strong> {truck.capacityKg || 1000} kg<br />
                            <strong>Status:</strong> {truck.status || 'Active On Duty'}
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}

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
                  {/* HIDDEN: As requested, only showing KML coordinates now */}
                  {generatedBins.length > 0 && null}

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

                  {/* 4. Render New Optimized Driving Routes (After Optimization) */}
                  {(routeViewMode === 'AFTER' || routeViewMode === 'ALL') && visibleRoutes.map((route, idx) => {
                    const polylineCoords = parsePolylineCoords(route.geometry);
                    const territory = driverTerritories.find((t) => String(t.driverId) === String(route.vehicleId));
                    const color = territory ? territory.color : PALETTE_COLORS[idx % PALETTE_COLORS.length];

                    return (
                      <React.Fragment key={`opt-route-${route.vehicleId || idx}`}>
                        {polylineCoords.length > 0 && (
                          <>
                            {/* Dark glow background stroke */}
                            <Polyline
                              positions={polylineCoords}
                              pathOptions={{ color: '#0f172a', weight: 8, opacity: 0.25 }}
                            />
                            {/* Primary bright polyline */}
                            <Polyline
                              positions={polylineCoords}
                              pathOptions={{ color: color, weight: 5.5, opacity: 0.95 }}
                            >
                              <Popup>
                                <div style={{ fontSize: '0.85rem' }}>
                                  <strong style={{ color }}>⚡ New Shortest Optimized Route</strong><br />
                                  <strong>Driver:</strong> {route.driver?.name}<br />
                                  <strong>Plate:</strong> {route.driver?.licensePlate}<br />
                                  <strong>Assigned Bins:</strong> {route.assignedBinCount} stops<br />
                                  <strong>Distance:</strong> {route.totalDistanceKm} km<br />
                                  <strong>Duration:</strong> {route.totalDurationMinutes} min<br />
                                  <strong>Algorithm:</strong> {route.algorithm || 'Nearest Neighbour + 2-opt'}
                                </div>
                              </Popup>
                            </Polyline>
                          </>
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
          
          {/* KML Live Bin Collection Tracker Card */}
          <div className="panel" style={{ background: '#fff', borderRadius: 8, padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div className="panel-header" style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}><CheckCircle size={16} style={{ marginRight: 6, color: '#16a34a' }} /> KML Collection Tracker</h3>
              <span className="badge badge-primary" style={{ fontSize: '0.75rem' }}>
                {kmlData?.bins?.filter(b => b.isCollected).length || 0} / {kmlData?.bins?.length || 0} Collected
              </span>
            </div>

            <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
              Bins on the marked path. Toggle <strong>Yes / No</strong> to simulate or monitor live collection. Collected bins turn <strong style={{ color: '#16a34a' }}>GREEN</strong> on map.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '240px', overflowY: 'auto' }}>
              {kmlData?.bins?.map(bin => {
                const isCollected = bin.isCollected;
                return (
                  <div key={`side-bin-${bin.id}`} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.5rem 0.75rem',
                    borderRadius: 6,
                    border: '1px solid #e2e8f0',
                    background: isCollected ? '#f0fdf4' : '#f8fafc',
                  }}>
                    <div>
                      <strong style={{ fontSize: '0.85rem' }}>{bin.name}</strong>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: 8 }}>({bin.zone})</span>
                    </div>

                    <button
                      onClick={() => handleToggleBin(bin.name, isCollected)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '0.3rem 0.6rem',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        borderRadius: 4,
                        border: 'none',
                        cursor: 'pointer',
                        background: isCollected ? '#16a34a' : '#cbd5e1',
                        color: isCollected ? '#ffffff' : '#334155',
                      }}
                    >
                      {isCollected ? <Check size={13} /> : <X size={13} />}
                      {isCollected ? 'YES' : 'NO'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Assign Driver to Territory Zone Card (Strict 1:1 Constraint) */}
          <div className="panel" style={{ background: '#fff', borderRadius: 8, padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderTop: '4px solid #2563eb' }}>
            <div className="panel-header" style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}><UserCheck size={16} style={{ marginRight: 6, color: '#2563eb' }} /> Assign Driver to Zone</h3>
              <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>Strict 1 Driver Per Zone</span>
            </div>
            
            <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
              Assign one exclusive driver per zone. The assigned driver will appear as a <strong>Garbage Truck 🚛</strong> on the map.
            </p>

            {/* Current 1:1 Live Assignments Summary */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '0.6rem 0.8rem', marginBottom: '0.75rem', fontSize: '0.8rem' }}>
              <div style={{ fontWeight: 700, marginBottom: 4, color: '#334155' }}>Current Zone Assignments (1:1):</div>
              {kmlData?.zones?.map((z) => {
                const isA = z.name.includes('ZONE A');
                return (
                  <div key={`current-assign-${z.name}`} style={{ display: 'flex', justifyBetween: 'space-between', alignItems: 'center', margin: '2px 0' }}>
                    <span style={{ color: isA ? '#2563eb' : '#16a34a', fontWeight: 600 }}>
                      {isA ? '📍 Zone 1 (Zone A)' : '📍 Zone 2 (Zone B)'}:
                    </span>
                    <strong style={{ marginLeft: 'auto' }}>
                      👤 {z.assignedDriverName || 'Unassigned'} ({z.assignedLicensePlate || 'MH-15-XX'})
                    </strong>
                  </div>
                );
              })}
            </div>

            <form onSubmit={handleAssignDriverToZone} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Select Driver</label>
                <select
                  className="form-select"
                  value={selectedDriverForZone}
                  onChange={(e) => setSelectedDriverForZone(e.target.value)}
                  required
                >
                  <option value="">-- Choose Driver from Database --</option>
                  {dbDrivers.map((d) => {
                    const vId = d.id || d.vehicle_id;
                    const dName = d.driver_name || d.driverName || 'Driver';
                    const plate = d.license_plate || vId;
                    const currentAssignedZone = kmlData?.zones?.find(z => z.vehicleId === vId || z.assignedDriverName === dName)?.name || '';

                    return (
                      <option key={vId} value={vId}>
                        👤 {dName} ({plate}) {currentAssignedZone ? `[Assigned: ${currentAssignedZone}]` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Assign Exclusive Zone</label>
                <select
                  className="form-select"
                  value={selectedZoneForAssign}
                  onChange={(e) => setSelectedZoneForAssign(e.target.value)}
                  required
                >
                  <option value="ZONE A">📍 Zone 1 (Zone A - North Territory)</option>
                  <option value="ZONE B">📍 Zone 2 (Zone B - South Territory)</option>
                </select>
              </div>

              <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Truck size={16} /> Assign Exclusive Driver &amp; Show Truck on Map
              </button>
            </form>
          </div>
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

          {/* Algorithm Info Panel */}
          <div className="panel" style={{
            background: 'linear-gradient(135deg,#0f172a,#1e3a5f)',
            borderRadius: 8, padding: '1rem',
            boxShadow: '0 2px 12px rgba(37,99,235,0.25)',
            color: '#e2e8f0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.6rem' }}>
              <Navigation size={16} style={{ color: '#60a5fa' }} />
              <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#93c5fd' }}>Algorithm: Nearest Neighbour + 2-opt (CVRP)</span>
            </div>
            <div style={{ fontSize: '0.78rem', lineHeight: 1.65, color: '#cbd5e1' }}>
              <p style={{ marginBottom: '0.4rem' }}>
                <strong style={{ color: '#38bdf8' }}>Step 1 — Territory Filter:</strong> Each vehicle only sees bins strictly inside its bounding box.
              </p>
              <p style={{ marginBottom: '0.4rem' }}>
                <strong style={{ color: '#38bdf8' }}>Step 2 — Nearest Neighbour:</strong> Start at the depot; always visit the closest unvisited bin next. Builds a complete tour in O(n²).
              </p>
              <p style={{ marginBottom: '0.4rem' }}>
                <strong style={{ color: '#38bdf8' }}>Step 3 — 2-opt Improvement:</strong> Repeatedly reverses route segments to eliminate crossing paths until no shorter tour is found.
              </p>
              <p style={{ marginBottom: 0 }}>
                <strong style={{ color: '#38bdf8' }}>Result:</strong> Typically within 5–15% of the mathematically optimal route, computed in milliseconds.
              </p>
            </div>
          </div>

          {/* Route Summary */}
          <div className="panel ro-details-panel" style={{ background: '#fff', borderRadius: 8, padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div className="panel-header" style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}><Info size={14} style={{ marginRight: 6 }} /> Optimized Route Summary</h3>
              {optimizedRoutes.length > 0 && (
                <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>
                  {optimizedRoutes.length} route{optimizedRoutes.length !== 1 ? 's' : ''} computed
                </span>
              )}
            </div>
            <div className="panel-body">
              {optimizedRoutes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem 0.5rem' }}>
                  <Navigation size={28} style={{ color: '#94a3b8', marginBottom: 8 }} />
                  <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: 4 }}>
                    Click <strong>"Optimize Fleet Routes"</strong> to compute shortest paths.
                  </p>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    Routes will appear on the map as colored lines and are automatically sent to each driver's dashboard.
                  </p>
                </div>
              ) : selectedDriverId === 'ALL' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {optimizedRoutes.map((r, idx) => {
                    const territory = driverTerritories.find(t => String(t.driverId) === String(r.vehicleId));
                    const color = territory?.color || PALETTE_COLORS[idx % PALETTE_COLORS.length];
                    const loadPct = Math.round((r.driver?.assignedLoadKg / r.driver?.maxCapacityKg) * 100) || 0;
                    return (
                      <div key={r.vehicleId} style={{
                        border: `2px solid ${color}`,
                        borderRadius: 8, padding: '0.75rem',
                        background: `${color}08`,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: '0.85rem', color }}>
                            🚛 {r.driver?.name || r.vehicleId}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{r.driver?.licensePlate}</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem', fontSize: '0.78rem', marginBottom: 6 }}>
                          <div style={{ textAlign: 'center', background: '#f1f5f9', borderRadius: 4, padding: '0.3rem' }}>
                            <div style={{ fontWeight: 800, color: '#1e293b' }}>{r.assignedBinCount}</div>
                            <div style={{ color: '#64748b' }}>Bins</div>
                          </div>
                          <div style={{ textAlign: 'center', background: '#f1f5f9', borderRadius: 4, padding: '0.3rem' }}>
                            <div style={{ fontWeight: 800, color: '#1e293b' }}>{r.totalDistanceKm} km</div>
                            <div style={{ color: '#64748b' }}>Distance</div>
                          </div>
                          <div style={{ textAlign: 'center', background: '#f1f5f9', borderRadius: 4, padding: '0.3rem' }}>
                            <div style={{ fontWeight: 800, color: '#1e293b' }}>{r.totalDurationMinutes} min</div>
                            <div style={{ color: '#64748b' }}>ETA</div>
                          </div>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#475569', marginBottom: 4 }}>Payload: {r.driver?.assignedLoadKg} / {r.driver?.maxCapacityKg} kg</div>
                        <div style={{ height: 4, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min(100, loadPct)}%`, background: loadPct > 80 ? '#ef4444' : color, borderRadius: 4 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : selectedRoute ? (
                <div>
                  <div className="ro-driver-detail" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
                    <div className="ro-detail-kv"><span>Driver</span><strong>{selectedRoute.driver?.name}</strong></div>
                    <div className="ro-detail-kv"><span>Plate</span><strong>{selectedRoute.driver?.licensePlate}</strong></div>
                    <div className="ro-detail-kv"><span>Bins to Visit</span><strong>{selectedRoute.assignedBinCount}</strong></div>
                    <div className="ro-detail-kv"><span>Total Distance</span><strong>{selectedRoute.totalDistanceKm} km</strong></div>
                    <div className="ro-detail-kv"><span>Estimated Time</span><strong>{selectedRoute.totalDurationMinutes} mins</strong></div>
                    <div className="ro-detail-kv"><span>Payload Load</span><strong>{selectedRoute.driver?.assignedLoadKg} kg</strong></div>
                    <div className="ro-detail-kv"><span>Algorithm</span><strong style={{ color: '#2563eb', fontSize: '0.78rem' }}>{selectedRoute.algorithm}</strong></div>
                  </div>
                  {/* Ordered stop list */}
                  <div style={{ fontSize: '0.78rem', color: '#475569' }}>
                    <div style={{ fontWeight: 700, marginBottom: 6, color: '#1e293b' }}>📍 Optimized Stop Order:</div>
                    <ol style={{ paddingLeft: '1.2rem', lineHeight: 1.9 }}>
                      <li><strong>🏭 DEPOT</strong> (Start)</li>
                      {(selectedRoute.assignedBins || []).map((b, i) => (
                        <li key={b.id}>{b.id} — Fill: {b.fill_level || 0}% ({b.current_weight_kg || 250} kg)</li>
                      ))}
                      <li><strong>🏭 DEPOT</strong> (Return)</li>
                    </ol>
                  </div>
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