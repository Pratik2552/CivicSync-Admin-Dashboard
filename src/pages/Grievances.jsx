import React, { useState, useEffect } from 'react';
import { getGrievances, assignGrievance, resolveGrievance, getVehiclesAdmin } from '../services/api.js';
import StatusBadge from '../components/common/StatusBadge.jsx';
import Modal from '../components/common/Modal.jsx';
import './Grievances.css';

const CATEGORIES = [
  'All Categories',
  'Overflow / Bin Full',
  'Missed Collection',
  'Illegal Dumping',
  'Littering',
  'Damaged Bin',
  'Bad Odour',
  'Road Blockage',
];

const normalizeComplaintStatus = (status) => {
  const value = String(status || '').trim().toLowerCase();

  if (['resolved', 'solved', 'closed', 'completed', 'cleaned', 'fixed', 'done'].includes(value)) {
    return 'resolved';
  }

  if (['assigned', 'in progress', 'in_progress', 'in-progress', 'work in progress', 'work_in_progress', 'processing'].includes(value)) {
    return 'assigned';
  }

  return 'open';
};

const isResolvedComplaint = (status) => normalizeComplaintStatus(status) === 'resolved';

export default function Grievances() {
  const [grievances, setGrievances] = useState([]);
  const [vehicles, setVehicles] = useState([]); // 👈 Stores live vehicles from database with real UUIDs
  const [stats, setStats] = useState({ open: 0, assigned: 0, resolved: 0, critical: 0 });
  const [loading, setLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');

  // Modals & Selection State
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);

  const [assignTicketId, setAssignTicketId] = useState(null);
  const [selectedDriver, setSelectedDriver] = useState('');

  // Resolve Proof State
  const [resolveTicketId, setResolveTicketId] = useState(null);
  const [resolvedImageFile, setResolvedImageFile] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isVerifyingTrashBot, setIsVerifyingTrashBot] = useState(false);
  const [trashBotError, setTrashBotError] = useState('');

  useEffect(() => {
    loadGrievances();
    loadVehicles(); // 👈 Load real vehicle UUIDs on mount
  }, [statusFilter, priorityFilter, categoryFilter, search]);

  const loadVehicles = async () => {
    try {
      const res = await getVehiclesAdmin();
      setVehicles(Array.isArray(res) ? res : res.vehicles || []);
    } catch (err) {
      console.error('Error loading vehicles for assignment:', err);
    }
  };

  const computeStats = (dataList) => {
    if (!Array.isArray(dataList)) return;

    let open = 0;
    let assigned = 0;
    let resolved = 0;
    let critical = 0;

    dataList.forEach((ticket) => {
      const status = normalizeComplaintStatus(ticket.status);
      const priority = (ticket.priority || '').toLowerCase();

      if (status === 'resolved') resolved++;
      else if (status === 'assigned' || ticket.assigned_driver_id || ticket.assignedDriver) assigned++;
      else open++;

      if (priority === 'critical') critical++;
    });

    setStats({ open, assigned, resolved, critical });
  };

  const loadGrievances = async () => {
    try {
      setLoading(true);
      const res = await getGrievances({ status: statusFilter, priority: priorityFilter, search });
      
      let dataList = [];
      if (Array.isArray(res)) {
        dataList = res;
      } else if (res && Array.isArray(res.grievances)) {
        dataList = res.grievances;
      } else if (res && Array.isArray(res.complaints)) {
        dataList = res.complaints;
      } else if (res && Array.isArray(res.data)) {
        dataList = res.data;
      }

      if (categoryFilter !== 'All Categories') {
        dataList = dataList.filter((g) => (g.category || '') === categoryFilter);
      }

      dataList = dataList.map((ticket) => ({
        ...ticket,
        status: normalizeComplaintStatus(ticket.status),
      }));

      if (statusFilter !== 'all') {
        dataList = dataList.filter((g) => normalizeComplaintStatus(g.status) === statusFilter);
      }

      setGrievances(dataList);
      computeStats(dataList);
    } catch (error) {
      console.error('Error loading grievances:', error);
      setGrievances([]);
    } finally {
      setLoading(false);
    }
  };

  const handleView = (ticket) => {
    setSelectedTicket(ticket);
    setIsDetailModalOpen(true);
  };

  const handleOpenAssign = (ticketId) => {
    setAssignTicketId(ticketId);
    setSelectedDriver('');
    setIsAssignModalOpen(true);
  };

  const handleOpenResolve = (ticketId) => {
    setResolveTicketId(ticketId);
    setResolvedImageFile(null);
    setResolutionNotes('');
    setIsResolveModalOpen(true);
  };

  const handleConfirmAssign = async (e) => {
    e.preventDefault();
    if (!selectedDriver || !assignTicketId) return;

    try {
      await assignGrievance(assignTicketId, selectedDriver);
      setIsAssignModalOpen(false);
      await loadGrievances();

      if (selectedTicket && (selectedTicket.id === assignTicketId || selectedTicket.ticket_id === assignTicketId)) {
        setSelectedTicket({
          ...selectedTicket,
          status: 'assigned',
          assignedDriver: selectedDriver,
          assigned_driver_id: selectedDriver,
        });
      }
    } catch (error) {
      console.error('Error assigning grievance:', error);
    }
  };

  const handleConfirmResolve = async (e) => {
    e.preventDefault();
    if (!resolveTicketId || !resolvedImageFile) {
      alert('Please upload a proof image of the cleaned area.');
      return;
    }

    try {
      setIsVerifyingTrashBot(true);
      setTrashBotError('');

      const formData = new FormData();
      formData.append('status', 'Resolved');
      formData.append('notes', resolutionNotes || 'Resolved by municipal admin dispatch team');
      formData.append('image', resolvedImageFile);

      await resolveGrievance(resolveTicketId, formData);
      setIsResolveModalOpen(false);
      setIsDetailModalOpen(false);
      await loadGrievances();
    } catch (error) {
      console.error('Error resolving grievance:', error);
      setTrashBotError(error.message || 'Failed to resolve grievance.');
    } finally {
      setIsVerifyingTrashBot(false);
    }
  };

  const safeGrievancesList = Array.isArray(grievances) ? grievances : [];
  // Filter active vehicles from database using real UUIDs
  const availableDrivers = vehicles.filter((v) => (v.status || '').toLowerCase() !== 'maintenance');

  return (
    <div className="grievances-page">
      <div className="page-header">
        <div>
          <h1>Citizen Grievances Management</h1>
          <p className="page-subheading">Track, triage, and assign reported public complaints to municipal drivers.</p>
        </div>
        <div className="inline-stats">
          <span className="stat-open">Open: <strong>{stats.open}</strong></span>
          <span className="stat-assigned">Assigned: <strong>{stats.assigned}</strong></span>
          <span className="stat-resolved">Resolved: <strong>{stats.resolved}</strong></span>
          <span className="stat-critical">Critical: <strong>{stats.critical}</strong></span>
        </div>
      </div>

      <div className="toolbar">
        <div className="filters">
          <input
            type="text"
            className="form-input search-input"
            placeholder="Search Tickets or Locations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="form-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="assigned">Assigned</option>
            <option value="resolved">Resolved</option>
          </select>
          <select
            className="form-input"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="all">All Priority</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select
            className="form-input"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="table-container shadow-sm radius-md">
        <table className="data-table">
          <thead>
            <tr>
              <th>Ticket ID</th>
              <th>Evidence Photo</th>
              <th>Category</th>
              <th>Location</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Submitted At</th>
              <th>Assigned Unit UUID</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {safeGrievancesList.map((ticket) => {
              const ticketId = ticket.id || ticket.ticket_id || 'N/A';
              const photo = ticket.photo || ticket.photo_url || 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=150&auto=format&fit=crop&q=60';
              const priority = (ticket.priority || 'medium').toLowerCase();
              const status = normalizeComplaintStatus(ticket.status);
              const submittedDate = ticket.created_at || ticket.submittedAt
                ? new Date(ticket.created_at || ticket.submittedAt).toLocaleString()
                : 'N/A';
              const assignedTo = ticket.assignedDriver || ticket.assigned_driver_id || '-';

              return (
                <tr key={ticketId} className={priority === 'critical' ? 'row-critical' : ''}>
                  <td><strong>{String(ticketId).substring(0, 8)}...</strong></td>
                  <td>
                    <img src={photo} alt="Thumbnail" className="ticket-thumbnail" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 4 }} />
                  </td>
                  <td>{ticket.category || 'General Waste'}</td>
                  <td>{ticket.location || ticket.address || 'Nashik Ward'}</td>
                  <td><StatusBadge status={priority} /></td>
                  <td><StatusBadge status={status} /></td>
                  <td><small>{submittedDate}</small></td>
                  <td><code style={{ fontSize: '0.75rem' }}>{String(assignedTo).substring(0, 10)}...</code></td>
                  <td>
                    <div className="action-buttons" style={{ display: 'flex', gap: '0.25rem' }}>
                      <button className="btn btn-sm" onClick={() => handleView(ticket)}>View</button>
                      {!isResolvedComplaint(status) && (
                        <button className="btn btn-sm btn-primary" onClick={() => handleOpenAssign(ticketId)}>Assign</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {safeGrievancesList.length === 0 && !loading && (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '2rem' }}>No grievance tickets match your filter criteria.</td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '2rem' }}>Loading tickets...</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Ticket Details Modal */}
      {isDetailModalOpen && selectedTicket && (
        <Modal
          title={`Ticket Details: ${String(selectedTicket.id || selectedTicket.ticket_id).substring(0, 8)}...`}
          onClose={() => setIsDetailModalOpen(false)}
          width="600px"
        >
          <div className="ticket-detail">
            <div className="detail-header" style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <img
                src={selectedTicket.photo || selectedTicket.photo_url || 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=300&auto=format&fit=crop&q=60'}
                alt="Evidence"
                style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 6 }}
              />
              <div className="detail-info" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <h3>{selectedTicket.category || 'General Waste'}</h3>
                <p className="location-text">📍 {selectedTicket.location || selectedTicket.address || 'Nashik Ward Central'}</p>
                <div className="badge-row" style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <StatusBadge status={(selectedTicket.priority || 'medium').toLowerCase()} />
                  <StatusBadge status={(selectedTicket.status || 'open').toLowerCase()} />
                </div>
              </div>
            </div>

            {selectedTicket.resolved_image_url && (
              <div className="detail-section" style={{ marginBottom: '0.75rem' }}>
                <h4>Resolution Proof Photo</h4>
                <img src={selectedTicket.resolved_image_url} alt="Resolved Site" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 6 }} />
              </div>
            )}

            <div className="detail-section" style={{ marginBottom: '0.75rem' }}>
              <h4>Description</h4>
              <p>{selectedTicket.description || 'No detailed description provided.'}</p>
            </div>

            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              {!isResolvedComplaint(selectedTicket.status) && (
                <>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setIsDetailModalOpen(false);
                      handleOpenAssign(selectedTicket.id || selectedTicket.ticket_id);
                    }}
                  >
                    Assign to Fleet
                  </button>
                  <button
                    className="btn btn-success"
                    onClick={() => {
                      handleOpenResolve(selectedTicket.id || selectedTicket.ticket_id);
                    }}
                  >
                    Mark Resolved (Upload Proof)
                  </button>
                </>
              )}
              <button className="btn" onClick={() => setIsDetailModalOpen(false)}>Close</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Driver Assignment Modal (Using Real Vehicle UUIDs) */}
      {isAssignModalOpen && (
        <Modal
          title={`Assign Ticket`}
          onClose={() => setIsAssignModalOpen(false)}
        >
          <form onSubmit={handleConfirmAssign} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Active Municipal Fleet Units (Database)</label>
              <select
                className="form-input"
                required
                value={selectedDriver}
                onChange={(e) => setSelectedDriver(e.target.value)}
              >
                <option value="" disabled>Select driver / vehicle unit...</option>
                {availableDrivers.map((v) => {
                  const vehicleId = v.id || v.vehicle_id;
                  const driverId = v.driver_id || vehicleId;
                  const driverName = v.driver_name || v.driverName || 'Driver';
                  const plate = v.license_plate || 'MH-15';
                  return (
                    <option key={vehicleId} value={driverId}>
                      {driverName} — {plate} (UUID: {String(vehicleId).substring(0, 8)}...)
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" className="btn" onClick={() => setIsAssignModalOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={!selectedDriver}>Confirm Assignment</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Resolve Proof Upload Modal */}
      {isResolveModalOpen && (
        <Modal
          title="Upload Resolution Proof (TrashBot AI Verified)"
          onClose={() => !isVerifyingTrashBot && setIsResolveModalOpen(false)}
        >
          <form onSubmit={handleConfirmResolve} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.825rem' }}>
              <strong>🤖 TrashBot AI Waste Monitoring Model Integrated</strong>
              <p style={{ margin: '0.25rem 0 0 0', color: '#64748b' }}>
                Every resolution proof photo is automatically verified using the TrashBot Computer Vision AI model to confirm the site has been cleaned before closing the ticket.
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">Cleaned Site Photo *</label>
              <input
                type="file"
                accept="image/*"
                className="form-input"
                required
                disabled={isVerifyingTrashBot}
                onChange={(e) => {
                  setResolvedImageFile(e.target.files[0]);
                  setTrashBotError('');
                }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Resolution Notes</label>
              <textarea
                className="form-input"
                placeholder="Optional comments on cleanup..."
                value={resolutionNotes}
                disabled={isVerifyingTrashBot}
                onChange={(e) => setResolutionNotes(e.target.value)}
              />
            </div>

            {trashBotError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', padding: '0.75rem', borderRadius: 8, color: '#991b1b', fontSize: '0.85rem' }}>
                {trashBotError}
              </div>
            )}

            {isVerifyingTrashBot && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0284c7', fontSize: '0.85rem', fontWeight: 600 }}>
                <span>🤖 TrashBot AI model is evaluating site cleanliness & waste clearance...</span>
              </div>
            )}

            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" className="btn" disabled={isVerifyingTrashBot} onClick={() => setIsResolveModalOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-success" disabled={!resolvedImageFile || isVerifyingTrashBot}>
                {isVerifyingTrashBot ? 'Running TrashBot AI...' : 'Submit & Resolve'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}