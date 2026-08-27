import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, MapPin, Activity, Award, CheckCircle, XCircle, Eye, Search, Filter } from 'lucide-react';
import { getAllCitizens, getCitizenById, toggleCitizenStatus } from '../services/api.js';
import Modal from '../components/common/Modal.jsx';
import './LiveUsers.css';

export default function LiveUsers() {
  const [citizens, setCitizens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedCitizen, setSelectedCitizen] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    fetchCitizens();
  }, []);

  const fetchCitizens = async () => {
    try {
      setLoading(true);
      const data = await getAllCitizens();
      setCitizens(data);
      setError('');
    } catch (err) {
      console.error('Error fetching citizens:', err);
      setError('Failed to load citizens: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (citizenId) => {
    try {
      setDetailLoading(true);
      setShowDetailModal(true);
      const response = await getCitizenById(citizenId);
      setSelectedCitizen(response.citizen);
    } catch (err) {
      console.error('Error fetching citizen details:', err);
      setError('Failed to load citizen details: ' + err.message);
      setShowDetailModal(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleToggleStatus = async (citizenId) => {
    try {
      await toggleCitizenStatus(citizenId);
      fetchCitizens();
      if (selectedCitizen && selectedCitizen.id === citizenId) {
        setSelectedCitizen({ ...selectedCitizen, is_active: !selectedCitizen.is_active });
      }
    } catch (err) {
      console.error('Error toggling citizen status:', err);
      setError('Failed to update citizen status: ' + err.message);
    }
  };

  const filteredCitizens = citizens.filter(citizen => {
    const matchesSearch = search === '' || 
      citizen.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      citizen.email?.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && citizen.is_active) ||
      (statusFilter === 'inactive' && !citizen.is_active);

    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: citizens.length,
    active: citizens.filter(c => c.is_active).length,
    inactive: citizens.filter(c => !c.is_active).length,
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1><User size={24} /> Live Users</h1>
        </div>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p>Loading citizens...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1><User size={24} /> Live Users</h1>
          <p className="page-subtitle">Monitor and manage registered citizens</p>
        </div>
        <button className="btn btn-primary" onClick={fetchCitizens}>
          <Activity size={16} /> Refresh
        </button>
      </div>

      {error && (
        <div className="alert alert-error" style={{ margin: '1rem 0' }}>
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: '#3b82f6' }}>
            <User size={24} />
          </div>
          <div className="stat-card-content">
            <div className="stat-card-value">{stats.total}</div>
            <div className="stat-card-label">Total Citizens</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: '#10b981' }}>
            <CheckCircle size={24} />
          </div>
          <div className="stat-card-content">
            <div className="stat-card-value">{stats.active}</div>
            <div className="stat-card-label">Active Users</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: '#ef4444' }}>
            <XCircle size={24} />
          </div>
          <div className="stat-card-content">
            <div className="stat-card-value">{stats.inactive}</div>
            <div className="stat-card-label">Inactive Users</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <Filter size={18} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Users</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Citizens Table */}
      <div className="card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Citizen</th>
                <th>Contact</th>
                <th>Complaints</th>
                <th>Carbon Points</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCitizens.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>
                    No citizens found
                  </td>
                </tr>
              ) : (
                filteredCitizens.map(citizen => (
                  <tr key={citizen.id}>
                    <td>
                      <div className="user-cell">
                        <div className="user-avatar">
                          {citizen.avatar_url ? (
                            <img src={citizen.avatar_url} alt={citizen.full_name} />
                          ) : (
                            <User size={20} />
                          )}
                        </div>
                        <div>
                          <div className="user-name">{citizen.full_name || 'N/A'}</div>
                          <div className="user-email">{citizen.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="contact-cell">
                        {citizen.phone && (
                          <div className="contact-item">
                            <Phone size={14} />
                            {citizen.phone}
                          </div>
                        )}
                        {citizen.address && (
                          <div className="contact-item">
                            <MapPin size={14} />
                            {citizen.address.substring(0, 30)}
                            {citizen.address.length > 30 && '...'}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="stats-cell">
                        <span className="stat-badge stat-badge-total">
                          {citizen.stats?.total_complaints || 0} Total
                        </span>
                        <span className="stat-badge stat-badge-resolved">
                          {citizen.stats?.resolved_complaints || 0} Resolved
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="carbon-cell">
                        <Award size={16} style={{ color: '#f59e0b' }} />
                        <span>{citizen.carbon_card?.total_points || 0} pts</span>
                        <span className="carbon-tier">{citizen.carbon_card?.tier || 'Bronze'}</span>
                      </div>
                    </td>
                    <td>
                      <button
                        className={`status-badge ${citizen.is_active ? 'status-active' : 'status-inactive'}`}
                        onClick={() => handleToggleStatus(citizen.id)}
                        title="Click to toggle status"
                      >
                        {citizen.is_active ? (
                          <>
                            <CheckCircle size={14} /> Active
                          </>
                        ) : (
                          <>
                            <XCircle size={14} /> Inactive
                          </>
                        )}
                      </button>
                    </td>
                    <td>
                      {new Date(citizen.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleViewDetails(citizen.id)}
                      >
                        <Eye size={14} /> View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Citizen Detail Modal */}
      {showDetailModal && (
        <Modal
          title="Citizen Profile"
          onClose={() => {
            setShowDetailModal(false);
            setSelectedCitizen(null);
          }}
        >
          {detailLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <p>Loading citizen details...</p>
            </div>
          ) : selectedCitizen ? (
            <div className="citizen-detail">
              {/* Header */}
              <div className="citizen-detail-header">
                <div className="citizen-detail-avatar">
                  {selectedCitizen.avatar_url ? (
                    <img src={selectedCitizen.avatar_url} alt={selectedCitizen.full_name} />
                  ) : (
                    <User size={48} />
                  )}
                </div>
                <div className="citizen-detail-info">
                  <h2>{selectedCitizen.full_name}</h2>
                  <p className="citizen-detail-email">
                    <Mail size={16} /> {selectedCitizen.email}
                  </p>
                  <div className="citizen-detail-status">
                    <button
                      className={`status-badge ${selectedCitizen.is_active ? 'status-active' : 'status-inactive'}`}
                      onClick={() => handleToggleStatus(selectedCitizen.id)}
                    >
                      {selectedCitizen.is_active ? (
                        <>
                          <CheckCircle size={14} /> Active
                        </>
                      ) : (
                        <>
                          <XCircle size={14} /> Inactive
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="citizen-detail-stats">
                <div className="detail-stat">
                  <div className="detail-stat-value">{selectedCitizen.stats?.total_complaints || 0}</div>
                  <div className="detail-stat-label">Total Complaints</div>
                </div>
                <div className="detail-stat">
                  <div className="detail-stat-value">{selectedCitizen.stats?.resolved_complaints || 0}</div>
                  <div className="detail-stat-label">Resolved</div>
                </div>
                <div className="detail-stat">
                  <div className="detail-stat-value">{selectedCitizen.stats?.pending_complaints || 0}</div>
                  <div className="detail-stat-label">Pending</div>
                </div>
                <div className="detail-stat">
                  <div className="detail-stat-value">{selectedCitizen.carbon_card?.total_points || 0}</div>
                  <div className="detail-stat-label">Carbon Points</div>
                </div>
              </div>

              {/* Contact Info */}
              <div className="citizen-detail-section">
                <h3>Contact Information</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <Phone size={16} />
                    <span>{selectedCitizen.phone || 'Not provided'}</span>
                  </div>
                  <div className="detail-item">
                    <MapPin size={16} />
                    <span>{selectedCitizen.address || 'Not provided'}</span>
                  </div>
                  <div className="detail-item">
                    <Mail size={16} />
                    <span>{selectedCitizen.email}</span>
                  </div>
                </div>
              </div>

              {/* Carbon Card */}
              <div className="citizen-detail-section">
                <h3>Carbon Card</h3>
                <div className="carbon-card-display">
                  <div className="carbon-card-item">
                    <span>Tier:</span>
                    <span className="carbon-tier-badge">{selectedCitizen.carbon_card?.tier || 'Bronze'}</span>
                  </div>
                  <div className="carbon-card-item">
                    <span>Total Points:</span>
                    <strong>{selectedCitizen.carbon_card?.total_points || 0}</strong>
                  </div>
                  <div className="carbon-card-item">
                    <span>Available Points:</span>
                    <strong>{selectedCitizen.carbon_card?.available_points || 0}</strong>
                  </div>
                </div>
              </div>

              {/* Recent Complaints */}
              <div className="citizen-detail-section">
                <h3>Recent Complaints</h3>
                {selectedCitizen.complaints && selectedCitizen.complaints.length > 0 ? (
                  <div className="complaints-list">
                    {selectedCitizen.complaints.slice(0, 5).map(complaint => (
                      <div key={complaint.id} className="complaint-item">
                        <div className="complaint-header">
                          <span className="complaint-category">{complaint.category}</span>
                          <span className={`complaint-status status-${complaint.status.toLowerCase()}`}>
                            {complaint.status}
                          </span>
                        </div>
                        <div className="complaint-description">
                          {complaint.description || 'No description'}
                        </div>
                        <div className="complaint-date">
                          {new Date(complaint.created_at).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ textAlign: 'center', color: '#64748b', padding: '1rem' }}>
                    No complaints filed yet
                  </p>
                )}
              </div>

              {/* Account Info */}
              <div className="citizen-detail-section">
                <h3>Account Information</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span>User ID:</span>
                    <code>{selectedCitizen.id.substring(0, 8)}...</code>
                  </div>
                  <div className="detail-item">
                    <span>Joined:</span>
                    <span>{new Date(selectedCitizen.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="detail-item">
                    <span>Last Updated:</span>
                    <span>{new Date(selectedCitizen.updated_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p style={{ padding: '2rem', textAlign: 'center' }}>No data available</p>
          )}
        </Modal>
      )}
    </div>
  );
}
