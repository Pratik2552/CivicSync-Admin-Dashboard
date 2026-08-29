import React, { useState, useEffect, useMemo } from 'react'
import {
  Search, Eye, MapPin, RefreshCw, AlertTriangle, ShieldAlert, CheckCircle, Clock, User, Phone, Truck, Filter
} from 'lucide-react'
import StatCard from '../components/common/StatCard.jsx'
import StatusBadge from '../components/common/StatusBadge.jsx'
import Modal from '../components/common/Modal.jsx'
import { getVehiclesAdmin } from '../services/api.js'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'

export default function DeadAnimalComplaints() {
  const [reports, setReports] = useState([])
  const [dbVehicles, setDbVehicles] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusMsg, setStatusMsg] = useState('')

  // Filter & Search
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Modals
  const [viewPhotoUrl, setViewPhotoUrl] = useState(null)
  const [viewLocationObj, setViewLocationObj] = useState(null)
  const [assignModalReport, setAssignModalReport] = useState(null)

  // Assign Form
  const [selectedDriver, setSelectedDriver] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('Assigned')

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchReportsOnly, 5000)
    return () => clearInterval(interval)
  }, [])

  const fetchData = async () => {
    setIsLoading(true)
    setError('')
    try {
      await Promise.all([fetchReportsOnly(), fetchVehicles()])
    } catch (err) {
      console.error('Error fetching data:', err)
      setError('Failed to load dead animal complaint reports.')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchReportsOnly = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/dead-animal-reports/all`)
      const data = await res.json()
      if (res.ok && data.success) {
        setReports(data.reports || [])
      }
    } catch (err) {
      console.error('Failed to fetch dead animal reports:', err)
    }
  }

  const fetchVehicles = async () => {
    try {
      const data = await getVehiclesAdmin()
      setDbVehicles(Array.isArray(data) ? data : [])
    } catch (err) {
      console.warn('Failed to fetch DB vehicles:', err)
    }
  }

  // Handle Driver Assignment & Status Update
  const handleUpdateStatus = async (reportId, newStatus, driverName, driverId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/dead-animal-reports/${reportId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          assigned_driver_name: driverName || null,
          assigned_driver_id: driverId || null,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setStatusMsg(`Report ${reportId} updated to "${newStatus}"!`)
        setAssignModalReport(null)
        fetchReportsOnly()
        setTimeout(() => setStatusMsg(''), 4000)
      } else {
        setError(data.error || 'Failed to update report status.')
      }
    } catch (err) {
      console.error('Failed to update status:', err)
      setError('Failed to update report status.')
    }
  }

  // Stats calculation
  const stats = useMemo(() => {
    const total = reports.length
    const pending = reports.filter(r => (r.status || '').toLowerCase() === 'pending').length
    const assigned = reports.filter(r => (r.status || '').toLowerCase() === 'assigned' || (r.status || '').toLowerCase() === 'in progress').length
    const resolved = reports.filter(r => (r.status || '').toLowerCase() === 'resolved' || (r.status || '').toLowerCase() === 'cleaned').length

    return { total, pending, assigned, resolved }
  }, [reports])

  // Filtered reports
  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      const term = search.toLowerCase()
      const matchesSearch = !search ||
        (r.id || '').toLowerCase().includes(term) ||
        (r.citizen_name || '').toLowerCase().includes(term) ||
        (r.location_address || '').toLowerCase().includes(term) ||
        (r.description || '').toLowerCase().includes(term)

      const matchesStatus = statusFilter === 'all' ||
        (r.status || '').toLowerCase() === statusFilter.toLowerCase()

      return matchesSearch && matchesStatus
    })
  }, [reports, search, statusFilter])

  const openAssignModal = (report) => {
    setAssignModalReport(report)
    setSelectedDriver(report.assigned_driver_name || '')
    setSelectedStatus(report.status || 'Assigned')
  }

  return (
    <div className="dead-animal-page" style={{ padding: '1.5rem' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyBetween: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldAlert size={28} color="#b91c1c" /> Dead Animal Complaints &amp; Dispatch
          </h1>
          <p className="text-muted" style={{ margin: '4px 0 0 0', fontSize: '0.9rem' }}>
            Monitor citizen dead animal alerts, view EXIF/Mobile GPS coordinates, and assign sanitation drivers.
          </p>
        </div>

        <button className="btn btn-outline" onClick={fetchData} title="Refresh Complaints">
          <RefreshCw size={14} className={isLoading ? 'spin' : ''} style={{ marginRight: 6 }} /> Refresh Alerts
        </button>
      </div>

      {statusMsg && (
        <div className="alert alert-success mb-4" style={{ padding: '12px', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', borderRadius: 8 }}>
          <CheckCircle size={16} style={{ marginRight: 6, inline: 'inline' }} /> {statusMsg}
        </div>
      )}

      {error && (
        <div className="alert alert-error mb-4" style={{ padding: '12px', background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', borderRadius: 8 }}>
          <AlertTriangle size={16} style={{ marginRight: 6, inline: 'inline' }} /> {error}
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="kpi-grid">
        <StatCard
          label="Total Dead Animal Alerts"
          value={stats.total}
          icon={ShieldAlert}
          iconColor="#b91c1c"
          borderColor="#b91c1c"
          trend="neutral"
          trendLabel="reported carcass issues"
        />
        <StatCard
          label="Pending Dispatch"
          value={stats.pending}
          icon={Clock}
          iconColor="#f59e0b"
          borderColor="#f59e0b"
          trend="neutral"
          trendLabel="action required"
        />
        <StatCard
          label="Assigned / In Progress"
          value={stats.assigned}
          icon={Truck}
          iconColor="#2563eb"
          borderColor="#2563eb"
          trend="neutral"
          trendLabel="sanitation dispatches"
        />
        <StatCard
          label="Resolved &amp; Cleaned"
          value={stats.resolved}
          icon={CheckCircle}
          iconColor="#16a34a"
          borderColor="#16a34a"
          trend="neutral"
          trendLabel="completed disposals"
        />
      </div>

      {/* Table Panel */}
      <div className="panel" style={{ background: '#fff', borderRadius: 8, padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Complaints Registry ({filteredReports.length})</h3>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <div className="search-bar" style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', padding: '6px 12px', borderRadius: 6 }}>
              <Search size={14} style={{ color: '#64748b', marginRight: 6 }} />
              <input
                placeholder="Search complaint ID, citizen, address..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.85rem' }}
              />
            </div>
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="assigned">Assigned</option>
              <option value="resolved">Resolved / Cleaned</option>
            </select>
          </div>
        </div>

        <div className="data-table-wrap" style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
              <tr>
                <th style={{ padding: '10px 12px' }}>Complaint ID</th>
                <th style={{ padding: '10px 12px' }}>Photo</th>
                <th style={{ padding: '10px 12px' }}>Citizen Info</th>
                <th style={{ padding: '10px 12px' }}>GPS Location &amp; Address</th>
                <th style={{ padding: '10px 12px' }}>Description</th>
                <th style={{ padding: '10px 12px' }}>Assigned Driver</th>
                <th style={{ padding: '10px 12px' }}>Status</th>
                <th style={{ padding: '10px 12px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                    <RefreshCw size={20} className="spin" style={{ marginBottom: 6 }} /><br />
                    Loading complaint alerts...
                  </td>
                </tr>
              ) : filteredReports.length > 0 ? (
                filteredReports.map((report) => (
                  <tr key={report.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#334155' }}>
                      {report.id}
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 400 }}>
                        {report.created_at ? new Date(report.created_at).toLocaleDateString() : ''}
                      </div>
                    </td>

                    {/* Photo Thumbnail */}
                    <td style={{ padding: '10px 12px' }}>
                      {report.image_url ? (
                        <div
                          onClick={() => setViewPhotoUrl(report.image_url)}
                          style={{ width: 50, height: 50, borderRadius: 6, overflow: 'hidden', cursor: 'pointer', border: '1px solid #cbd5e1' }}
                          title="Click to expand photo"
                        >
                          <img src={report.image_url} alt="Carcass Spot" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      ) : (
                        <span className="text-muted">No Image</span>
                      )}
                    </td>

                    {/* Citizen Info */}
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{report.citizen_name || 'Anonymous'}</div>
                      {report.citizen_phone && (
                        <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Phone size={10} /> {report.citizen_phone}
                        </div>
                      )}
                    </td>

                    {/* GPS Location & Address */}
                    <td style={{ padding: '10px 12px', maxWidth: 220 }}>
                      <div style={{ fontWeight: 700, color: '#2563eb', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={12} /> {parseFloat(report.latitude).toFixed(4)}, {parseFloat(report.longitude).toFixed(4)}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {report.location_address || 'Address captured'}
                      </div>
                    </td>

                    {/* Description */}
                    <td style={{ padding: '10px 12px', maxWidth: 200 }}>
                      <div style={{ fontSize: '0.8rem', color: '#334155', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {report.description || 'Dead animal alert'}
                      </div>
                    </td>

                    {/* Assigned Driver */}
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                        <Truck size={12} style={{ color: '#2563eb' }} />
                        {report.assigned_driver_name ? (
                          <span style={{ color: '#0f172a' }}>{report.assigned_driver_name}</span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Unassigned</span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: 4,
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background: (report.status || '').toLowerCase() === 'resolved' || (report.status || '').toLowerCase() === 'cleaned' ? '#dcfce7' : (report.status || '').toLowerCase() === 'assigned' ? '#dbeafe' : '#fef9c3',
                        color: (report.status || '').toLowerCase() === 'resolved' || (report.status || '').toLowerCase() === 'cleaned' ? '#166534' : (report.status || '').toLowerCase() === 'assigned' ? '#1e40af' : '#854d0e',
                        border: (report.status || '').toLowerCase() === 'resolved' || (report.status || '').toLowerCase() === 'cleaned' ? '1px solid #86efac' : (report.status || '').toLowerCase() === 'assigned' ? '1px solid #93c5fd' : '1px solid #fef08a'
                      }}>
                        {report.status || 'Pending'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn-icon"
                          title="View Photo"
                          onClick={() => setViewPhotoUrl(report.image_url)}
                        >
                          <Eye size={14} />
                        </button>

                        <button
                          className="btn-icon"
                          title="View Coordinates & Location"
                          onClick={() => setViewLocationObj(report)}
                        >
                          <MapPin size={14} />
                        </button>

                        <button
                          className="btn btn-sm btn-primary"
                          style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                          onClick={() => openAssignModal(report)}
                        >
                          Assign / Update
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                    No dead animal complaints found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 1. VIEW PHOTO MODAL */}
      {viewPhotoUrl && (
        <Modal title="Dead Animal Complaint Photo" onClose={() => setViewPhotoUrl(null)} width={600}>
          <div style={{ textAlign: 'center' }}>
            <img src={viewPhotoUrl} alt="Carcass Full View" style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 8, objectFit: 'contain' }} />
            <div style={{ marginTop: 12 }}>
              <a href={viewPhotoUrl} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">
                Open Full Resolution Image ↗
              </a>
            </div>
          </div>
        </Modal>
      )}

      {/* 2. VIEW LOCATION MODAL */}
      {viewLocationObj && (
        <Modal title={`Location - Complaint ${viewLocationObj.id}`} onClose={() => setViewLocationObj(null)} width={500}>
          <div style={{ padding: '0.5rem 0' }}>
            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, marginBottom: 12, border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 4, color: '#2563eb' }}>
                📍 GPS Coordinates:
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'monospace', color: '#0f172a' }}>
                {viewLocationObj.latitude}, {viewLocationObj.longitude}
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#475569' }}>Landmark / Address:</div>
              <div style={{ fontSize: '0.95rem', color: '#1e293b' }}>{viewLocationObj.location_address}</div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#475569' }}>Description:</div>
              <div style={{ fontSize: '0.9rem', color: '#334155' }}>{viewLocationObj.description}</div>
            </div>

            <div style={{ marginTop: 16 }}>
              <a
                href={`https://www.google.com/maps?q=${viewLocationObj.latitude},${viewLocationObj.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary btn-full"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <MapPin size={16} /> Open Location in Google Maps / OSM ↗
              </a>
            </div>
          </div>
        </Modal>
      )}

      {/* 3. ASSIGN DRIVER & UPDATE STATUS MODAL */}
      {assignModalReport && (
        <Modal title={`Dispatch Sanitation Driver - ${assignModalReport.id}`} onClose={() => setAssignModalReport(null)} width={500}>
          <form onSubmit={(e) => {
            e.preventDefault()
            const vehObj = dbVehicles.find(v => (v.driver_name || v.id) === selectedDriver)
            const dName = vehObj ? (vehObj.driver_name || vehObj.license_plate) : selectedDriver
            const dId = vehObj ? vehObj.id : null
            handleUpdateStatus(assignModalReport.id, selectedStatus, dName, dId)
          }}>
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 4, display: 'block' }}>
                Select Sanitation Driver / Vehicle
              </label>
              <select
                className="form-select"
                value={selectedDriver}
                onChange={(e) => setSelectedDriver(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1' }}
              >
                <option value="">-- Choose Driver from Fleet --</option>
                {dbVehicles.map((v) => (
                  <option key={v.id} value={v.driver_name || v.id}>
                    👤 {v.driver_name || 'Driver'} ({v.license_plate}) - Territory: {v.territory_name || 'General'}
                  </option>
                ))}
                <option value="Special Sanitation Team">🚨 Special Sanitation Emergency Unit</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 4, display: 'block' }}>
                Complaint Status
              </label>
              <select
                className="form-select"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1' }}
              >
                <option value="Pending">Pending Dispatch</option>
                <option value="Assigned">Assigned to Driver</option>
                <option value="In Progress">In Progress (Driver On Way)</option>
                <option value="Resolved">Resolved &amp; Carcass Disposal Completed</option>
              </select>
            </div>

            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setAssignModalReport(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save &amp; Dispatch Alert
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
