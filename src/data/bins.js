// Mock Data — Bins
// 30 IoT bins across 6 wards in Pune

export const BINS = [
  { id: 'BIN-001', ward: 'Ward 1 - Shivajinagar', lat: 18.5308, lng: 73.8474, fillLevel: 91, batteryLevel: 72, lastCollection: '2026-08-14 06:15', priorityScore: 9.2, status: 'critical', zone: 'Zone A' },
  { id: 'BIN-002', ward: 'Ward 1 - Shivajinagar', lat: 18.5321, lng: 73.8451, fillLevel: 44, batteryLevel: 89, lastCollection: '2026-08-14 08:30', priorityScore: 3.1, status: 'normal', zone: 'Zone A' },
  { id: 'BIN-003', ward: 'Ward 2 - Deccan', lat: 18.5176, lng: 73.8418, fillLevel: 78, batteryLevel: 61, lastCollection: '2026-08-13 17:45', priorityScore: 6.8, status: 'warning', zone: 'Zone A' },
  { id: 'BIN-004', ward: 'Ward 2 - Deccan', lat: 18.5201, lng: 73.8398, fillLevel: 23, batteryLevel: 94, lastCollection: '2026-08-14 09:10', priorityScore: 1.5, status: 'normal', zone: 'Zone A' },
  { id: 'BIN-005', ward: 'Ward 2 - Deccan', lat: 18.5189, lng: 73.8445, fillLevel: 88, batteryLevel: 45, lastCollection: '2026-08-13 14:20', priorityScore: 8.9, status: 'critical', zone: 'Zone A' },
  { id: 'BIN-006', ward: 'Ward 3 - Kothrud', lat: 18.5074, lng: 73.8077, fillLevel: 55, batteryLevel: 78, lastCollection: '2026-08-14 07:00', priorityScore: 4.5, status: 'warning', zone: 'Zone B' },
  { id: 'BIN-007', ward: 'Ward 3 - Kothrud', lat: 18.5093, lng: 73.8112, fillLevel: 32, batteryLevel: 91, lastCollection: '2026-08-14 09:45', priorityScore: 2.1, status: 'normal', zone: 'Zone B' },
  { id: 'BIN-008', ward: 'Ward 3 - Kothrud', lat: 18.5055, lng: 73.8055, fillLevel: 97, batteryLevel: 28, lastCollection: '2026-08-13 11:00', priorityScore: 9.8, status: 'critical', zone: 'Zone B' },
  { id: 'BIN-009', ward: 'Ward 4 - Aundh', lat: 18.5581, lng: 73.8080, fillLevel: 18, batteryLevel: 95, lastCollection: '2026-08-14 10:15', priorityScore: 1.2, status: 'normal', zone: 'Zone B' },
  { id: 'BIN-010', ward: 'Ward 4 - Aundh', lat: 18.5602, lng: 73.8102, fillLevel: 72, batteryLevel: 66, lastCollection: '2026-08-14 05:30', priorityScore: 6.1, status: 'warning', zone: 'Zone B' },
  { id: 'BIN-011', ward: 'Ward 4 - Aundh', lat: 18.5567, lng: 73.8045, fillLevel: 41, batteryLevel: 83, lastCollection: '2026-08-14 08:00', priorityScore: 2.8, status: 'normal', zone: 'Zone B' },
  { id: 'BIN-012', ward: 'Ward 5 - Hadapsar', lat: 18.5012, lng: 73.9263, fillLevel: 86, batteryLevel: 52, lastCollection: '2026-08-13 16:30', priorityScore: 8.2, status: 'critical', zone: 'Zone C' },
  { id: 'BIN-013', ward: 'Ward 5 - Hadapsar', lat: 18.5035, lng: 73.9291, fillLevel: 61, batteryLevel: 74, lastCollection: '2026-08-14 07:45', priorityScore: 5.0, status: 'warning', zone: 'Zone C' },
  { id: 'BIN-014', ward: 'Ward 5 - Hadapsar', lat: 18.4998, lng: 73.9241, fillLevel: 29, batteryLevel: 87, lastCollection: '2026-08-14 09:30', priorityScore: 1.9, status: 'normal', zone: 'Zone C' },
  { id: 'BIN-015', ward: 'Ward 5 - Hadapsar', lat: 18.5021, lng: 73.9318, fillLevel: 94, batteryLevel: 19, lastCollection: '2026-08-13 09:00', priorityScore: 9.7, status: 'critical', zone: 'Zone C' },
  { id: 'BIN-016', ward: 'Ward 6 - Kondhwa', lat: 18.4651, lng: 73.8823, fillLevel: 48, batteryLevel: 81, lastCollection: '2026-08-14 08:15', priorityScore: 3.4, status: 'normal', zone: 'Zone C' },
  { id: 'BIN-017', ward: 'Ward 6 - Kondhwa', lat: 18.4678, lng: 73.8849, fillLevel: 75, batteryLevel: 58, lastCollection: '2026-08-13 18:00', priorityScore: 6.5, status: 'warning', zone: 'Zone C' },
  { id: 'BIN-018', ward: 'Ward 6 - Kondhwa', lat: 18.4632, lng: 73.8800, fillLevel: 93, batteryLevel: 35, lastCollection: '2026-08-13 13:00', priorityScore: 9.4, status: 'critical', zone: 'Zone C' },
  { id: 'BIN-019', ward: 'Ward 1 - Shivajinagar', lat: 18.5290, lng: 73.8501, fillLevel: 37, batteryLevel: 92, lastCollection: '2026-08-14 09:00', priorityScore: 2.4, status: 'normal', zone: 'Zone A' },
  { id: 'BIN-020', ward: 'Ward 2 - Deccan', lat: 18.5155, lng: 73.8432, fillLevel: 68, batteryLevel: 70, lastCollection: '2026-08-14 06:45', priorityScore: 5.5, status: 'warning', zone: 'Zone A' },
  { id: 'BIN-021', ward: 'Ward 3 - Kothrud', lat: 18.5110, lng: 73.8091, fillLevel: 82, batteryLevel: 48, lastCollection: '2026-08-13 20:00', priorityScore: 7.3, status: 'warning', zone: 'Zone B' },
  { id: 'BIN-022', ward: 'Ward 4 - Aundh', lat: 18.5620, lng: 73.8118, fillLevel: 15, batteryLevel: 98, lastCollection: '2026-08-14 10:30', priorityScore: 0.9, status: 'normal', zone: 'Zone B' },
  { id: 'BIN-023', ward: 'Ward 5 - Hadapsar', lat: 18.5048, lng: 73.9278, fillLevel: 89, batteryLevel: 41, lastCollection: '2026-08-13 12:30', priorityScore: 8.7, status: 'critical', zone: 'Zone C' },
  { id: 'BIN-024', ward: 'Ward 6 - Kondhwa', lat: 18.4695, lng: 73.8862, fillLevel: 52, batteryLevel: 76, lastCollection: '2026-08-14 07:30', priorityScore: 4.1, status: 'normal', zone: 'Zone C' },
  { id: 'BIN-025', ward: 'Ward 1 - Shivajinagar', lat: 18.5340, lng: 73.8488, fillLevel: 76, batteryLevel: 62, lastCollection: '2026-08-13 22:00', priorityScore: 6.7, status: 'warning', zone: 'Zone A' },
  { id: 'BIN-026', ward: 'Ward 2 - Deccan', lat: 18.5168, lng: 73.8461, fillLevel: 35, batteryLevel: 88, lastCollection: '2026-08-14 08:45', priorityScore: 2.3, status: 'normal', zone: 'Zone A' },
  { id: 'BIN-027', ward: 'Ward 3 - Kothrud', lat: 18.5038, lng: 73.8032, fillLevel: 91, batteryLevel: 30, lastCollection: '2026-08-13 10:15', priorityScore: 9.3, status: 'critical', zone: 'Zone B' },
  { id: 'BIN-028', ward: 'Ward 4 - Aundh', lat: 18.5545, lng: 73.8068, fillLevel: 60, batteryLevel: 75, lastCollection: '2026-08-14 06:30', priorityScore: 4.9, status: 'warning', zone: 'Zone B' },
  { id: 'BIN-029', ward: 'Ward 5 - Hadapsar', lat: 18.5062, lng: 73.9305, fillLevel: 27, batteryLevel: 91, lastCollection: '2026-08-14 09:15', priorityScore: 1.7, status: 'normal', zone: 'Zone C' },
  { id: 'BIN-030', ward: 'Ward 6 - Kondhwa', lat: 18.4659, lng: 73.8837, fillLevel: 84, batteryLevel: 54, lastCollection: '2026-08-13 15:00', priorityScore: 7.8, status: 'warning', zone: 'Zone C' },
]

export const WARDS = ['All Wards', 'Ward 1 - Shivajinagar', 'Ward 2 - Deccan', 'Ward 3 - Kothrud', 'Ward 4 - Aundh', 'Ward 5 - Hadapsar', 'Ward 6 - Kondhwa']

export function getBinStats() {
  const critical = BINS.filter(b => b.fillLevel > 85).length
  const warning = BINS.filter(b => b.fillLevel > 50 && b.fillLevel <= 85).length
  const normal = BINS.filter(b => b.fillLevel <= 50).length
  return { critical, warning, normal, total: BINS.length }
}
