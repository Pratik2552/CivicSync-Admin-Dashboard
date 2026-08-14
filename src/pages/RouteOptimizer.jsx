import { useState, useMemo } from 'react'
import { MapContainer, TileLayer, CircleMarker, Polyline, Rectangle, Popup } from 'react-leaflet'
import { RefreshCw, MapPin, Settings, Info, CheckCircle } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { OPTIMIZED_ROUTES, TERRITORIES, ROUTE_COLORS } from '../data/routes.js'
import { BINS } from '../data/bins.js'
import { DRIVERS } from '../data/drivers.js'
import { optimizeFleetRoutes, reassignBin } from '../services/api.js'
import './RouteOptimizer.css'

// Fix Leaflet default icon issue in Vite
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const ALL_BINS_LIST = BINS.map(b => ({ value: b.id, label: `${b.id} — ${b.ward}` }))
const ACTIVE_DRIVERS = DRIVERS
  .filter(d => d.status !== 'maintenance')
  .map(d => ({ value: d.id, label: `${d.name} (${d.id})` }))

export default function RouteOptimizer() {
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [optimizeResult, setOptimizeResult] = useState(null)
  const [selectedDriverId, setSelectedDriverId] = useState('ALL')
  const [showZones, setShowZones] = useState({ 'Zone A': true, 'Zone B': true, 'Zone C': true })

  // Reassign state
  const [reassignBinId, setReassignBinId]       = useState('')
  const [reassignBinDriverId, setReassignBinDriverId] = useState('')
  const [reassignDriverId, setReassignDriverId] = useState('')
  const [reassignZone, setReassignZone]         = useState('')
  const [overrideMsg, setOverrideMsg]           = useState('')

  async function handleOptimize() {
    setIsOptimizing(true)
    setOptimizeResult(null)
    try {
      const result = await optimizeFleetRoutes()
      setOptimizeResult(result)
    } finally {
      setIsOptimizing(false)
    }
  }

  function toggleZone(zone) {
    setShowZones(prev => ({ ...prev, [zone]: !prev[zone] }))
  }

  async function handleReassignBin(e) {
    e.preventDefault()
    if (!reassignBinId || !reassignBinDriverId) return
    await reassignBin(reassignBinId, reassignBinDriverId)
    setOverrideMsg(`Bin ${reassignBinId} reassigned to ${reassignBinDriverId}. Override active — routes re-optimize on next cycle.`)
    setReassignBinId('')
    setReassignBinDriverId('')
    setTimeout(() => setOverrideMsg(''), 6000)
  }

  function handleReassignDriver(e) {
    e.preventDefault()
    if (!reassignDriverId || !reassignZone) return
    const drv = DRIVERS.find(d => d.id === reassignDriverId)
    setOverrideMsg(`Driver ${drv?.name} reassigned to ${reassignZone}. Override active — routes re-optimize on next cycle.`)
    setReassignDriverId('')
    setReassignZone('')
    setTimeout(() => setOverrideMsg(''), 6000)
  }

  // Compute which routes/territories to show
  const visibleRoutes = useMemo(() => {
    if (selectedDriverId === 'ALL') return OPTIMIZED_ROUTES
    return OPTIMIZED_ROUTES.filter(r => r.driverId === selectedDriverId)
  }, [selectedDriverId])

  const selectedRoute = useMemo(() =>
    OPTIMIZED_ROUTES.find(r => r.driverId === selectedDriverId) || null
  , [selectedDriverId])

  return (
    <div className="ro-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Fleet &amp; Route Optimizer</h1>
          <p className="page-subheading">Automated OSRM + OR-Tools optimization. Manual overrides available for emergencies.</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="ro-toolbar">
        <button
          id="btn-optimize-routes"
          className="btn btn-primary btn-lg"
          onClick={handleOptimize}
          disabled={isOptimizing}
        >
          <RefreshCw size={16} className={isOptimizing ? 'spin' : ''} />
          {isOptimizing ? 'Optimizing Routes…' : 'Optimize Fleet Routes'}
        </button>

        {optimizeResult && (
          <div className="ro-success-banner">
            <CheckCircle size={14} />
            Routes optimized — {optimizeResult.totalDistanceSaved} km saved today &middot; {optimizeResult.routesGenerated} routes active
          </div>
        )}

        <div className="ro-driver-select">
          <label className="form-label" htmlFor="driver-inspector">Inspect Driver Route</label>
          <select
            id="driver-inspector"
            className="form-select"
            value={selectedDriverId}
            onChange={e => setSelectedDriverId(e.target.value)}
          >
            <option value="ALL">All Drivers</option>
            {OPTIMIZED_ROUTES.map(r => (
              <option key={r.driverId} value={r.driverId}>
                {r.driverName} ({r.driverId})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main 2-column layout */}
      <div className="ro-body">
        {/* LEFT: Map */}
        <div className="ro-map-col">
          <div className="panel">
            <div className="panel-header">
              <h3><MapPin size={15} style={{ marginRight: 6 }} />Route Map</h3>
              <div className="ro-zone-toggles">
                {TERRITORIES.map(t => (
                  <label key={t.zone} className="ro-zone-check">
                    <input
                      type="checkbox"
                      checked={showZones[t.zone]}
                      onChange={() => toggleZone(t.zone)}
                    />
                    <span className="ro-zone-dot" style={{ background: t.color }} />
                    {t.zone}
                  </label>
                ))}
              </div>
            </div>

            <div className="ro-map-wrapper">
              <MapContainer
                center={[18.5204, 73.8567]}
                zoom={11}
                style={{ height: 480, width: '100%' }}
              >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                  attribution='&copy; <a href="https://carto.com">CARTO</a>'
                />

                {/* Territory geofences */}
                {TERRITORIES.map(t => (
                  showZones[t.zone] &&
                  (selectedDriverId === 'ALL' || selectedRoute?.zone === t.zone) && (
                    <Rectangle
                      key={t.zone}
                      bounds={[
                        [t.bounds.minLat, t.bounds.minLng],
                        [t.bounds.maxLat, t.bounds.maxLng],
                      ]}
                      pathOptions={{
                        color: t.color, weight: 1.5,
                        fillColor: t.color, fillOpacity: 0.07,
                        dashArray: '4,4',
                      }}
                    >
                      <Popup><strong>{t.label}</strong></Popup>
                    </Rectangle>
                  )
                ))}

                {/* Route polylines + waypoint markers */}
                {visibleRoutes.map(route => {
                  const color = ROUTE_COLORS[route.driverId] || '#555'
                  const latlngs = route.waypoints.map(wp => [wp.lat, wp.lng])
                  return (
                    <span key={route.driverId}>
                      <Polyline positions={latlngs} pathOptions={{ color, weight: 3, opacity: 0.85 }} />
                      {route.waypoints.map((wp, i) => (
                        <CircleMarker
                          key={`${route.driverId}-${i}`}
                          center={[wp.lat, wp.lng]}
                          radius={wp.type === 'depot' ? 9 : 6}
                          pathOptions={{
                            color: wp.type === 'depot' ? '#0F2744' : color,
                            fillColor: wp.type === 'depot' ? '#0F2744' : '#fff',
                            fillOpacity: 1,
                            weight: 2,
                          }}
                        >
                          <Popup>
                            {wp.type === 'depot'
                              ? <><strong>{wp.label}</strong><br />{route.driverName}</>
                              : <><strong>{wp.binId}</strong><br />Stop #{wp.seq}<br />{route.driverName}</>
                            }
                          </Popup>
                        </CircleMarker>
                      ))}
                    </span>
                  )
                })}
              </MapContainer>

              {/* Legend */}
              <div className="ro-legend">
                <span className="ro-legend-item">
                  <span className="ro-legend-dot" style={{ background: '#0F2744' }} />Depot
                </span>
                {OPTIMIZED_ROUTES.map(r => (
                  <span key={r.driverId} className="ro-legend-item">
                    <span className="ro-legend-dot" style={{ background: ROUTE_COLORS[r.driverId] }} />
                    {r.driverName}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Details + Override */}
        <div className="ro-details-col">
          {/* Route Details */}
          <div className="panel ro-details-panel">
            <div className="panel-header">
              <h3><Info size={14} style={{ marginRight: 6 }} />Route Details</h3>
            </div>
            <div className="panel-body">
              {selectedDriverId === 'ALL' ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Driver</th>
                      <th>Zone</th>
                      <th>Bins</th>
                      <th>Dist</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {OPTIMIZED_ROUTES.map(r => (
                      <tr key={r.driverId}>
                        <td style={{ fontWeight: 500 }}>{r.driverName}</td>
                        <td>{r.zone}</td>
                        <td>{r.totalBins}</td>
                        <td>{r.estimatedDistance} km</td>
                        <td>{r.estimatedDuration} min</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : selectedRoute ? (
                <div className="ro-driver-detail">
                  <div className="ro-detail-kv"><span>Driver</span><strong>{selectedRoute.driverName}</strong></div>
                  <div className="ro-detail-kv"><span>Zone</span><strong>{selectedRoute.zone}</strong></div>
                  <div className="ro-detail-kv"><span>Estimated Distance</span><strong>{selectedRoute.estimatedDistance} km</strong></div>
                  <div className="ro-detail-kv"><span>Estimated Duration</span><strong>{selectedRoute.estimatedDuration} min</strong></div>
                  <div className="ro-detail-kv"><span>Total Bins</span><strong>{selectedRoute.totalBins}</strong></div>
                  <div className="divider" />
                  <div className="ro-wp-title">Waypoint Sequence</div>
                  <ol className="ro-wp-list">
                    {selectedRoute.waypoints.map((wp, i) => (
                      <li key={i} className={`ro-wp-item ${wp.type}`}>
                        {wp.type === 'depot'
                          ? <span className="ro-wp-depot">{wp.label}</span>
                          : <span>{wp.binId} <span className="text-muted">— Stop #{wp.seq}</span></span>
                        }
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
            </div>
          </div>

          {/* Manual Dispatch Override */}
          <div className="panel ro-override-panel">
            <div className="panel-header">
              <h3><Settings size={14} style={{ marginRight: 6 }} />Manual Dispatch Override</h3>
            </div>
            <div className="panel-body">
              <p className="ro-override-note">
                ⚠ Emergency override. Routes will be re-optimized on next scheduled cycle.
              </p>

              {overrideMsg && (
                <div className="ro-override-success">
                  <CheckCircle size={13} /> {overrideMsg}
                </div>
              )}

              <div className="ro-override-section">
                <h4>Reassign Bin</h4>
                <form onSubmit={handleReassignBin} className="ro-override-form">
                  <select
                    className="form-select"
                    value={reassignBinId}
                    onChange={e => setReassignBinId(e.target.value)}
                    required
                  >
                    <option value="">Select Bin…</option>
                    {ALL_BINS_LIST.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                  </select>
                  <select
                    className="form-select"
                    value={reassignBinDriverId}
                    onChange={e => setReassignBinDriverId(e.target.value)}
                    required
                  >
                    <option value="">Select Driver…</option>
                    {ACTIVE_DRIVERS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                  <button type="submit" className="btn btn-secondary btn-sm">Reassign Bin</button>
                </form>
              </div>

              <div className="ro-override-section">
                <h4>Reassign Driver Zone</h4>
                <form onSubmit={handleReassignDriver} className="ro-override-form">
                  <select
                    className="form-select"
                    value={reassignDriverId}
                    onChange={e => setReassignDriverId(e.target.value)}
                    required
                  >
                    <option value="">Select Driver…</option>
                    {DRIVERS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <select
                    className="form-select"
                    value={reassignZone}
                    onChange={e => setReassignZone(e.target.value)}
                    required
                  >
                    <option value="">Select Zone…</option>
                    {TERRITORIES.map(t => <option key={t.zone} value={t.zone}>{t.zone} — {t.label}</option>)}
                  </select>
                  <button type="submit" className="btn btn-secondary btn-sm">Reassign Driver</button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
