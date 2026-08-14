import React, { useState, useEffect } from 'react';
import { WARDS, getBinStats } from '../data/bins.js';
import { getBins, addBin, updateBin, deleteBin } from '../services/api.js';
import Modal from '../components/common/Modal.jsx';
import StatusBadge from '../components/common/StatusBadge.jsx';
import './Bins.css';

export default function Bins() {
  const [bins, setBins] = useState([]);
  const [stats, setStats] = useState({ total: 0, critical: 0, warning: 0, normal: 0 });
  
  // Filters
  const [search, setSearch] = useState('');
  const [wardFilter, setWardFilter] = useState('All Wards');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBin, setEditingBin] = useState(null);
  const [formData, setFormData] = useState({ ward: '', lat: '', lng: '', zone: '' });
  
  // Sorting
  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'asc' });

  useEffect(() => {
    loadBins();
    setStats(getBinStats());
  }, [wardFilter, statusFilter, search]);

  const loadBins = async () => {
    try {
      const data = await getBins({ ward: wardFilter, status: statusFilter, search });
      setBins(data);
    } catch (error) {
      console.error('Error loading bins:', error);
    }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedBins = [...bins].sort((a, b) => {
    if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
    if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const handleOpenModal = (bin = null) => {
    if (bin) {
      setEditingBin(bin);
      setFormData({ ward: bin.ward, lat: bin.lat, lng: bin.lng, zone: bin.zone || '' });
    } else {
      setEditingBin(null);
      setFormData({ ward: '', lat: '', lng: '', zone: '' });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editingBin) {
        await updateBin(editingBin.id, {
          ward: formData.ward,
          lat: parseFloat(formData.lat),
          lng: parseFloat(formData.lng),
          zone: formData.zone
        });
      } else {
        await addBin({
          ward: formData.ward,
          lat: parseFloat(formData.lat),
          lng: parseFloat(formData.lng),
          zone: formData.zone
        });
      }
      setIsModalOpen(false);
      loadBins();
      setStats(getBinStats());
    } catch (error) {
      console.error('Error saving bin:', error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this bin?')) {
      try {
        await deleteBin(id);
        loadBins();
        setStats(getBinStats());
      } catch (error) {
        console.error('Error deleting bin:', error);
      }
    }
  };

  return (
    <div className="bins-page">
      <div className="page-header">
        <h1>IoT Bin Management</h1>
        <div className="inline-stats">
          <span>Total: {stats.total}</span>
          <span className="stat-critical">Critical: {stats.critical}</span>
          <span className="stat-warning">Warning: {stats.warning}</span>
          <span className="stat-normal">Normal: {stats.normal}</span>
        </div>
      </div>

      <div className="toolbar">
        <div className="filters">
          <input 
            type="text" 
            className="form-input search-input" 
            placeholder="Search Bins..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select 
            className="form-input" 
            value={wardFilter} 
            onChange={e => setWardFilter(e.target.value)}
          >
            {WARDS.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
          <select 
            className="form-input" 
            value={statusFilter} 
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="normal">Normal</option>
          </select>
        </div>
        <button className="btn btn-primary" onClick={() => handleOpenModal()}>+ Add Bin</button>
      </div>

      <div className="table-container shadow-sm radius-md">
        <table className="data-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('id')}>Bin ID {sortConfig.key === 'id' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
              <th onClick={() => handleSort('ward')}>Ward / Zone {sortConfig.key === 'ward' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
              <th onClick={() => handleSort('batteryLevel')}>Battery {sortConfig.key === 'batteryLevel' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
              <th onClick={() => handleSort('fillLevel')}>Fill Level % {sortConfig.key === 'fillLevel' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
              <th onClick={() => handleSort('lastCollection')}>Last Collection {sortConfig.key === 'lastCollection' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
              <th onClick={() => handleSort('priorityScore')}>Priority Score {sortConfig.key === 'priorityScore' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedBins.map(bin => (
              <tr key={bin.id} className={bin.fillLevel > 85 ? 'row-critical' : ''}>
                <td><strong>{bin.id}</strong></td>
                <td>{bin.ward} <br/><small className="text-muted">{bin.zone}</small></td>
                <td>
                  <div className="battery-cell">
                    <span className={bin.batteryLevel < 30 ? 'text-danger' : ''}>{bin.batteryLevel}%</span>
                    {bin.batteryLevel < 30 && <span className="warning-icon" title="Low Battery">⚠️</span>}
                  </div>
                </td>
                <td>
                  <div className="fill-cell">
                    <span className="fill-text">{bin.fillLevel}%</span>
                    <div className="progress-bar-bg">
                      <div 
                        className={`progress-bar-fill ${bin.fillLevel < 50 ? 'bg-green' : bin.fillLevel <= 85 ? 'bg-amber' : 'bg-red'}`} 
                        style={{ width: `${bin.fillLevel}%` }}
                      ></div>
                    </div>
                  </div>
                </td>
                <td>
                  <div>{bin.lastCollection}</div>
                </td>
                <td>
                  <span className={`priority-score ${bin.priorityScore > 8.0 ? 'text-danger font-bold' : bin.priorityScore > 5.0 ? 'text-warning font-bold' : ''}`}>
                    {bin.priorityScore.toFixed(1)}
                  </span>
                </td>
                <td>
                  <div className="action-buttons">
                    <button className="btn btn-sm" onClick={() => handleOpenModal(bin)}>Edit</button>
                    <button className="btn btn-sm text-danger" onClick={() => handleDelete(bin.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {sortedBins.length === 0 && (
              <tr>
                <td colSpan="7" className="text-center py-4">No bins found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <Modal 
          title={editingBin ? `Edit Bin ${editingBin.id}` : 'Add New Bin'} 
          onClose={() => setIsModalOpen(false)}
        >
          <form onSubmit={handleSave} className="bin-form">
            <div className="form-group">
              <label className="form-label">Ward/Zone</label>
              <input 
                type="text" 
                className="form-input" 
                required 
                value={formData.ward} 
                onChange={e => setFormData({...formData, ward: e.target.value})} 
                placeholder="e.g. Ward 1 - Shivajinagar"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Depot Location (Zone)</label>
              <input 
                type="text" 
                className="form-input" 
                value={formData.zone} 
                onChange={e => setFormData({...formData, zone: e.target.value})} 
                placeholder="e.g. Zone A"
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Latitude</label>
                <input 
                  type="number" 
                  step="0.000001" 
                  className="form-input" 
                  required 
                  value={formData.lat} 
                  onChange={e => setFormData({...formData, lat: e.target.value})} 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Longitude</label>
                <input 
                  type="number" 
                  step="0.000001" 
                  className="form-input" 
                  required 
                  value={formData.lng} 
                  onChange={e => setFormData({...formData, lng: e.target.value})} 
                />
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Bin</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
