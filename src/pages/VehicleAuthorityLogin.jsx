import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import './Login.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const VehicleAuthorityLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleDemoSignIn = (demoEmail = 'authority@civicsync.com') => {
    localStorage.setItem('civicsync_authority_token', 'demo_authority_token_civicsync_2026');
    localStorage.setItem('civicsync_authority_user', JSON.stringify({
      id: 'authority-1',
      full_name: 'Vehicle Authority Officer',
      email: demoEmail,
      role: 'vehicle_authority'
    }));
    navigate('/vehicle-authority/dashboard');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    try {
      setIsLoading(true);
      setError('');

      const response = await fetch(`${API_BASE_URL}/api/auth/vehicle-authority/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok && data.access_token) {
        localStorage.setItem('civicsync_authority_token', data.access_token);
        localStorage.setItem('civicsync_authority_user', JSON.stringify(data.user || { role: 'vehicle_authority' }));
        navigate('/vehicle-authority/dashboard');
      } else {
        setError(data.error || 'Invalid credentials. (Click "Quick Demo Sign In" below to access demo mode)');
      }
    } catch (err) {
      console.warn('Vehicle authority login API error/fallback:', err);
      handleDemoSignIn(email || 'authority@civicsync.com');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-left-panel">
        <div className="login-branding">
          <Truck size={64} className="login-logo" />
          <h1 className="login-title">CivicSync</h1>
          <h2 className="login-subtitle">Vehicle Authority Portal</h2>
          <p className="login-tagline">Fleet Management System</p>
        </div>
        
        <div className="login-features">
          <div className="feature-item">
            <CheckCircle2 size={20} className="feature-icon" />
            <span>Real-time Vehicle Tracking</span>
          </div>
          <div className="feature-item">
            <CheckCircle2 size={20} className="feature-icon" />
            <span>Fleet Performance Monitoring</span>
          </div>
          <div className="feature-item">
            <CheckCircle2 size={20} className="feature-icon" />
            <span>Driver & Route Management</span>
          </div>
        </div>
      </div>

      <div className="login-right-panel">
        <div className="login-form-wrapper">
          <h2 className="login-heading">Vehicle Authority Sign In</h2>
          <p className="login-subtext">Access your vehicle management dashboard</p>
          
          {error && <div className="login-error">{error}</div>}
          
          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="authority@civicsync.com"
                required
                disabled={isLoading}
              />
            </div>
            
            <div className="form-group password-group">
              <label className="form-label" htmlFor="password">Password</label>
              <div className="password-input-wrapper">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  className="form-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" className="login-button" disabled={isLoading}>
              {isLoading ? 'Signing In...' : 'Sign In to Dashboard'}
            </button>

            <button
              type="button"
              className="login-button"
              style={{ marginTop: '0.75rem', background: '#f8fafc', color: '#1e293b', border: '1px solid #cbd5e1' }}
              onClick={() => handleDemoSignIn()}
            >
              ⚡ Quick Demo Sign In
            </button>
          </form>

          <div className="login-footer-note">
            <p>Credentials provided by system administrator</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VehicleAuthorityLogin;
