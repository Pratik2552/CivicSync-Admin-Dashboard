import React, { useState, useEffect } from 'react';
import { WARDS } from '../data/bins.js';
import { getBins, addBin, updateBin, deleteBin, simulateIoTTelemetry, resetBinData } from '../services/api.js';
import Modal from '../components/common/Modal.jsx';
import './Bins.css';

export default function Bins() {
  const [bins, setBins] = useState([]);
  const [stats, setStats] = useState({ total: 0, critical: 0, warning: 0, normal: 0 });
  const [loading, setLoading] = useState(false);
  const [simulating, setSimulating] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [wardFilter, setWardFilter] = useState('All Wards');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBin, setEditingBin] = useState(null);
  const [formData, setFormData] = useState({ ward: '', lat: '', lng: '', zone: '', fill_level: 0 });

  // Sorting
  const [sortConfig, setSortConfig] = useState({ key: 'priority_score', direction: 'desc' });

  useEffect(() => {
    loadBins();
  }, [wardFilter, statusFilter, search]);

  const calculateStats = (binList) => {
    let critical = 0;
    let warning = 0;
    let normal = 0;

    binList.forEach((b) => {
      const fill = b.fill_level ?? b.fillLevel ?? 0;
      const status = (b.status || '').toLowerCase();

      if (fill > 85 || status === 'critical') critical++;
      else if (fill >= 50 || status === 'warning') warning++;
      else normal++;
    });

    setStats({
      total: binList.length,
      critical,
      warning,
      normal,
    });
  };

  const loadBins = async () => {
    try {
      setLoading(true);
      const data = await getBins({ ward: wardFilter, status: statusFilter, search });
      const binArray = Array.isArray(data) ? data : data?.bins || [];
      setBins(binArray);
      calculateStats(binArray);
    } catch (error) {
      console.error('Error loading bins:', error);
      setBins([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateTelemetry = async () => {
    try {
      setSimulating(true);
      await simulateIoTTelemetry();
      await loadBins();
    } catch (error) {
      console.error('Error simulating telemetry:', error);
    } finally {
      setSimulating(false);
    }
  };

  const handleResetSimulation = async () => {
    if (window.confirm('Reset all bin data back to 40 mock baseline bins in Supabase?')) {
      try {
        setLoading(true);
        await resetBinData();
        await loadBins();
      } catch (error) {
        console.error('Error resetting simulation:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Safe accessor for sortable values
  const getSortableValue = (bin, key) => {
    if (key === 'fillLevel') return bin.fill_level ?? bin.fillLevel ?? 0;
    if (key === 'priorityScore') return bin.priority_score ?? bin.priorityScore ?? 0;
    if (key === 'batteryLevel') return bin.battery_level ?? bin.batteryLevel ?? 100;
    if (key === 'lastCollection') return bin.last_collected ?? bin.lastCollection ?? '';
    if (key === 'lat') return bin.latitude ?? bin.lat ?? 0;
    if (key === 'lng') return bin.longitude ?? bin.lng ?? 0;
    return bin[key] ?? '';
  };

  const sortedBins = [...bins].sort((a, b) => {
    const valA = getSortableValue(a, sortConfig.key);
    const valB = getSortableValue(b, sortConfig.key);

    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const handleOpenModal = (bin = null) => {
    if (bin) {
      setEditingBin(bin);
      setFormData({
        ward: bin.ward || '',
        lat: bin.latitude || bin.lat || '',
        lng: bin.longitude || bin.lng || '',
        zone: bin.zone || '',
        fill_level: bin.fill_level ?? bin.fillLevel ?? 0,
      });
    } else {
      setEditingBin(null);
      setFormData({ ward: '', lat: '', lng: '', zone: '', fill_level: 0 });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ward: formData.ward,
        latitude: parseFloat(formData.lat),
        longitude: parseFloat(formData.lng),
        fill_level: parseInt(formData.fill_level, 10) || 0,
        zone: formData.zone,
      };

      if (editingBin) {
        await updateBin(editingBin.id, payload);
      } else {
        await addBin(payload);
      }
      setIsModalOpen(false);
      await loadBins();
    } catch (error) {
      console.error('Error saving bin:', error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this bin?')) {
      try {
        await deleteBin(id);
        await loadBins();
      } catch (error) {
        console.error('Error deleting bin:', error);
      }
    }
  };

  return (
    <div className="bins-page">
      <div className="page-header">
        <div>
          <h1>IoT Bin Management</h1>
          <p className="page-subheading">Real-time fill level telemetry, priority scoring, and ward metrics.</p>
        </div>
        <div className="inline-stats">
          <span>Total: <strong>{stats.total}</strong></span>
          <span className="stat-critical">Critical: <strong>{stats.critical}</strong></span>
          <span className="stat-warning">Warning: <strong>{stats.warning}</strong></span>
          <span className="stat-normal">Normal: <strong>{stats.normal}</strong></span>
        </div>
      </div>

      <div className="toolbar" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="filters" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="form-input search-input"
            placeholder="Search Bins..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="form-input"
            value={wardFilter}
            onChange={(e) => setWardFilter(e.target.value)}
          >
            {WARDS.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
          <select
            className="form-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="normal">Normal</option>
          </select>
        </div>

        <div className="toolbar-actions" style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn btn-secondary"
            onClick={handleSimulateTelemetry}
            disabled={simulating || loading}
          >
            {simulating ? 'Simulating Sensor Delta…' : '📡 Simulate Telemetry'}
          </button>
          <button
            className="btn btn-outline"
            onClick={handleResetSimulation}
            disabled={loading}
          >
            🔄 Reset Seed
          </button>
          <button className="btn btn-primary" onClick={() => handleOpenModal()}>
            + Add Bin
          </button>
        </div>
      </div>

      <div className="table-container shadow-sm radius-md">
        <table className="data-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('id')}>
                Bin ID {sortConfig.key === 'id' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('ward')}>
                Ward / Zone {sortConfig.key === 'ward' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('batteryLevel')}>
                Battery {sortConfig.key === 'batteryLevel' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('fillLevel')}>
                Fill Level % {sortConfig.key === 'fillLevel' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('lastCollection')}>
                Last Collection {sortConfig.key === 'lastCollection' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('priorityScore')}>
                Priority Score {sortConfig.key === 'priorityScore' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedBins.map((bin) => {
              const fill = bin.fill_level ?? bin.fillLevel ?? 0;
              const battery = bin.battery_level ?? bin.batteryLevel ?? 100;
              const priority = bin.priority_score ?? bin.priorityScore ?? 0;
              const lastCollect = bin.last_collected
                ? new Date(bin.last_collected).toLocaleString()
                : bin.lastCollection || 'N/A';

              return (
                <tr key={bin.id} className={fill > 85 ? 'row-critical' : ''}>
                  <td>
                    <strong>{String(bin.id).substring(0, 8)}...</strong>
                  </td>
                  <td>
                    {bin.ward || 'Ward Central'}{' '}
                    <br />
                    <small className="text-muted">{bin.zone || 'Zone A'}</small>
                  </td>
                  <td>
                    <div className="battery-cell">
                      <span className={battery < 30 ? 'text-danger font-bold' : ''}>{battery}%</span>
                      {battery < 30 && (
                        <span className="warning-icon" title="Low Battery" style={{ marginLeft: 4 }}>
                          ⚠️
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="fill-cell">
                      <span className="fill-text" style={{ fontWeight: 600 }}>{fill}%</span>
                      <div className="progress-bar-bg" style={{ background: '#eee', height: 8, borderRadius: 4, marginTop: 4 }}>
                        <div
                          className={`progress-bar-fill ${fill < 50 ? 'bg-green' : fill <= 85 ? 'bg-amber' : 'bg-red'}`}
                          style={{
                            width: `${fill}%`,
                            height: '100%',
                            borderRadius: 4,
                            backgroundColor: fill < 50 ? '#2e7d32' : fill <= 85 ? '#f57c00' : '#d32f2f',
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td>
                    <small>{lastCollect}</small>
                  </td>
                  <td>
                    <span
                      className={`priority-score ${
                        priority > 8.0
                          ? 'text-danger font-bold'
                          : priority > 5.0
                          ? 'text-warning font-bold'
                          : ''
                      }`}
                    >
                      {Number(priority).toFixed(1)}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons" style={{ display: 'flex', gap: '0.25rem' }}>
                      <button className="btn btn-sm" onClick={() => handleOpenModal(bin)}>
                        Edit
                      </button>
                      <button className="btn btn-sm text-danger" onClick={() => handleDelete(bin.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {sortedBins.length === 0 && !loading && (
              <tr>
                <td colSpan="7" className="text-center py-4" style={{ textAlign: 'center', padding: '2rem' }}>
                  No bins found matching your search criteria.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan="7" className="text-center py-4" style={{ textAlign: 'center', padding: '2rem' }}>
                  Loading bins telemetry...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <Modal
          title={editingBin ? `Edit Bin ${String(editingBin.id).substring(0, 8)}` : 'Add New Bin'}
          onClose={() => setIsModalOpen(false)}
        >
          <form onSubmit={handleSave} className="bin-form" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Ward / Location</label>
              <input
                type="text"
                className="form-input"
                required
                value={formData.ward}
                onChange={(e) => setFormData({ ...formData, ward: e.target.value })}
                placeholder="e.g. Shivajinagar, Ward 1"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Zone</label>
              <input
                type="text"
                className="form-input"
                value={formData.zone}
                onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                placeholder="e.g. Zone A"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Initial Fill Level (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                className="form-input"
                value={formData.fill_level}
                onChange={(e) => setFormData({ ...formData, fill_level: e.target.value })}
              />
            </div>
            <div className="form-row" style={{ display: 'flex', gap: '1rem' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Latitude</label>
                <input
                  type="number"
                  step="0.000001"
                  className="form-input"
                  required
                  value={formData.lat}
                  onChange={(e) => setFormData({ ...formData, lat: e.target.value })}
                  placeholder="18.5204"
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Longitude</label>
                <input
                  type="number"
                  step="0.000001"
                  className="form-input"
                  required
                  value={formData.lng}
                  onChange={(e) => setFormData({ ...formData, lng: e.target.value })}
                  placeholder="73.8567"
                />
              </div>
            </div>
            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save Bin
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}