import React, { useState, useEffect } from 'react';
import { getGrievances, assignGrievance, resolveGrievance } from '../services/api.js';
import { getGrievanceStats } from '../data/grievances.js';
import { DRIVERS } from '../data/drivers.js';
import StatusBadge from '../components/common/StatusBadge.jsx';
import Modal from '../components/common/Modal.jsx';
import './Grievances.css';

const CATEGORIES = ['All Categories', 'Overflow / Bin Full', 'Missed Collection', 'Illegal Dumping', 'Littering', 'Damaged Bin', 'Bad Odour', 'Road Blockage'];

export default function Grievances() {
  const [grievances, setGrievances] = useState([]);
  const [stats, setStats] = useState({ open: 0, assigned: 0, resolved: 0, critical: 0 });
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');

  const [selectedTicket, setSelectedTicket] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  
  const [assignTicketId, setAssignTicketId] = useState(null);
  const [selectedDriver, setSelectedDriver] = useState('');

  useEffect(() => {
    loadGrievances();
    setStats(getGrievanceStats());
  }, [statusFilter, priorityFilter, categoryFilter, search]);

  const loadGrievances = async () => {
    try {
      let data = await getGrievances({ status: statusFilter, priority: priorityFilter, search });
      if (categoryFilter !== 'All Categories') {
        data = data.filter(g => g.category === categoryFilter);
      }
      setGrievances(data);
    } catch (error) {
      console.error('Error loading grievances:', error);
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

  const handleConfirmAssign = async (e) => {
    e.preventDefault();
    if (!selectedDriver) return;
    try {
      await assignGrievance(assignTicketId, selectedDriver);
      setIsAssignModalOpen(false);
      loadGrievances();
      setStats(getGrievanceStats());
      if (selectedTicket && selectedTicket.id === assignTicketId) {
        setSelectedTicket({...selectedTicket, status: 'assigned', assignedDriver: selectedDriver});
      }
    } catch (error) {
      console.error('Error assigning grievance:', error);
    }
  };

  const handleResolve = async (ticketId) => {
    try {
      await resolveGrievance(ticketId);
      loadGrievances();
      setStats(getGrievanceStats());
      if (selectedTicket && selectedTicket.id === ticketId) {
        setSelectedTicket({...selectedTicket, status: 'resolved'});
      }
    } catch (error) {
      console.error('Error resolving grievance:', error);
    }
  };

  const availableDrivers = DRIVERS.filter(d => d.status === 'active' || d.status === 'in_transit');

  return (
    <div className="grievances-page">
      <div className="page-header">
        <h1>Citizen Grievances</h1>
        <div className="inline-stats">
          <span className="stat-open">Open: {stats.open}</span>
          <span className="stat-assigned">Assigned: {stats.assigned}</span>
          <span className="stat-resolved">Resolved: {stats.resolved}</span>
          <span className="stat-critical">Critical: {stats.critical}</span>
        </div>
      </div>

      <div className="toolbar">
        <div className="filters">
          <input 
            type="text" 
            className="form-input search-input" 
            placeholder="Search Tickets..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select 
            className="form-input" 
            value={statusFilter} 
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="assigned">Assigned</option>
            <option value="resolved">Resolved</option>
          </select>
          <select 
            className="form-input" 
            value={priorityFilter} 
            onChange={e => setPriorityFilter(e.target.value)}
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
            onChange={e => setCategoryFilter(e.target.value)}
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="table-container shadow-sm radius-md">
        <table className="data-table">
          <thead>
            <tr>
              <th>Ticket ID</th>
              <th>Photo</th>
              <th>Category</th>
              <th>Location</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Submitted</th>
              <th>Assigned To</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {grievances.map(ticket => (
              <tr key={ticket.id} className={ticket.priority === 'critical' ? 'row-critical' : ''}>
                <td><strong>{ticket.id}</strong></td>
                <td>
                  <img src={ticket.photo} alt="Thumbnail" className="ticket-thumbnail" />
                </td>
                <td>{ticket.category}</td>
                <td>{ticket.location}</td>
                <td><StatusBadge status={ticket.priority} /></td>
                <td><StatusBadge status={ticket.status} /></td>
                <td><small>{ticket.submittedAt}</small></td>
                <td>{ticket.assignedDriver || '-'}</td>
                <td>
                  <div className="action-buttons">
                    <button className="btn btn-sm" onClick={() => handleView(ticket)}>View</button>
                    {ticket.status !== 'resolved' && (
                      <button className="btn btn-sm btn-primary" onClick={() => handleOpenAssign(ticket.id)}>Assign</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {grievances.length === 0 && (
              <tr>
                <td colSpan="9" className="text-center py-4">No tickets found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isDetailModalOpen && selectedTicket && (
        <Modal title={`Ticket Details: ${selectedTicket.id}`} onClose={() => setIsDetailModalOpen(false)} width="600px">
          <div className="ticket-detail">
            <div className="detail-header">
              <img src={selectedTicket.photo} alt="Evidence" className="detail-photo" />
              <div className="detail-info">
                <h3>{selectedTicket.category}</h3>
                <p className="location-text">📍 {selectedTicket.location}</p>
                <div className="badge-row">
                  <StatusBadge status={selectedTicket.priority} />
                  <StatusBadge status={selectedTicket.status} />
                  <span className={`ai-badge ${selectedTicket.aiVerified ? 'verified' : 'unverified'}`}>
                    {selectedTicket.aiVerified ? '🛡️ AI Verified' : '⚠️ Unverified'}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="detail-section">
              <h4>Description</h4>
              <p>{selectedTicket.description}</p>
            </div>
            
            <div className="detail-section">
              <h4>Citizen Info</h4>
              <p>Name: {selectedTicket.citizenName}</p>
              <p>Phone: {selectedTicket.phone}</p>
            </div>

            <div className="detail-section timeline">
              <h4>Timeline</h4>
              <p><strong>Submitted:</strong> {selectedTicket.submittedAt}</p>
              {selectedTicket.assignedDriver && (
                <p><strong>Assigned To:</strong> {selectedTicket.assignedDriver}</p>
              )}
              {selectedTicket.resolvedAt && (
                <p><strong>Resolved:</strong> {selectedTicket.resolvedAt}</p>
              )}
            </div>
            
            <div className="modal-actions">
              {selectedTicket.status !== 'resolved' && (
                <>
                  <button className="btn btn-primary" onClick={() => { setIsDetailModalOpen(false); handleOpenAssign(selectedTicket.id); }}>
                    Assign to Fleet
                  </button>
                  <button className="btn btn-success" onClick={() => handleResolve(selectedTicket.id)}>
                    Mark Resolved
                  </button>
                </>
              )}
              <button className="btn" onClick={() => setIsDetailModalOpen(false)}>Close</button>
            </div>
          </div>
        </Modal>
      )}

      {isAssignModalOpen && (
        <Modal title={`Assign ${assignTicketId} to Fleet`} onClose={() => setIsAssignModalOpen(false)}>
          <form onSubmit={handleConfirmAssign} className="assign-form">
            <p>Select an active driver to assign this ticket to.</p>
            <div className="form-group">
              <label className="form-label">Available Drivers</label>
              <select 
                className="form-input" 
                required
                value={selectedDriver}
                onChange={e => setSelectedDriver(e.target.value)}
              >
                <option value="" disabled>Select a driver...</option>
                {availableDrivers.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.id}) - {d.status}</option>
                ))}
              </select>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setIsAssignModalOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={!selectedDriver}>Confirm Assignment</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
