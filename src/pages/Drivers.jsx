import { useState, useMemo } from 'react'
import { Search, Plus, Edit, Eye, Truck, ChevronUp, ChevronDown } from 'lucide-react'
import { DRIVERS, getFleetStats } from '../data/drivers.js'
import StatusBadge from '../components/common/StatusBadge.jsx'
import Modal from '../components/common/Modal.jsx'
import './Drivers.css'

function LoadBar({ current, max }) {
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0
  const color = pct > 80 ? '#ef4444' : pct > 50 ? '#F59E0B' : '#22c55e'
  return (
    <div className="load-bar-wrap">
      <span className="load-text">{current.toLocaleString()} / {max.toLocaleString()} kg</span>
      <div className="load-bar-bg">
        <div className="load-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

function SortIcon({ field, sortField, sortDir }) {
  if (sortField !== field) return <span className="sort-placeholder" />
  return sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
}

export default function Drivers() {
  const stats = getFleetStats()

  const [search, setSearch]           = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [zoneFilter, setZoneFilter]   = useState('all')
  const [sortField, setSortField]     = useState('name')
  const [sortDir, setSortDir]         = useState('asc')
  const [editTerritory, setEditTerritory] = useState(null)
  const [terrForm, setTerrForm]       = useState({})
  const [terrSaved, setTerrSaved]     = useState(false)

  function handleSort(field) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const filtered = useMemo(() => {
    let data = DRIVERS.filter(d => {
      const s = search.toLowerCase()
      if (s && !d.name.toLowerCase().includes(s) && !d.licensePlate.toLowerCase().includes(s) && !d.phone.includes(s)) return false
      if (statusFilter !== 'all' && d.status !== statusFilter) return false
      if (zoneFilter !== 'all' && d.zone !== zoneFilter) return false
      return true
    })
    data = [...data].sort((a, b) => {
      let va = a[sortField] ?? ''
      let vb = b[sortField] ?? ''
      if (sortField === 'load') { va = a.currentLoad / a.maxCapacity; vb = b.currentLoad / b.maxCapacity }
      if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      return sortDir === 'asc' ? va - vb : vb - va
    })
    return data
  }, [search, statusFilter, zoneFilter, sortField, sortDir])

  const byResolution = [...DRIVERS].sort((a, b) => b.resolutionRate - a.resolutionRate)

  function openTerrEdit(driver) {
    setTerrForm({
      minLat: driver.territory.minLat,
      maxLat: driver.territory.maxLat,
      minLng: driver.territory.minLng,
      maxLng: driver.territory.maxLng,
      loadLimit: driver.maxCapacity,
    })
    setTerrSaved(false)
    setEditTerritory(driver)
  }

  function saveTerritory(e) {
    e.preventDefault()
    setTerrSaved(true)
    setTimeout(() => setEditTerritory(null), 1200)
  }

  function th(label, field, extra = '') {
    return (
      <th className={`sortable ${extra}`} onClick={() => handleSort(field)}>
        {label} <SortIcon field={field} sortField={sortField} sortDir={sortDir} />
      </th>
    )
  }

  return (
    <div className="drv-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Drivers &amp; Fleet Management</h1>
          <p className="page-subheading">Monitor, assign, and track all municipal waste collection vehicles and drivers.</p>
        </div>
        <div className="drv-kpis">
          <span className="drv-kpi active"><Truck size={13} /> Active: {stats.active}</span>
          <span className="drv-kpi transit">In Transit: {stats.inTransit}</span>
          <span className="drv-kpi maint">Maintenance: {stats.maintenance}</span>
        </div>
      </div>

      {/* ── SECTION 1: Fleet Status Table ── */}
      <div className="panel mb-6">
        <div className="panel-header">
          <h3>Fleet Status</h3>
          <div className="filters-row">
            <div className="search-bar">
              <Search size={14} />
              <input
                placeholder="Search driver or plate…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select className="form-select" style={{ width: 140 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="in_transit">In Transit</option>
              <option value="maintenance">Maintenance</option>
            </select>
            <select className="form-select" style={{ width: 120 }} value={zoneFilter} onChange={e => setZoneFilter(e.target.value)}>
              <option value="all">All Zones</option>
              <option value="Zone A">Zone A</option>
              <option value="Zone B">Zone B</option>
              <option value="Zone C">Zone C</option>
            </select>
            <button className="btn btn-outline btn-sm"><Plus size={13} /> Add Driver</button>
          </div>
        </div>

        <div className="data-table-wrap" style={{ borderRadius: 0, border: 'none', borderTop: '1px solid var(--color-border)' }}>
          <table className="data-table">
            <thead>
              <tr>
                {th('Driver Name', 'name')}
                <th>Phone</th>
                {th('License Plate', 'licensePlate')}
                {th('Load', 'load')}
                <th>Max Capacity</th>
                {th('Status', 'status')}
                {th('Zone', 'zone')}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => (
                <tr key={d.id}>
                  <td style={{ fontWeight: 600 }}>{d.name}</td>
                  <td className="text-muted">{d.phone}</td>
                  <td><span className="plate-tag">{d.licensePlate}</span></td>
                  <td style={{ minWidth: 160 }}><LoadBar current={d.currentLoad} max={d.maxCapacity} /></td>
                  <td className="text-muted">{d.maxCapacity.toLocaleString()} kg</td>
                  <td><StatusBadge status={d.status} /></td>
                  <td>{d.zone}</td>
                  <td>
                    <div className="drv-actions">
                      <button className="btn-icon" title="View details"><Eye size={14} /></button>
                      <button className="btn-icon" title="Edit driver"><Edit size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-secondary)' }}>No drivers match the current filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── SECTIONS 2+3 side by side ── */}
      <div className="drv-bottom-grid">

        {/* SECTION 2: Territory Assignment */}
        <div className="panel">
          <div className="panel-header">
            <h3>Territory Assignment</h3>
          </div>
          <div className="data-table-wrap" style={{ borderRadius: 0, border: 'none', borderTop: '1px solid var(--color-border)' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Driver</th>
                  <th>Zone</th>
                  <th>Lat Range</th>
                  <th>Lng Range</th>
                  <th>Load Limit</th>
                  <th>Edit</th>
                </tr>
              </thead>
              <tbody>
                {DRIVERS.map(d => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 500 }}>{d.name}</td>
                    <td>{d.zone}</td>
                    <td className="text-mono text-muted" style={{ fontSize: 11 }}>
                      {d.territory.minLat.toFixed(3)}–{d.territory.maxLat.toFixed(3)}
                    </td>
                    <td className="text-mono text-muted" style={{ fontSize: 11 }}>
                      {d.territory.minLng.toFixed(3)}–{d.territory.maxLng.toFixed(3)}
                    </td>
                    <td>{d.maxCapacity.toLocaleString()} kg</td>
                    <td>
                      <button className="btn btn-outline btn-sm" onClick={() => openTerrEdit(d)}>
                        <Edit size={12} /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 3: Performance Metrics */}
        <div className="panel">
          <div className="panel-header">
            <h3>Driver Performance Metrics</h3>
          </div>
          <div className="data-table-wrap" style={{ borderRadius: 0, border: 'none', borderTop: '1px solid var(--color-border)' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Driver</th>
                  <th>Trips</th>
                  <th>Weight Collected</th>
                  <th>Resolution Rate</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {byResolution.map(d => {
                  const rateColor = d.resolutionRate > 95
                    ? 'var(--color-green)'
                    : d.resolutionRate < 90
                      ? 'var(--color-danger)'
                      : 'var(--color-warning)'
                  return (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 500 }}>{d.name}</td>
                      <td className="text-mono">{d.completedTrips}</td>
                      <td className="text-mono">{d.totalWeight.toLocaleString()} kg</td>
                      <td>
                        <span style={{ fontWeight: 700, color: rateColor }}>
                          {d.resolutionRate}%
                        </span>
                      </td>
                      <td><StatusBadge status={d.status} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Territory Edit Modal */}
      {editTerritory && (
        <Modal title={`Edit Territory — ${editTerritory.name}`} onClose={() => setEditTerritory(null)} width={440}>
          <form onSubmit={saveTerritory}>
            <div className="form-2col">
              <div className="form-group">
                <label className="form-label">Min Latitude</label>
                <input type="number" step="0.0001" className="form-input"
                  value={terrForm.minLat}
                  onChange={e => setTerrForm(f => ({ ...f, minLat: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Max Latitude</label>
                <input type="number" step="0.0001" className="form-input"
                  value={terrForm.maxLat}
                  onChange={e => setTerrForm(f => ({ ...f, maxLat: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Min Longitude</label>
                <input type="number" step="0.0001" className="form-input"
                  value={terrForm.minLng}
                  onChange={e => setTerrForm(f => ({ ...f, minLng: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Max Longitude</label>
                <input type="number" step="0.0001" className="form-input"
                  value={terrForm.maxLng}
                  onChange={e => setTerrForm(f => ({ ...f, maxLng: e.target.value }))} required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Vehicle Load Limit (kg)</label>
              <input type="number" className="form-input"
                value={terrForm.loadLimit}
                onChange={e => setTerrForm(f => ({ ...f, loadLimit: e.target.value }))} required />
            </div>
            {terrSaved && <p style={{ color: 'var(--color-green)', fontSize: 13, marginBottom: 8 }}>✓ Territory saved successfully.</p>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setEditTerritory(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Territory</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
