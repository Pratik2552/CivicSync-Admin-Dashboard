// Mock Data — Optimized Routes

import { BINS } from './bins.js'
import { DRIVERS } from './drivers.js'

// Route colors for map display
export const ROUTE_COLORS = {
  'DRV-001': '#1B3A5C',
  'DRV-002': '#1A7A4C',
  'DRV-004': '#B45309',
  'DRV-005': '#6B21A8',
  'DRV-006': '#C53030',
  'DRV-007': '#0E7490',
}

// Territory geofence colors
export const TERRITORY_COLORS = {
  'Zone A': '#1B3A5C',
  'Zone B': '#1A7A4C',
  'Zone C': '#B45309',
}

// Pre-computed optimized routes (OSRM + OR-Tools output simulation)
export const OPTIMIZED_ROUTES = [
  {
    driverId: 'DRV-001',
    driverName: 'Rajesh Kumar',
    zone: 'Zone A',
    estimatedDistance: 12.4,
    estimatedDuration: 87,
    totalBins: 5,
    waypoints: [
      { lat: 18.5290, lng: 73.8501, type: 'depot', label: 'Depot Start' },
      { lat: 18.5308, lng: 73.8474, type: 'bin', binId: 'BIN-001', seq: 1 },
      { lat: 18.5321, lng: 73.8451, type: 'bin', binId: 'BIN-002', seq: 2 },
      { lat: 18.5340, lng: 73.8488, type: 'bin', binId: 'BIN-025', seq: 3 },
      { lat: 18.5176, lng: 73.8418, type: 'bin', binId: 'BIN-003', seq: 4 },
      { lat: 18.5201, lng: 73.8398, type: 'bin', binId: 'BIN-004', seq: 5 },
      { lat: 18.5290, lng: 73.8501, type: 'depot', label: 'Return to Depot' },
    ],
  },
  {
    driverId: 'DRV-002',
    driverName: 'Suresh Patil',
    zone: 'Zone A',
    estimatedDistance: 9.8,
    estimatedDuration: 72,
    totalBins: 4,
    waypoints: [
      { lat: 18.5290, lng: 73.8501, type: 'depot', label: 'Depot Start' },
      { lat: 18.5189, lng: 73.8445, type: 'bin', binId: 'BIN-005', seq: 1 },
      { lat: 18.5155, lng: 73.8432, type: 'bin', binId: 'BIN-020', seq: 2 },
      { lat: 18.5168, lng: 73.8461, type: 'bin', binId: 'BIN-026', seq: 3 },
      { lat: 18.5201, lng: 73.8398, type: 'bin', binId: 'BIN-019', seq: 4 },
      { lat: 18.5290, lng: 73.8501, type: 'depot', label: 'Return to Depot' },
    ],
  },
  {
    driverId: 'DRV-004',
    driverName: 'Vikas More',
    zone: 'Zone B',
    estimatedDistance: 15.2,
    estimatedDuration: 105,
    totalBins: 6,
    waypoints: [
      { lat: 18.5545, lng: 73.8068, type: 'depot', label: 'Zone B Depot' },
      { lat: 18.5581, lng: 73.8080, type: 'bin', binId: 'BIN-009', seq: 1 },
      { lat: 18.5602, lng: 73.8102, type: 'bin', binId: 'BIN-010', seq: 2 },
      { lat: 18.5567, lng: 73.8045, type: 'bin', binId: 'BIN-011', seq: 3 },
      { lat: 18.5620, lng: 73.8118, type: 'bin', binId: 'BIN-022', seq: 4 },
      { lat: 18.5110, lng: 73.8091, type: 'bin', binId: 'BIN-021', seq: 5 },
      { lat: 18.5545, lng: 73.8068, type: 'bin', binId: 'BIN-028', seq: 6 },
      { lat: 18.5545, lng: 73.8068, type: 'depot', label: 'Return to Depot' },
    ],
  },
  {
    driverId: 'DRV-005',
    driverName: 'Pradeep Jadhav',
    zone: 'Zone C',
    estimatedDistance: 11.7,
    estimatedDuration: 98,
    totalBins: 6,
    waypoints: [
      { lat: 18.5035, lng: 73.9291, type: 'depot', label: 'Zone C Depot' },
      { lat: 18.5015, lng: 73.9263, type: 'bin', binId: 'BIN-015', seq: 1 },
      { lat: 18.5012, lng: 73.9263, type: 'bin', binId: 'BIN-012', seq: 2 },
      { lat: 18.5035, lng: 73.9291, type: 'bin', binId: 'BIN-013', seq: 3 },
      { lat: 18.5048, lng: 73.9278, type: 'bin', binId: 'BIN-023', seq: 4 },
      { lat: 18.5062, lng: 73.9305, type: 'bin', binId: 'BIN-029', seq: 5 },
      { lat: 18.4998, lng: 73.9241, type: 'bin', binId: 'BIN-014', seq: 6 },
      { lat: 18.5035, lng: 73.9291, type: 'depot', label: 'Return to Depot' },
    ],
  },
  {
    driverId: 'DRV-006',
    driverName: 'Santosh Gaikwad',
    zone: 'Zone C',
    estimatedDistance: 8.6,
    estimatedDuration: 68,
    totalBins: 5,
    waypoints: [
      { lat: 18.4695, lng: 73.8862, type: 'depot', label: 'Zone C Depot 2' },
      { lat: 18.4678, lng: 73.8849, type: 'bin', binId: 'BIN-017', seq: 1 },
      { lat: 18.4651, lng: 73.8823, type: 'bin', binId: 'BIN-016', seq: 2 },
      { lat: 18.4659, lng: 73.8837, type: 'bin', binId: 'BIN-030', seq: 3 },
      { lat: 18.4632, lng: 73.8800, type: 'bin', binId: 'BIN-018', seq: 4 },
      { lat: 18.4695, lng: 73.8862, type: 'bin', binId: 'BIN-024', seq: 5 },
      { lat: 18.4695, lng: 73.8862, type: 'depot', label: 'Return to Depot' },
    ],
  },
  {
    driverId: 'DRV-007',
    driverName: 'Anil Deshpande',
    zone: 'Zone A',
    estimatedDistance: 5.1,
    estimatedDuration: 42,
    totalBins: 2,
    waypoints: [
      { lat: 18.5290, lng: 73.8501, type: 'depot', label: 'Depot Start' },
      { lat: 18.5321, lng: 73.8451, type: 'bin', binId: 'BIN-002', seq: 1 },
      { lat: 18.5201, lng: 73.8398, type: 'bin', binId: 'BIN-004', seq: 2 },
      { lat: 18.5290, lng: 73.8501, type: 'depot', label: 'Return to Depot' },
    ],
  },
]

// Territories for geofence overlay
export const TERRITORIES = [
  {
    zone: 'Zone A',
    label: 'Zone A — Shivajinagar / Deccan',
    drivers: ['DRV-001', 'DRV-002', 'DRV-007'],
    bounds: { minLat: 18.508, maxLat: 18.542, minLng: 73.832, maxLng: 73.862 },
    color: TERRITORY_COLORS['Zone A'],
  },
  {
    zone: 'Zone B',
    label: 'Zone B — Kothrud / Aundh',
    drivers: ['DRV-003', 'DRV-004', 'DRV-008'],
    bounds: { minLat: 18.495, maxLat: 18.575, minLng: 73.798, maxLng: 73.825 },
    color: TERRITORY_COLORS['Zone B'],
  },
  {
    zone: 'Zone C',
    label: 'Zone C — Hadapsar / Kondhwa',
    drivers: ['DRV-005', 'DRV-006'],
    bounds: { minLat: 18.458, maxLat: 18.512, minLng: 73.875, maxLng: 73.940 },
    color: TERRITORY_COLORS['Zone C'],
  },
]
