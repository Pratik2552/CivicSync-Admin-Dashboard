import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, MapPin, Save } from 'lucide-react';
import './Dashboard.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const VehicleAuthorityProfile = () => {
  const [profile, setProfile] = useState({
    full_name: '',
    email: '',
    phone: '',
    address: '',
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('civicsync_authority_token');
      const response = await fetch(`${API_BASE_URL}/api/auth/vehicle-authority/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(data.profile || {});
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const token = localStorage.getItem('civicsync_authority_token');
      const response = await fetch(`${API_BASE_URL}/api/auth/vehicle-authority/profile`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          full_name: profile.full_name,
          phone: profile.phone,
          address: profile.address,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(data.profile);
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
        setIsEditing(false);
        
        // Update localStorage user data
        const user = JSON.parse(localStorage.getItem('civicsync_authority_user') || '{}');
        user.full_name = data.profile.full_name;
        localStorage.setItem('civicsync_authority_user', JSON.stringify(user));
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Failed to update profile' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">My Profile</h1>
          <p className="dashboard-subtitle">Manage your account information</p>
        </div>
        {!isEditing ? (
          <button className="primary-btn" onClick={() => setIsEditing(true)}>
            Edit Profile
          </button>
        ) : (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              className="secondary-btn" 
              onClick={() => {
                setIsEditing(false);
                fetchProfile();
                setMessage({ type: '', text: '' });
              }}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button 
              className="primary-btn" 
              onClick={handleSave}
              disabled={isSaving}
            >
              <Save size={16} />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      {/* Message */}
      {message.text && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Profile Form */}
      <div className="dashboard-section">
        <div className="section-header">
          <h2 className="section-title">Account Details</h2>
        </div>

        <div className="profile-form">
          <div className="form-grid">
            {/* Full Name */}
            <div className="form-group">
              <label className="form-label">
                <User size={16} />
                Full Name
              </label>
              <input
                type="text"
                className="form-input"
                value={profile.full_name || ''}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                disabled={!isEditing}
                placeholder="Enter your full name"
              />
            </div>

            {/* Email (Read-only) */}
            <div className="form-group">
              <label className="form-label">
                <Mail size={16} />
                Email Address
              </label>
              <input
                type="email"
                className="form-input"
                value={profile.email || ''}
                disabled
                placeholder="email@example.com"
              />
              <small className="form-hint">Email cannot be changed</small>
            </div>

            {/* Phone */}
            <div className="form-group">
              <label className="form-label">
                <Phone size={16} />
                Phone Number
              </label>
              <input
                type="tel"
                className="form-input"
                value={profile.phone || ''}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                disabled={!isEditing}
                placeholder="Enter your phone number"
              />
            </div>

            {/* Address */}
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">
                <MapPin size={16} />
                Address
              </label>
              <textarea
                className="form-input"
                rows={3}
                value={profile.address || ''}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                disabled={!isEditing}
                placeholder="Enter your address"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Account Info */}
      <div className="dashboard-section">
        <div className="section-header">
          <h2 className="section-title">Account Information</h2>
        </div>

        <div className="info-grid">
          <div className="info-card">
            <div className="info-label">Account Type</div>
            <div className="info-value">Vehicle Authority</div>
          </div>
          <div className="info-card">
            <div className="info-label">Status</div>
            <div className="info-value">
              <span className="status-badge" style={{ backgroundColor: '#10b981' }}>
                Active
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VehicleAuthorityProfile;
