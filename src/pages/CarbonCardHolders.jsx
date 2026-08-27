import React, { useState, useEffect, useCallback } from 'react';
import { getCarbonCardHolders } from '../services/api.js';
import './Grievances.css';

const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL)
  ? import.meta.env.VITE_API_URL
  : 'http://localhost:3000/api';

const TIER_ORDER = { PLATINUM: 4, GOLD: 3, SILVER: 2, BRONZE: 1 };
const TIER_COLORS = { PLATINUM: '#94a3b8', GOLD: '#f59e0b', SILVER: '#9ca3af', BRONZE: '#10b981' };
const TIER_BG    = { PLATINUM: '#f1f5f9', GOLD: '#fffbeb', SILVER: '#f9fafb', BRONZE: '#f0fdf4' };

export default function CarbonCardHolders() {
  const [holders, setHolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');
  const [tierFilter, setTierFilter] = useState('ALL');

  const fetchHolders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const users = await getCarbonCardHolders();
      setHolders(users);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHolders();
    // Auto-refresh every 60s so points stay current
    const interval = setInterval(fetchHolders, 60000);
    return () => clearInterval(interval);
  }, [fetchHolders]);

  const filtered = holders.filter(h => {
    const matchTier   = tierFilter === 'ALL' || h.tier === tierFilter;
    const matchSearch = !search ||
      (h.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (h.email || '').toLowerCase().includes(search.toLowerCase());
    return matchTier && matchSearch;
  });

  const totalPoints = filtered.reduce((s, h) => s + (h.total_points || 0), 0);
  const rebateEligible = filtered.filter(h => h.tier !== 'BRONZE').length;

  return (
    <div className="grievances-page">
      <div className="page-header">
        <div>
          <h1>Carbon Card Holders</h1>
          <p className="page-subheading">Live eco-points from vehicle scan logs. Auto-refreshes every 60s.</p>
        </div>
        <div className="inline-stats">
          <span className="stat-assigned">Citizens: <strong>{filtered.length}</strong></span>
          <span className="stat-resolved">Total Points: <strong>{totalPoints.toLocaleString()}</strong></span>
          <span className="stat-critical">Rebate Eligible: <strong>{rebateEligible}</strong></span>
          <button className="btn btn-sm btn-primary" onClick={fetchHolders} style={{ marginLeft: 8 }}>
            ↻ Refresh
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="filters">
          <input
            type="text"
            className="form-input search-input"
            placeholder="Search by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="form-input" value={tierFilter} onChange={e => setTierFilter(e.target.value)}>
            <option value="ALL">All Tiers</option>
            <option value="PLATINUM">Platinum</option>
            <option value="GOLD">Gold</option>
            <option value="SILVER">Silver</option>
            <option value="BRONZE">Bronze</option>
          </select>
        </div>
      </div>

      {error && (
        <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, color: '#dc2626', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>Loading carbon card holders...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>No holders found.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {filtered
            .sort((a, b) => (TIER_ORDER[b.tier] || 0) - (TIER_ORDER[a.tier] || 0) || b.total_points - a.total_points)
            .map(h => (
              <CarbonCard key={h.citizen_id} holder={h} />
            ))}
        </div>
      )}
    </div>
  );
}

function CarbonCard({ holder }) {
  const tierColor = TIER_COLORS[holder.tier] || '#10b981';
  const tierBg    = TIER_BG[holder.tier]    || '#f0fdf4';
  const memberId  = holder.citizen_id
    ? holder.citizen_id.slice(0, 4).toUpperCase() + '****' + holder.citizen_id.slice(-4).toUpperCase()
    : 'N/A';

  return (
    <div style={{
      background: tierBg,
      border: `2px solid ${tierColor}`,
      borderRadius: 12,
      overflow: 'hidden',
      boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
    }}>
      {/* Card header */}
      <div style={{ background: tierColor, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.85rem', letterSpacing: 1 }}>{holder.tier}</span>
        <span style={{ color: '#fff', fontSize: '0.75rem', opacity: 0.9 }}>{holder.email || ''}</span>
      </div>

      {/* Card body */}
      <div style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#1f2937' }}>{holder.name || 'Anonymous'}</div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', fontFamily: 'monospace', marginTop: 2 }}>{memberId}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#065f46' }}>
              ⭐ {(holder.total_points || 0).toLocaleString()}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>eco-points</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
          <Stat label="Scan Days" value={holder.total_scan_days || 0} />
          <Stat label="Streak" value={`${holder.streak || 0}d`} />
          <Stat label="Rebate" value={holder.tier === 'PLATINUM' ? '5%' : holder.tier === 'GOLD' ? '3%' : holder.tier === 'SILVER' ? '2%' : '0%'} />
        </div>


      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.6)', borderRadius: 6, padding: '6px 4px' }}>
      <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1f2937' }}>{value}</div>
      <div style={{ fontSize: '0.65rem', color: '#6b7280' }}>{label}</div>
    </div>
  );
}
