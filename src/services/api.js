// API Service Layer — CivicSync Admin
// Mock API calls — swap these functions with real HTTP calls (axios/fetch) when backend is ready

import { BINS } from '../data/bins.js'
import { DRIVERS } from '../data/drivers.js'
import { GRIEVANCES } from '../data/grievances.js'
import { ALERTS } from '../data/alerts.js'
import { OPTIMIZED_ROUTES, TERRITORIES } from '../data/routes.js'

// Simulate network delay
const delay = (ms = 400) => new Promise(res => setTimeout(res, ms))

// ── Auth ──────────────────────────────────────────────────────────
export async function login(email, password) {
  await delay(600)
  if (!email || !password) throw new Error('Email and password required')
  // Accept any non-empty credentials for demo
  return {
    token: 'civicsync_admin_demo_token_' + Date.now(),
    user: {
      name: 'Admin User',
      email,
      role: 'Municipal Supervisor',
      department: 'Solid Waste Management',
    },
  }
}

export function logout() {
  localStorage.removeItem('civicsync_admin_token')
  localStorage.removeItem('civicsync_admin_user')
}

export function getAuthUser() {
  const raw = localStorage.getItem('civicsync_admin_user')
  return raw ? JSON.parse(raw) : null
}

// ── Bins ─────────────────────────────────────────────────────────
let binsData = [...BINS]

export async function getBins(filters = {}) {
  await delay(300)
  let data = [...binsData]
  if (filters.ward && filters.ward !== 'All Wards') {
    data = data.filter(b => b.ward === filters.ward)
  }
  if (filters.status && filters.status !== 'all') {
    data = data.filter(b => b.status === filters.status)
  }
  if (filters.search) {
    const s = filters.search.toLowerCase()
    data = data.filter(b => b.id.toLowerCase().includes(s) || b.ward.toLowerCase().includes(s))
  }
  return data
}

export async function addBin(binData) {
  await delay(500)
  const newBin = {
    id: `BIN-${String(binsData.length + 1).padStart(3, '0')}`,
    fillLevel: 0,
    batteryLevel: 100,
    lastCollection: new Date().toLocaleString(),
    priorityScore: 0,
    status: 'normal',
    ...binData,
  }
  binsData = [...binsData, newBin]
  return newBin
}

export async function updateBin(id, updates) {
  await delay(400)
  binsData = binsData.map(b => b.id === id ? { ...b, ...updates } : b)
  return binsData.find(b => b.id === id)
}

export async function deleteBin(id) {
  await delay(300)
  binsData = binsData.filter(b => b.id !== id)
  return { success: true }
}

// ── Drivers ──────────────────────────────────────────────────────
let driversData = [...DRIVERS]

export async function getDrivers(filters = {}) {
  await delay(300)
  let data = [...driversData]
  if (filters.status && filters.status !== 'all') {
    data = data.filter(d => d.status === filters.status)
  }
  if (filters.zone && filters.zone !== 'All Zones') {
    data = data.filter(d => d.zone === filters.zone)
  }
  if (filters.search) {
    const s = filters.search.toLowerCase()
    data = data.filter(d =>
      d.name.toLowerCase().includes(s) ||
      d.licensePlate.toLowerCase().includes(s) ||
      d.phone.includes(s)
    )
  }
  return data
}

export async function updateDriver(id, updates) {
  await delay(400)
  driversData = driversData.map(d => d.id === id ? { ...d, ...updates } : d)
  return driversData.find(d => d.id === id)
}

// ── Grievances ────────────────────────────────────────────────────
let grievancesData = [...GRIEVANCES]

export async function getGrievances(filters = {}) {
  await delay(300)
  let data = [...grievancesData]
  if (filters.status && filters.status !== 'all') {
    data = data.filter(g => g.status === filters.status)
  }
  if (filters.priority && filters.priority !== 'all') {
    data = data.filter(g => g.priority === filters.priority)
  }
  if (filters.search) {
    const s = filters.search.toLowerCase()
    data = data.filter(g =>
      g.id.toLowerCase().includes(s) ||
      g.category.toLowerCase().includes(s) ||
      g.location.toLowerCase().includes(s)
    )
  }
  return data
}

export async function assignGrievance(grievanceId, driverId) {
  await delay(500)
  grievancesData = grievancesData.map(g =>
    g.id === grievanceId
      ? { ...g, status: 'assigned', assignedDriver: driverId }
      : g
  )
  return grievancesData.find(g => g.id === grievanceId)
}

export async function resolveGrievance(grievanceId) {
  await delay(500)
  grievancesData = grievancesData.map(g =>
    g.id === grievanceId
      ? { ...g, status: 'resolved', resolvedAt: new Date().toLocaleString() }
      : g
  )
  return grievancesData.find(g => g.id === grievanceId)
}

// ── Alerts ───────────────────────────────────────────────────────
export async function getAlerts() {
  await delay(200)
  return [...ALERTS].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
}

// ── Routes / Optimization ────────────────────────────────────────
export async function getRoutes() {
  await delay(300)
  return OPTIMIZED_ROUTES
}

export async function getTerritories() {
  await delay(200)
  return TERRITORIES
}

export async function optimizeFleetRoutes() {
  // Simulates POST /api/routes/optimize-fleet
  await delay(2000) // Simulate OSRM + OR-Tools processing time
  return {
    success: true,
    message: 'Fleet routes optimized successfully.',
    routesGenerated: OPTIMIZED_ROUTES.length,
    totalDistanceSaved: 42.3,
    timestamp: new Date().toLocaleString(),
    routes: OPTIMIZED_ROUTES,
  }
}

export async function reassignBin(binId, newDriverId) {
  await delay(500)
  return { success: true, binId, newDriverId, timestamp: new Date().toLocaleString() }
}

// ── Dashboard KPIs ────────────────────────────────────────────────
export async function getDashboardKPIs() {
  await delay(300)
  return {
    criticalBins: BINS.filter(b => b.fillLevel > 85).length,
    activeFleet: DRIVERS.filter(d => d.status === 'active' || d.status === 'in_transit').length,
    avgResolutionTime: '2.4 hrs',
    totalDistanceSaved: '42.3 km',
    openGrievances: GRIEVANCES.filter(g => g.status === 'open').length,
    totalBins: BINS.length,
    totalDrivers: DRIVERS.length,
  }
}
