import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { login } from '../services/api';
import './Login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    try {
      setIsLoading(true);
      setError('');

      const response = await login(email, password);

      if (response && response.token) {
        // Save Admin Token and Admin Profile details to localStorage
        localStorage.setItem('civicsync_admin_token', response.token);
        localStorage.setItem('civicsync_admin_user', JSON.stringify(response.user || { role: 'Admin' }));

        // Redirect to Admin Dashboard
        navigate('/admin/dashboard');
      } else {
        setError('Invalid admin credentials. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'An error occurred during administrator sign in.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-left-panel">
        <div className="login-branding">
          <Building2 size={64} className="login-logo" />
          <h1 className="login-title">CivicSync</h1>
          <h2 className="login-subtitle">Municipal Administration Portal</h2>
          <p className="login-tagline">Pune Municipal Corporation</p>
        </div>
        
        <div className="login-features">
          <div className="feature-item">
            <CheckCircle2 size={20} className="feature-icon" />
            <span>Intelligent Waste Collection Routing</span>
          </div>
          <div className="feature-item">
            <CheckCircle2 size={20} className="feature-icon" />
            <span>Real-time Fleet Tracking & Telemetry</span>
          </div>
          <div className="feature-item">
            <CheckCircle2 size={20} className="feature-icon" />
            <span>Citizen Grievance Management</span>
          </div>
        </div>
      </div>

      <div className="login-right-panel">
        <div className="login-form-wrapper">
          <h2 className="login-heading">Administrator Sign In</h2>
          
          {error && <div className="login-error">{error}</div>}
          
          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label className="form-label" htmlFor="email">Official Email / Username</label>
              <input
                id="email"
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@pmc.gov.in"
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
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                />
                <button 
                  type="button" 
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary login-btn"
              disabled={isLoading}
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </button>
            
            <div className="login-actions">
              <a href="#" className="forgot-password">Forgot Password?</a>
            </div>
          </form>
          
          <div className="login-security-notice">
            <p>Authorized personnel only. All access is logged and monitored.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;