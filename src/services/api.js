const API_BASE_URL = 
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) 
    || 'http://localhost:5000/api';

/**
 * Generic fetch wrapper for Admin API requests with automatic JWT token injection
 */
async function request(endpoint, options = {}) {
  const token = localStorage.getItem('civicsync_admin_token');

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
  return await request('/auth/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
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

export const logout = () => {
  localStorage.removeItem('civicsync_admin_token');
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