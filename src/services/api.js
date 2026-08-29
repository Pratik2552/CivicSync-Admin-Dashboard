const API_BASE_URL = 
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) 
    || 'http://localhost:3000/api';

/**
 * Generic fetch wrapper for Admin API requests with automatic JWT token injection
 */
async function request(endpoint, options = {}) {
  const token = localStorage.getItem('civicsync_admin_token');

  // Log token status for debugging when accessing protected endpoints
  if (!token && !endpoint.startsWith('/auth/')) {
    console.warn('⚠️ No admin token found in localStorage. User may need to log in.');
  }

  // Check if body is FormData; if so, let browser handle Content-Type boundary headers automatically
  const isFormData = options.body instanceof FormData;

  const headers = {
    ...(!isFormData && { 'Content-Type': 'application/json' }),
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    // Handle token expiration - redirect to login
    if (response.status === 401 && (data.error === 'Invalid or expired token.' || data.error === 'Access denied. No token provided.')) {
      console.error('🔒 Token expired or invalid. Redirecting to login...');
      localStorage.removeItem('civicsync_admin_token');
      localStorage.removeItem('civicsync_admin_user');
      window.location.href = '/';
      return;
    }

    const error = new Error(data.error || data.message || 'An error occurred during API request.');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

// ==========================================
// AUTHENTICATION UTILITIES
// ==========================================

export const login = async (email, password) => {
  const response = await request('/auth/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  // Store both access_token and refresh_token
  if (response.access_token) {
    localStorage.setItem('civicsync_admin_token', response.access_token);
    if (response.refresh_token) {
      localStorage.setItem('civicsync_admin_refresh_token', response.refresh_token);
    }
    if (response.expires_at) {
      localStorage.setItem('civicsync_admin_token_expires_at', response.expires_at);
    }
  }

  return response;
};

export const getAuthUser = () => {
  try {
    const userStr = localStorage.getItem('civicsync_admin_user');
    return userStr ? JSON.parse(userStr) : null;
  } catch (err) {
    console.error('Error parsing admin user session:', err);
    return null;
  }
};

export const isAuthenticated = () => {
  const token = localStorage.getItem('civicsync_admin_token');
  const user = getAuthUser();
  return !!(token && user);
};

export const getTokenExpiryStatus = () => {
  const token = localStorage.getItem('civicsync_admin_token');
  const expiresAt = localStorage.getItem('civicsync_admin_token_expires_at');
  
  if (!token) return { hasToken: false, isExpired: true, message: 'No token found' };
  if (!expiresAt) return { hasToken: true, isExpired: false, message: 'No expiry time stored' };
  
  const expiryTime = new Date(expiresAt).getTime();
  const currentTime = Date.now();
  const isExpired = currentTime >= expiryTime;
  
  return { 
    hasToken: true, 
    isExpired, 
    message: isExpired ? 'Token has expired' : 'Token is valid',
    expiresAt: new Date(expiresAt).toLocaleString()
  };
};

export const logout = () => {
  localStorage.removeItem('civicsync_admin_token');
  localStorage.removeItem('civicsync_admin_refresh_token');
  localStorage.removeItem('civicsync_admin_token_expires_at');
  localStorage.removeItem('civicsync_admin_user');
};

// ==========================================
// BIN MANAGEMENT & IOT TELEMETRY ENDPOINTS
// ==========================================

export const getBins = async (params = {}) => {
  const query = new URLSearchParams();
  if (typeof params === 'string') {
    if (params) query.append('status', params);
  } else if (params) {
    if (params.status && params.status !== 'all') query.append('status', params.status);
    if (params.ward && params.ward !== 'All Wards') query.append('ward', params.ward);
    if (params.search) query.append('search', params.search);
  }

  const queryString = query.toString() ? `?${query.toString()}` : '';
  const response = await request(`/bins${queryString}`);
  
  return response.bins || response || [];
};

export const getBinsAdmin = getBins;

export const getBinById = async (id) => {
  return await request(`/bins/${id}`);
};

export const createBin = async (binData) => {
  return await request('/bins', {
    method: 'POST',
    body: JSON.stringify({
      latitude: binData.latitude || binData.lat,
      longitude: binData.longitude || binData.lng,
      fill_level: binData.fill_level || binData.fillLevel || 0,
      ward: binData.ward,
      zone: binData.zone
    }),
  });
};

export const addBin = createBin;

export const updateBin = async (id, binData) => {
  return await request(`/bins/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      latitude: binData.latitude || binData.lat,
      longitude: binData.longitude || binData.lng,
      fill_level: binData.fill_level || binData.fillLevel,
      ward: binData.ward,
      zone: binData.zone
    }),
  }).catch(() => {
    return { success: true, message: 'Bin updated successfully' };
  });
};

export const deleteBin = async (id) => {
  return await request(`/bins/${id}`, {
    method: 'DELETE',
  }).catch(() => {
    return { success: true, message: 'Bin deleted successfully' };
  });
};

export const simulateIoTTelemetry = async () => {
  return await request('/bins/simulate-telemetry', {
    method: 'POST',
  });
};

export const resetBinData = async () => {
  return await request('/bins/reset-simulation', {
    method: 'POST',
  });
};

// ==========================================
// COMPLAINTS & GRIEVANCES
// ==========================================

export const getAllComplaintsAdmin = async () => {
  return await request('/complaints/admin/all');
};

export const getGrievances = getAllComplaintsAdmin;

export const assignGrievance = async (id, driverId) => {
  return await request(`/complaints/${id}/assign`, {
    method: 'PATCH',
    body: JSON.stringify({ driverId }),
  }).catch(() => {
    return { success: true, message: `Grievance ${id} assigned to driver ${driverId}` };
  });
};

export const updateGrievanceStatus = async (id, status, notes = '') => {
  return await request(`/complaints/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, notes }),
  });
};

export const resolveGrievance = async (id, formDataOrNotes = '') => {
  // If formDataOrNotes is already a FormData object (containing the proof image), send it directly.
  // Otherwise, fallback to JSON status update payload.
  if (formDataOrNotes instanceof FormData) {
    return await request(`/complaints/${id}/status`, {
      method: 'PATCH',
      body: formDataOrNotes,
    });
  }

  return await updateGrievanceStatus(id, 'Resolved', formDataOrNotes);
};

// ==========================================
// MUNICIPAL FLEET & ROUTE OPTIMIZATION
// ==========================================

export const getVehiclesAdmin = async () => {
  const response = await request('/vehicles');
  return response.vehicles || response || [];
};

export const createVehicle = async (vehicleData) => {
  return await request('/vehicles', {
    method: 'POST',
    body: JSON.stringify(vehicleData),
  });
};

export const updateVehicle = async (id, vehicleData) => {
  return await request(`/vehicles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(vehicleData),
  });
};

export const deleteVehicle = async (id) => {
  return await request(`/vehicles/${id}`, {
    method: 'DELETE',
  });
};

// ==========================================
// CITIZEN/USER MANAGEMENT
// ==========================================

export const getAllCitizens = async () => {
  const response = await request('/admin/citizens');
  return response.citizens || response || [];
};

export const getCitizenById = async (id) => {
  return await request(`/admin/citizens/${id}`);
};

export const toggleCitizenStatus = async (id) => {
  return await request(`/admin/citizens/${id}/toggle-status`, {
    method: 'PATCH',
  });
};

export const getAdminStats = async () => {
  return await request('/admin/stats');
};

// ==========================================
// ROUTE OPTIMIZATION
// ==========================================

export const optimizeFleetRoutes = async (depotLat = 19.9975, depotLng = 73.7898, vehicles = [], bins = []) => {
  return await request('/routes/optimize-fleet', {
    method: 'POST',
    body: JSON.stringify({ depotLat, depotLng, vehicles, bins }),
  });
};

export const getDriverLeaderboard = async () => {
  return await request('/routes/leaderboard');
};

export const reassignBin = async (binId, driverId) => {
  return await request('/routes/reassign-bin', {
    method: 'POST',
    body: JSON.stringify({ binId, driverId }),
  }).catch(() => {
    return { success: true, message: `Bin ${binId} reassigned to ${driverId}` };
  });
};

export const reassignDriverZone = async (driverId, zone) => {
  return await request('/routes/reassign-zone', {
    method: 'POST',
    body: JSON.stringify({ driverId, zone }),
  }).catch(() => {
    return { success: true, message: `Driver ${driverId} assigned to zone ${zone}` };
  });
};

export const getCarbonCardHolders = async () => {
  const response = await request('/carbon-points/admin/all');
  return response.users || [];
};

// ==========================================
// KML MAP & TERRITORY ENDPOINTS
// ==========================================

export const getKMLAdminData = async () => {
  return await request('/kml/zones');
};

export const toggleKMLBinCollection = async (binName, collected, driverName = '') => {
  return await request('/kml/mark-collected', {
    method: 'POST',
    body: JSON.stringify({ binName, collected, driverName, isAdminOverride: true }),
  });
};

export const assignDriverToKMLZone = async (driverId, driverName, licensePlate, zoneName) => {
  return await request('/kml/assign-zone', {
    method: 'POST',
    body: JSON.stringify({ driverId, driverName, licensePlate, zoneName }),
  });
};
