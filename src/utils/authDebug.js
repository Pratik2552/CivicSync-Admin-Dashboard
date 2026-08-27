/**
 * Authentication Debug Utilities
 * Use these functions to diagnose token issues
 */

export const debugAuthStatus = () => {
  console.log('🔍 === AUTHENTICATION DEBUG INFO ===');
  
  const token = localStorage.getItem('civicsync_admin_token');
  const refreshToken = localStorage.getItem('civicsync_admin_refresh_token');
  const expiresAt = localStorage.getItem('civicsync_admin_token_expires_at');
  const user = localStorage.getItem('civicsync_admin_user');

  console.log('1. Token present:', !!token);
  if (token) {
    console.log('   Token preview:', token.substring(0, 50) + '...');
    console.log('   Token length:', token.length);
  }

  console.log('2. Refresh Token present:', !!refreshToken);
  
  console.log('3. Token Expiry:', expiresAt || 'Not set');
  if (expiresAt) {
    const expiryTime = new Date(expiresAt);
    const now = new Date();
    const isExpired = now >= expiryTime;
    console.log('   Expires at:', expiryTime.toLocaleString());
    console.log('   Current time:', now.toLocaleString());
    console.log('   Is expired:', isExpired);
    if (!isExpired) {
      const minutesLeft = Math.floor((expiryTime - now) / (1000 * 60));
      console.log('   Time remaining:', minutesLeft, 'minutes');
    }
  }

  console.log('4. User data present:', !!user);
  if (user) {
    try {
      const userData = JSON.parse(user);
      console.log('   User:', userData);
    } catch (err) {
      console.error('   Error parsing user data:', err);
    }
  }

  console.log('=================================');

  return {
    hasToken: !!token,
    hasRefreshToken: !!refreshToken,
    hasUser: !!user,
    expiresAt,
    isExpired: expiresAt ? new Date() >= new Date(expiresAt) : null
  };
};

export const clearAuthAndReload = () => {
  console.log('🗑️ Clearing all authentication data...');
  localStorage.removeItem('civicsync_admin_token');
  localStorage.removeItem('civicsync_admin_refresh_token');
  localStorage.removeItem('civicsync_admin_token_expires_at');
  localStorage.removeItem('civicsync_admin_user');
  console.log('✅ Authentication data cleared. Reloading page...');
  window.location.href = '/';
};

// Make these available in browser console for debugging
if (typeof window !== 'undefined') {
  window.debugAuth = debugAuthStatus;
  window.clearAuth = clearAuthAndReload;
}
