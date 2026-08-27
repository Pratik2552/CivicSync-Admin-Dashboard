import React, { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, Clock, User } from 'lucide-react';
import { getAuthUser, getTokenExpiryStatus } from '../services/api';

/**
 * AuthStatus Component
 * Shows current authentication status in the UI
 * Useful for debugging token issues
 */
const AuthStatus = ({ showDetails = false }) => {
  const [authStatus, setAuthStatus] = useState({});
  const [user, setUser] = useState(null);

  useEffect(() => {
    const checkStatus = () => {
      const status = getTokenExpiryStatus();
      const userData = getAuthUser();
      setAuthStatus(status);
      setUser(userData);
    };

    checkStatus();
    
    // Check every 30 seconds
    const interval = setInterval(checkStatus, 30000);
    
    return () => clearInterval(interval);
  }, []);

  if (!showDetails && authStatus.hasToken && !authStatus.isExpired) {
    // Don't show anything if everything is fine and showDetails is false
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      background: authStatus.isExpired ? '#fef2f2' : authStatus.hasToken ? '#f0fdf4' : '#fef2f2',
      border: `2px solid ${authStatus.isExpired ? '#ef4444' : authStatus.hasToken ? '#22c55e' : '#ef4444'}`,
      borderRadius: '8px',
      padding: '12px 16px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      zIndex: 9999,
      maxWidth: '300px',
      fontSize: '14px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        {authStatus.isExpired ? (
          <ShieldAlert size={20} color="#ef4444" />
        ) : authStatus.hasToken ? (
          <ShieldCheck size={20} color="#22c55e" />
        ) : (
          <ShieldAlert size={20} color="#ef4444" />
        )}
        <strong style={{ color: authStatus.isExpired ? '#ef4444' : authStatus.hasToken ? '#22c55e' : '#ef4444' }}>
          {authStatus.isExpired ? 'Session Expired' : authStatus.hasToken ? 'Authenticated' : 'Not Authenticated'}
        </strong>
      </div>

      {showDetails && (
        <>
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', fontSize: '12px' }}>
              <User size={14} />
              <span>{user.email || user.full_name || 'Unknown User'}</span>
            </div>
          )}

          {authStatus.expiresAt && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
              <Clock size={14} />
              <span>Expires: {authStatus.expiresAt}</span>
            </div>
          )}

          {authStatus.isExpired && (
            <button
              onClick={() => {
                localStorage.clear();
                window.location.href = '/';
              }}
              style={{
                marginTop: '8px',
                width: '100%',
                padding: '6px 12px',
                background: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Log In Again
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default AuthStatus;
