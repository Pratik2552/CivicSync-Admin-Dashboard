import React, { useState, useEffect, useMemo } from 'react'
import { 
  Search, Plus, Edit, Eye, Trash2, Car, Truck, RefreshCw, 
  CheckCircle, AlertTriangle, ChevronUp, ChevronDown, User, Phone, 
  MapPin, Gauge, Wrench, Activity
} from 'lucide-react'
import { getVehiclesAdmin, createVehicle, deleteVehicle, updateVehicle, isAuthenticated, getTokenExpiryStatus } from '../services/api.js'
import { debugAuthStatus } from '../utils/authDebug.js'
import StatCard from '../components/common/StatCard.jsx'
import StatusBadge from '../components/common/StatusBadge.jsx'
import Modal from '../components/common/Modal.jsx'
import './VehicleProfiles.css'

function SortIcon({ field, sortField, sortDir }) {
  if (sortField !== field) return <span className="sort-placeholder" />
  return sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
}

function CapacityBar({ current, max }) {
  const currentNum = parseFloat(current || 0)
  const maxNum = parseFloat(max || 5000)
  const pct = maxNum > 0 ? Math.min((currentNum / maxNum) * 100, 100) : 0
  const color = pct > 80 ? '#ef4444' : pct > 50 ? '#F59E0B' : '#22c55e'

  return (
    <div className="capacity-bar-wrap">
      <span className="capacity-text">{currentNum.toLocaleString()} / {maxNum.toLocaleString()} kg</span>
      <div className="capacity-bar-bg">
        <div className="capacity-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

export default function VehicleProfiles() {
  const [vehicles, setVehicles] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  
  // Filters and sorting
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortField, setSortField] = useState('license_plate')
  const [sortDir, setSortDir] = useState('asc')
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [editVehicle, setEditVehicle] = useState(null)
  const [viewVehicle, setViewVehicle] = useState(null)
  
  // Forms
  const [addFormData, setAddFormData] = useState({
    license_plate: '',
    vehicle_authority_name: '',
    vehicle_authority_email: '',
    vehicle_authority_password: '',
    vehicle_authority_phone: '',
    capacity_kg: '5000',
    territory_name: '',
    authority_id: '',
    min_lat: '',
    max_lat: '',
    min_lng: '',
    max_lng: ''
  })
  
  const [editFormData, setEditFormData] = useState({
    status: '',
    driver_name: '',
    driver_phone: '',
    capacity_kg: '',
    territory_name: ''
  })

  useEffect(() => {
    fetchVehicles()
  }, [])

  const fetchVehicles = async () => {
    setIsLoading(true)
    setError('')
    try {
      const data = await getVehiclesAdmin()
      setVehicles(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching vehicles:', error)
      setError('Failed to fetch vehicles: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  // Vehicle statistics derived from data
  const stats = useMemo(() => {
    const total = vehicles.length
    const active = vehicles.filter(v => v.status?.toLowerCase() === 'active').length
    const maintenance = vehicles.filter(v => v.status?.toLowerCase() === 'maintenance').length
    const offline = vehicles.filter(v => v.status?.toLowerCase() === 'offline').length
    const avgCapacity = total > 0 ? (vehicles.reduce((sum, v) => sum + (v.capacity_kg || 0), 0) / total).toFixed(0) : 0

    return { total, active, maintenance, offline, avgCapacity }
  }, [vehicles])

  // Sorting and filtering
  function handleSort(field) {
    if (sortField === field) {
      setSortDir(dir => dir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const filteredVehicles = useMemo(() => {
    let filtered = vehicles.filter(vehicle => {
      const searchTerm = search.toLowerCase()
      const matchesSearch = !search || 
        vehicle.license_plate?.toLowerCase().includes(searchTerm) ||
        vehicle.driver_name?.toLowerCase().includes(searchTerm) ||
        vehicle.driver_phone?.includes(searchTerm) ||
        vehicle.territory_name?.toLowerCase().includes(searchTerm)
      
      const matchesStatus = statusFilter === 'all' || 
        vehicle.status?.toLowerCase() === statusFilter.toLowerCase()
      
      return matchesSearch && matchesStatus
    })
    // Sort the filtered results
    filtered.sort((a, b) => {
      let valueA = a[sortField] || ''
      let valueB = b[sortField] || ''
      
      if (typeof valueA === 'string') {
        return sortDir === 'asc' 
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA)
      }
      
      return sortDir === 'asc' ? valueA - valueB : valueB - valueA
    })

    return filtered
  }, [vehicles, search, statusFilter, sortField, sortDir])

  const handleAddVehicle = async (e) => {
    e.preventDefault()
    
    // Debug authentication status before making API call
    console.log('🔐 Attempting to create vehicle...');
    debugAuthStatus();
    
    // Check if user is authenticated
    if (!isAuthenticated()) {
      setError('You are not authenticated. Please log in again.');
      console.error('❌ User is not authenticated');
      return;
    }
    
    // Check token expiry
    const tokenStatus = getTokenExpiryStatus();
    if (tokenStatus.isExpired) {
      setError('Your session has expired. Please log in again.');
      console.error('❌ Token has expired:', tokenStatus);
      window.location.href = '/';
      return;
    }
    
    try {
      await createVehicle(addFormData)
      setShowAddModal(false)
      setAddFormData({
        license_plate: '',
        vehicle_authority_name: '',
        vehicle_authority_email: '',
        vehicle_authority_password: '',
        vehicle_authority_phone: '',
        capacity_kg: '5000',
        territory_name: '',
        authority_id: '',
        min_lat: '',
        max_lat: '',
        min_lng: '',
        max_lng: ''
      })
      fetchVehicles()
      setError('')
    } catch (error) {
      console.error('Error adding vehicle:', error)
      setError('Error adding vehicle: ' + error.message)
    }
  }

  const handleUpdateVehicle = async (e) => {
    e.preventDefault()
    try {
      await updateVehicle(editVehicle.id, editFormData)
      setEditVehicle(null)
      fetchVehicles()
      setError('')
    } catch (error) {
      console.error('Error updating vehicle:', error)
      setError('Error updating vehicle: ' + error.message)
    }
  }
  const handleDeleteVehicle = async (vehicleId) => {
    if (window.confirm('Are you sure you want to delete this vehicle? This will also remove the associated driver account.')) {
      try {
        await deleteVehicle(vehicleId)
        fetchVehicles()
        setError('')
      } catch (error) {
        console.error('Error deleting vehicle:', error)
        setError('Error deleting vehicle: ' + error.message)
      }
    }
  }

  const openEditModal = (vehicle) => {
    setEditFormData({
      status: vehicle.status || 'Active',
      driver_name: vehicle.driver_name || '',
      driver_phone: vehicle.driver_phone || '',
      capacity_kg: vehicle.capacity_kg || '',
      territory_name: vehicle.territory_name || ''
    })
    setEditVehicle(vehicle)
  }

  function th(label, field, className = '') {
    return (
      <th className={`sortable ${className}`} onClick={() => handleSort(field)}>
        {label} <SortIcon field={field} sortField={sortField} sortDir={sortDir} />
      </th>
    )
  }

  return (
    <div className="vehicle-profiles-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Vehicle Profiles & Fleet Management</h1>
          <p className="page-subheading">
            Manage municipal vehicles, assign drivers, and monitor fleet operations in real-time.
          </p>
        </div>
        <div className="header-actions">
          <div className="fleet-stats">
            <span className="fleet-stat active"><Car size={13} /> Active: {stats.active}</span>
            <span className="fleet-stat maintenance">Maintenance: {stats.maintenance}</span>
            <span className="fleet-stat offline">Offline: {stats.offline}</span>
          </div>
          <button className="btn btn-outline btn-sm" onClick={fetchVehicles} title="Refresh Fleet">
            <RefreshCw size={12} className={isLoading ? 'spin' : ''} />
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={14} /> Add Vehicle
          </button>
        </div>
      </div>
      {error && (
        <div className="alert alert-error mb-6" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="kpi-grid">
        <StatCard 
          label="Total Fleet Vehicles" 
          value={stats.total} 
          icon={Truck} 
          iconColor="var(--color-primary)" 
          borderColor="var(--color-primary)"
          trend="neutral"
          trendLabel="registered vehicles"
        />
        <StatCard 
          label="Active Vehicles" 
          value={stats.active} 
          icon={CheckCircle} 
          iconColor="var(--color-green)" 
          borderColor="var(--color-green)"
          trend="neutral"
          trendLabel="operational status"
        />
        <StatCard 
          label="In Maintenance" 
          value={stats.maintenance} 
          icon={Wrench} 
          iconColor="var(--color-warning)" 
          borderColor="var(--color-warning)"
          trend="neutral"
          trendLabel="under service"
        />
        <StatCard 
          label="Avg Capacity" 
          value={`${stats.avgCapacity} kg`} 
          icon={Gauge} 
          iconColor="var(--color-primary-light)" 
          borderColor="var(--color-primary-light)"
          trend="neutral"
          trendLabel="per vehicle"
        />
      </div>
      {/* Main Vehicle Table */}
      <div className="panel">
        <div className="panel-header">
          <h3>Fleet Registry ({filteredVehicles.length} vehicles)</h3>
          <div className="filters-row">
            <div className="search-bar">
              <Search size={14} />
              <input
                placeholder="Search by license plate, driver name, or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select 
              className="form-select" 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: 140 }}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="idle">Idle</option>
              <option value="maintenance">Maintenance</option>
              <option value="offline">Offline</option>
            </select>
          </div>
        </div>

        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {th('License Plate', 'license_plate')}
                {th('Driver Name', 'driver_name')}
                <th>Contact</th>
                {th('Capacity', 'capacity_kg')}
                <th>Territory</th>
                {th('Status', 'status')}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: 'var(--color-text-secondary)' }}>
                    <RefreshCw size={18} className="spin" style={{ marginBottom: 6 }} /><br />
                    Loading fleet data...
                  </td>
                </tr>
              ) : filteredVehicles.length > 0 ? (
                filteredVehicles.map((vehicle) => (
                  <tr key={vehicle.id}>
                    <td>
                      <span className="plate-tag">{vehicle.license_plate}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <User size={14} style={{ color: 'var(--color-text-secondary)' }} />
                        {vehicle.driver_name}
                      </div>
                    </td>
                    <td className="text-muted">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Phone size={12} />
                        {vehicle.driver_phone || 'N/A'}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>{(vehicle.capacity_kg || 0).toLocaleString()} kg</span>
                        {vehicle.current_load_kg > 0 && (
                          <CapacityBar 
                            current={vehicle.current_load_kg} 
                            max={vehicle.capacity_kg} 
                          />
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <MapPin size={12} style={{ color: vehicle.territory_name?.includes('ZONE A') ? '#2563eb' : vehicle.territory_name?.includes('ZONE B') ? '#16a34a' : 'var(--color-text-secondary)' }} />
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: 4,
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: vehicle.territory_name?.includes('ZONE A') ? '#dbeafe' : vehicle.territory_name?.includes('ZONE B') ? '#dcfce7' : '#f1f5f9',
                          color: vehicle.territory_name?.includes('ZONE A') ? '#1e40af' : vehicle.territory_name?.includes('ZONE B') ? '#166534' : '#64748b',
                          border: vehicle.territory_name?.includes('ZONE A') ? '1px solid #93c5fd' : vehicle.territory_name?.includes('ZONE B') ? '1px solid #86efac' : '1px solid #cbd5e1'
                        }}>
                          {vehicle.territory_name || 'Unassigned'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={vehicle.status || 'Active'} />
                    </td>
                    <td>
                      <div className="vehicle-actions">
                        <button 
                          className="btn-icon" 
                          title="View Details"
                          onClick={() => setViewVehicle(vehicle)}
                        >
                          <Eye size={14} />
                        </button>
                        <button 
                          className="btn-icon" 
                          title="Edit Vehicle"
                          onClick={() => openEditModal(vehicle)}
                        >
                          <Edit size={14} />
                        </button>
                        <button 
                          className="btn-icon danger" 
                          title="Delete Vehicle"
                          onClick={() => handleDeleteVehicle(vehicle.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)' }}>
                    No vehicles found. Click "Add Vehicle" to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Vehicle Modal */}
      {showAddModal && (
        <Modal 
          title="Add New Vehicle & Driver"
          onClose={() => setShowAddModal(false)}
          width={600}
        >
          <form onSubmit={handleAddVehicle}>
            <div className="modal-section">
              <h4>Vehicle Information</h4>
              <div className="form-2col">
                <div className="form-group">
                  <label className="form-label">License Plate *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={addFormData.license_plate}
                    onChange={(e) => setAddFormData({...addFormData, license_plate: e.target.value})}
                    placeholder="MH12AB1234"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Capacity (kg) *</label>
                  <input
                    type="number"
                    className="form-input"
                    value={addFormData.capacity_kg}
                    onChange={(e) => setAddFormData({...addFormData, capacity_kg: e.target.value})}
                    min="0"
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Assigned KML Territory Zone</label>
                <select
                  className="form-select"
                  value={addFormData.territory_name}
                  onChange={(e) => setAddFormData({...addFormData, territory_name: e.target.value})}
                >
                  <option value="">-- Select KML Territory Zone --</option>
                  <option value="ZONE A">📍 Zone 1 (ZONE A - North Territory)</option>
                  <option value="ZONE B">📍 Zone 2 (ZONE B - South Territory)</option>
                </select>
              </div>
            </div>
            <div className="modal-section">
              <h4>Authority Information</h4>
              <div className="form-2col">
                <div className="form-group">
                  <label className="form-label">Authority Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={addFormData.vehicle_authority_name}
                    onChange={(e) => setAddFormData({...addFormData, vehicle_authority_name: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={addFormData.vehicle_authority_phone}
                    onChange={(e) => setAddFormData({...addFormData, vehicle_authority_phone: e.target.value})}
                    placeholder="+91 9876543210"
                  />
                </div>
              </div>
              <div className="form-2col">
                <div className="form-group">
                  <label className="form-label">Email Address *</label>
                  <input
                    type="email"
                    className="form-input"
                    value={addFormData.vehicle_authority_email}
                    onChange={(e) => setAddFormData({...addFormData, vehicle_authority_email: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Password *</label>
                  <input
                    type="password"
                    className="form-input"
                    value={addFormData.vehicle_authority_password}
                    onChange={(e) => setAddFormData({...addFormData, vehicle_authority_password: e.target.value})}
                    minLength="6"
                    required
                  />
                </div>
              </div>
            </div>
            <div className="modal-section">
              <h4>Territory Boundaries (Optional)</h4>
              <div className="form-2col">
                <div className="form-group">
                  <label className="form-label">Min Latitude</label>
                  <input
                    type="number"
                    className="form-input"
                    value={addFormData.min_lat}
                    onChange={(e) => setAddFormData({...addFormData, min_lat: e.target.value})}
                    step="0.000001"
                    placeholder="18.5204"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Max Latitude</label>
                  <input
                    type="number"
                    className="form-input"
                    value={addFormData.max_lat}
                    onChange={(e) => setAddFormData({...addFormData, max_lat: e.target.value})}
                    step="0.000001"
                    placeholder="19.9975"
                  />
                </div>
              </div>
              <div className="form-2col">
                <div className="form-group">
                  <label className="form-label">Min Longitude</label>
                  <input
                    type="number"
                    className="form-input"
                    value={addFormData.min_lng}
                    onChange={(e) => setAddFormData({...addFormData, min_lng: e.target.value})}
                    step="0.000001"
                    placeholder="72.7717"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Max Longitude</label>
                  <input
                    type="number"
                    className="form-input"
                    value={addFormData.max_lng}
                    onChange={(e) => setAddFormData({...addFormData, max_lng: e.target.value})}
                    step="0.000001"
                    placeholder="73.7898"
                  />
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Create Vehicle & Driver
              </button>
            </div>
          </form>
        </Modal>
      )}
      {/* Edit Vehicle Modal */}
      {editVehicle && (
        <Modal 
          title={`Edit Vehicle - ${editVehicle.license_plate}`}
          onClose={() => setEditVehicle(null)}
          width={500}
        >
          <form onSubmit={handleUpdateVehicle}>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select
                className="form-input"
                value={editFormData.status}
                onChange={(e) => setEditFormData({...editFormData, status: e.target.value})}
                required
              >
                <option value="Active">Active</option>
                <option value="Idle">Idle</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Offline">Offline</option>
              </select>
            </div>
            <div className="form-2col">
              <div className="form-group">
                <label className="form-label">Driver Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={editFormData.driver_name}
                  onChange={(e) => setEditFormData({...editFormData, driver_name: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Driver Phone</label>
                <input
                  type="tel"
                  className="form-input"
                  value={editFormData.driver_phone}
                  onChange={(e) => setEditFormData({...editFormData, driver_phone: e.target.value})}
                />
              </div>
            </div>
            <div className="form-2col">
              <div className="form-group">
                <label className="form-label">Capacity (kg)</label>
                <input
                  type="number"
                  className="form-input"
                  value={editFormData.capacity_kg}
                  onChange={(e) => setEditFormData({...editFormData, capacity_kg: e.target.value})}
                  min="0"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Assigned KML Territory Zone</label>
                <select
                  className="form-select"
                  value={editFormData.territory_name}
                  onChange={(e) => setEditFormData({...editFormData, territory_name: e.target.value})}
                >
                  <option value="">Unassigned</option>
                  <option value="ZONE A">📍 Zone 1 (ZONE A - North Territory)</option>
                  <option value="ZONE B">📍 Zone 2 (ZONE B - South Territory)</option>
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setEditVehicle(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Update Vehicle
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* View Vehicle Modal */}
      {viewVehicle && (
        <Modal 
          title={`Vehicle Details - ${viewVehicle.license_plate}`}
          onClose={() => setViewVehicle(null)}
          width={500}
        >
          <div className="vehicle-details-grid">
            <div className="detail-row">
              <span className="detail-label">License Plate</span>
              <span className="detail-value">{viewVehicle.license_plate}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Driver Name</span>
              <span className="detail-value">{viewVehicle.driver_name}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Phone Number</span>
              <span className="detail-value">{viewVehicle.driver_phone || 'N/A'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Capacity</span>
              <span className="detail-value">{(viewVehicle.capacity_kg || 0).toLocaleString()} kg</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Territory</span>
              <span className="detail-value">{viewVehicle.territory_name || 'Unassigned'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Status</span>
              <span className="detail-value">
                <StatusBadge status={viewVehicle.status || 'Active'} />
              </span>
            </div>
            {viewVehicle.latitude && viewVehicle.longitude && (
              <div className="detail-row">
                <span className="detail-label">Last Location</span>
                <span className="detail-value">
                  {viewVehicle.latitude.toFixed(4)}, {viewVehicle.longitude.toFixed(4)}
                </span>
              </div>
            )}
            {viewVehicle.speed && (
              <div className="detail-row">
                <span className="detail-label">Speed</span>
                <span className="detail-value">{viewVehicle.speed} km/h</span>
              </div>
            )}
            <div className="detail-row">
              <span className="detail-label">Created</span>
              <span className="detail-value">
                {viewVehicle.created_at ? new Date(viewVehicle.created_at).toLocaleDateString() : 'N/A'}
              </span>
            </div>
          </div>

          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setViewVehicle(null)}>
              Close
            </button>
            <button 
              className="btn btn-primary" 
              onClick={() => {
                setViewVehicle(null)
                openEditModal(viewVehicle)
              }}
            >
              Edit Vehicle
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}