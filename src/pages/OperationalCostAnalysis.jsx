import React, { useState, useEffect, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LabelList
} from 'recharts';
import {
  Truck, Zap, Fuel, BarChart2, Download, RefreshCw, MapPin, Package, AlertTriangle, TrendingUp,
  Workflow, GitFork, Route, CheckCircle, Wrench, Calendar, DollarSign
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getKMLAdminData, getVehiclesAdmin } from '../services/api.js';
import './OperationalCostAnalysis.css';

// =============================================
// CONSTANTS & HELPERS
// =============================================

// Maharashtra reference operational fuel/energy assumptions
const FUEL_RATES = {
  diesel:  { pricePerLitre: 89.62,   mileageKmPerL: 4.5,   label: 'Diesel (Heavy Compactor)',   unit: 'L',   color: '#f59e0b' },
  petrol:  { pricePerLitre: 97.76,   mileageKmPerL: 6.0,   label: 'Petrol (Light Tipper)',      unit: 'L',   color: '#ef4444' },
  cng:     { pricePerLitre: 75.00,   mileageKmPerL: 7.5,   label: 'CNG (Medium Tipper)',        unit: 'kg',  color: '#3b82f6' },
  ev:      { pricePerLitre: 7.50,    mileageKmPerL: 1.8,   label: 'Electric EV (3.5T Commercial)',unit: 'kWh', color: '#22c55e' },
};

// Itemized Vehicle Maintenance & Overheads (Maharashtra Commercial Vehicle Standards)
const OPS_OVERHEADS = {
  // Reference daily wage assumptions for operational estimation
  driverWagePerDay:       850,   // ₹/day
  helperWagePerDay:       550,   // ₹/day (1 helper per truck)
  
  // Reference itemized vehicle maintenance assumptions
  maintTyresPerKm:        1.20,  // ₹/km (6 commercial tyres @ ₹12,000 replaced every 35,000 km)
  maintEnginePerKm:       0.85,  // ₹/km (Engine oil, fuel filter & air filter every 10,000 km)
  maintHydraulicsPerKm:   1.10,  // ₹/km (Hydraulic fluid, arm seals, cylinder servicing)
  maintBrakesPerKm:       0.60,  // ₹/km (Heavy-duty brake shoes, clutch plate & suspension greasing)
  maintPeriodicPerDay:    135,   // ₹/day (Fixed monthly workshop overhaul allocation ~₹3,500/mo)

  // Insurance & Disinfection Overheads
  insurancePerDay:        150,   // ₹/day (Commercial Third-Party + Comprehensive policy ~₹45,000/yr)
  washingPerDay:          100,   // ₹/day (High-pressure chemical disinfection washing)
};

// Haversine distance between two [lat,lng] pairs (km)
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Compute per-zone distance: bins in that zone → nearest-neighbour tour from depot → back
function computeZoneDistance(depot, bins) {
  if (!bins || bins.length === 0) return 0;
  let remaining = [...bins];
  let totalDist = 0;
  let current = { lat: depot.lat, lng: depot.lng };
  while (remaining.length > 0) {
    let nearest = null;
    let nearestDist = Infinity;
    remaining.forEach(b => {
      const d = haversineKm(current.lat, current.lng, b.lat, b.lng);
      if (d < nearestDist) { nearestDist = d; nearest = b; }
    });
    totalDist += nearestDist;
    current = nearest;
    remaining = remaining.filter(b => b !== nearest);
  }
  // Return to depot
  totalDist += haversineKm(current.lat, current.lng, depot.lat, depot.lng);
  return totalDist;
}

function computePathDistance(points) {
  if (!Array.isArray(points) || points.length < 2) return 0;
  return points.slice(1).reduce((total, point, index) => {
    const previous = points[index];
    return total + haversineKm(previous[0], previous[1], point[0], point[1]);
  }, 0);
}

function findBaselineRouteDistance(routes, zoneName, truckName, allBins) {
  const route = (routes || []).find(item => {
    const routeName = String(item.name || '').toUpperCase();
    const routeZone = String(item.zone || '').toUpperCase();
    return routeZone === zoneName || routeName.includes(zoneName) || routeName.includes(truckName);
  });
  if (route?.coordinates?.length > 1) {
    const distance = computePathDistance(route.coordinates);
    return distance > 0 ? distance : null;
  }

  // If KML contains one complete route marked ALL, assign each segment to the
  // zone of the nearest bin across ALL zones. This prevents the same complete
  // route from being counted once for Zone A and again for Zone B.
  const completeRoute = (routes || []).find(item => String(item.zone || '').toUpperCase() === 'ALL' && item.coordinates?.length > 1);
  if (!completeRoute || !(allBins || []).length) return null;

  const routeCoordinates = completeRoute.coordinates;
  const zoneDistance = routeCoordinates.slice(1).reduce((total, point, index) => {
    const previous = routeCoordinates[index];
    const midpoint = [(previous[0] + point[0]) / 2, (previous[1] + point[1]) / 2];
    const nearestBin = (allBins || []).reduce((nearest, bin) => {
      const distance = haversineKm(midpoint[0], midpoint[1], bin.lat, bin.lng);
      return distance < nearest.distance ? { distance, bin } : nearest;
    }, { distance: Infinity, bin: null });

    if (nearestBin.bin?.zone !== zoneName) return total;
    return total + haversineKm(previous[0], previous[1], point[0], point[1]);
  }, 0);

  return zoneDistance > 0 ? zoneDistance : null;
}

function normalizeFuelType(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw.includes('electric') || raw === 'ev') return 'ev';
  if (raw.includes('cng')) return 'cng';
  if (raw.includes('petrol') || raw.includes('gasoline')) return 'petrol';
  if (raw.includes('diesel')) return 'diesel';
  return null;
}

function getVehicleFuelType(vehicle) {
  return normalizeFuelType(vehicle?.fuel_type || vehicle?.fuelType || vehicle?.fuel || vehicle?.energy_type || vehicle?.energyType);
}

function getVehicleMileage(vehicle) {
  return Number(vehicle?.mileageKmPerL || vehicle?.mileage || vehicle?.fuel_efficiency || vehicle?.fuelEfficiency) || null;
}

function resolveVehicleForTruck(dbVehicles, truck) {
  if (!truck || !Array.isArray(dbVehicles)) return null;
  const candidates = [truck.id, truck.vehicle_id, truck.vehicleId, truck.name, truck.vehicle_number, truck.vehicleNumber]
    .filter(value => value !== null && value !== undefined)
    .map(value => String(value).trim().toLowerCase());

  return dbVehicles.find(vehicle => {
    const vehicleKeys = [vehicle.id, vehicle.vehicle_id, vehicle.vehicleId, vehicle.name, vehicle.vehicle_number, vehicle.vehicleNumber, vehicle.registration_number, vehicle.registrationNumber]
      .filter(value => value !== null && value !== undefined)
      .map(value => String(value).trim().toLowerCase());
    return candidates.some(candidate => vehicleKeys.includes(candidate));
  }) || null;
}

// Full cost calculation for one vehicle/zone
function calcCost(distKm, fuelType, bins, vehicle = null) {
  const fuel = FUEL_RATES[fuelType];
  const backendFuelType = getVehicleFuelType(vehicle);
  const backendMileage = getVehicleMileage(vehicle);
  const canUseBackendMileage = Boolean(backendMileage && backendFuelType === fuelType);
  const mileage = canUseBackendMileage ? backendMileage : fuel.mileageKmPerL;
  const mileageSource = canUseBackendMileage ? 'backend' : 'reference';
  const fuelConsumed = distKm / mileage;
  const fuelCost = fuelConsumed * fuel.pricePerLitre;
  
  const driverWage = OPS_OVERHEADS.driverWagePerDay;
  const helperWage = OPS_OVERHEADS.helperWagePerDay;
  
  // Itemized Maintenance Breakdown
  const tyreMaint = distKm * OPS_OVERHEADS.maintTyresPerKm;
  const engineMaint = distKm * OPS_OVERHEADS.maintEnginePerKm;
  const hydraulicMaint = distKm * OPS_OVERHEADS.maintHydraulicsPerKm;
  const brakeMaint = distKm * OPS_OVERHEADS.maintBrakesPerKm;
  const periodicMaintFixed = OPS_OVERHEADS.maintPeriodicPerDay;
  
  const totalMaint = tyreMaint + engineMaint + hydraulicMaint + brakeMaint + periodicMaintFixed;
  
  const insurance = OPS_OVERHEADS.insurancePerDay;
  const washing = OPS_OVERHEADS.washingPerDay;
  
  const dailyTotal = fuelCost + driverWage + helperWage + totalMaint + insurance + washing;
  
  // 4 Time Horizons (Required by User: 1 Day, 2 Weeks, 1 Month, 6 Months)
  const cost1Day = dailyTotal;
  const cost2Weeks = dailyTotal * 12;   // 12 working days in 2 weeks (6 days/week)
  const cost1Month = dailyTotal * 26;   // 26 working days in 1 month
  const cost6Months = dailyTotal * 156; // 156 working days in 6 months
  
  return {
    distKm: parseFloat(distKm.toFixed(2)),
    fuelConsumed: parseFloat(fuelConsumed.toFixed(2)),
    fuelCost: parseFloat(fuelCost.toFixed(2)),
    driverWage,
    helperWage,
    // Itemized Maintenance
    tyreMaint: parseFloat(tyreMaint.toFixed(2)),
    engineMaint: parseFloat(engineMaint.toFixed(2)),
    hydraulicMaint: parseFloat(hydraulicMaint.toFixed(2)),
    brakeMaint: parseFloat(brakeMaint.toFixed(2)),
    periodicMaintFixed,
    totalMaint: parseFloat(totalMaint.toFixed(2)),
    insurance,
    washing,
    // Time Horizon Cost Estimates
    totalCost: parseFloat(dailyTotal.toFixed(2)),
    cost1Day: parseFloat(cost1Day.toFixed(2)),
    cost2Weeks: parseFloat(cost2Weeks.toFixed(2)),
    cost1Month: parseFloat(cost1Month.toFixed(2)),
    cost6Months: parseFloat(cost6Months.toFixed(2)),
    binsCount: bins?.length || 0,
    costPerBin: parseFloat((dailyTotal / (bins?.length || 1)).toFixed(2)),
    costPerKm: distKm > 0 ? parseFloat((dailyTotal / distKm).toFixed(2)) : 0,
    mileageKmPerL: mileage,
    mileageSource,
    backendFuelType,
    fuelType,
    fuelLabel: fuel.label,
    fuelUnit: fuel.unit,
    fuelColor: fuel.color,
  };
}

function calculateRouteComparison(baselineDistance, optimizedDistance, fuelType, bins, vehicle) {
  if (!baselineDistance || optimizedDistance === null || optimizedDistance === undefined) return null;
  const baseline = calcCost(baselineDistance, fuelType, bins, vehicle);
  const optimized = calcCost(optimizedDistance, fuelType, bins, vehicle);
  const monthlyBaseline = baseline.cost1Month;
  const monthlyOptimized = optimized.cost1Month;
  const monthlySavings = monthlyBaseline - monthlyOptimized;

  return {
    baseline,
    optimized,
    monthlyBaseline,
    monthlyOptimized,
    monthlySavings,
    savingsPercentage: monthlyBaseline > 0 ? (monthlySavings / monthlyBaseline) * 100 : 0,
    distanceSaved: baselineDistance - optimizedDistance,
    distanceReductionPercentage: baselineDistance > 0 ? ((baselineDistance - optimizedDistance) / baselineDistance) * 100 : 0,
    fuelSaved: baseline.fuelConsumed - optimized.fuelConsumed,
    fuelCostSaved: baseline.fuelCost - optimized.fuelCost,
  };
}

function calculateFleetComparison(costA, costB) {
  const comparisons = [costA?.comparison, costB?.comparison].filter(Boolean);
  if (comparisons.length !== 2) return null;

  const baseline = comparisons.map(item => item.baseline);
  const optimized = comparisons.map(item => item.optimized);
  const sum = (items, key) => items.reduce((total, item) => total + (Number(item[key]) || 0), 0);
  const monthlyBaseline = sum(baseline, 'cost1Month');
  const monthlyOptimized = sum(optimized, 'cost1Month');
  const monthlySavings = monthlyBaseline - monthlyOptimized;

  const energyByType = {};
  comparisons.forEach((comparison, index) => {
    const optimizedCost = optimized[index];
    const fuelType = optimizedCost.fuelType;
    const unit = optimizedCost.fuelUnit;
    if (!energyByType[fuelType]) {
      energyByType[fuelType] = {
        fuelType,
        label: optimizedCost.fuelLabel,
        unit,
        baseline: 0,
        optimized: 0,
        saved: 0,
      };
    }
    energyByType[fuelType].baseline += Number(comparison.baseline.fuelConsumed) || 0;
    energyByType[fuelType].optimized += Number(comparison.optimized.fuelConsumed) || 0;
    energyByType[fuelType].saved += Number(comparison.fuelSaved) || 0;
  });

  return {
    baselineDistance: sum(baseline, 'distKm'),
    optimizedDistance: sum(optimized, 'distKm'),
    distanceSaved: sum(baseline, 'distKm') - sum(optimized, 'distKm'),
    distanceReductionPercentage: sum(baseline, 'distKm') > 0 ? ((sum(baseline, 'distKm') - sum(optimized, 'distKm')) / sum(baseline, 'distKm')) * 100 : 0,
    monthlyBaseline,
    monthlyOptimized,
    monthlySavings,
    savingsPercentage: monthlyBaseline > 0 ? (monthlySavings / monthlyBaseline) * 100 : 0,
    monthlyFuelCostSavings: (sum(baseline, 'fuelCost') - sum(optimized, 'fuelCost')) * 26,
    energyByType: Object.values(energyByType),
    components: ['fuelCost', 'totalMaint', 'driverWage', 'helperWage', 'insurance', 'washing'].map(key => ({
      key,
      baseline: sum(baseline, key) * 26,
      optimized: sum(optimized, key) * 26,
    })),
  };
}


const PIE_PALETTE = ['#2563eb', '#f59e0b', '#ef4444', '#22c55e', '#7c3aed', '#06b6d4'];
const INR = n => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const RS = n => `Rs. ${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

// =============================================
// FLOWCHART DIAGRAM COMPONENT (UI)
// =============================================
function OperationalWorkflowFlowchart({ costA, costB, zoneA, zoneB }) {
  const totalKm = ((costA?.distKm || 0) + (costB?.distKm || 0)).toFixed(1);
  const totalDaily = (costA?.totalCost || 0) + (costB?.totalCost || 0);

  return (
    <div className="oca-flowchart-card">
      <div className="oca-flowchart-header">
        <Workflow size={18} />
        <span>System Operational Cost Calculation Workflow</span>
      </div>

      <div className="oca-flowchart-pipeline">
        {/* Step 1 */}
        <div className="oca-fc-box oca-fc-step1">
          <div className="oca-fc-step-tag">STEP 1</div>
          <MapPin size={22} className="oca-fc-icon" />
          <div className="oca-fc-title">GPS Geometry</div>
          <div className="oca-fc-sub">mapping3.kml</div>
          <div className="oca-fc-metric">Central Depot + {((costA?.binsCount || 0) + (costB?.binsCount || 0))} Bins</div>
        </div>

        <div className="oca-fc-connector">➔</div>

        {/* Step 2 */}
        <div className="oca-fc-box oca-fc-step2">
          <div className="oca-fc-step-tag">STEP 2</div>
          <Route size={22} className="oca-fc-icon" />
          <div className="oca-fc-title">Route Distance</div>
          <div className="oca-fc-sub">Haversine Tour</div>
          <div className="oca-fc-metric">{totalKm} km Total</div>
        </div>

        <div className="oca-fc-connector">➔</div>

        {/* Step 3 */}
        <div className="oca-fc-box oca-fc-step3">
          <div className="oca-fc-step-tag">STEP 3</div>
          <Truck size={22} className="oca-fc-icon" />
          <div className="oca-fc-title">Fleet Allocation</div>
          <div className="oca-fc-sub">1:1 Zone Assignment</div>
          <div className="oca-fc-metric">TRUCK-001 &amp; 002</div>
        </div>

        <div className="oca-fc-connector">➔</div>

        {/* Step 4 */}
        <div className="oca-fc-box oca-fc-step4">
          <div className="oca-fc-step-tag">STEP 4</div>
          <TrendingUp size={22} className="oca-fc-icon" />
          <div className="oca-fc-title">Daily Cost Output</div>
          <div className="oca-fc-sub">Fuel + Overheads + Maint</div>
          <div className="oca-fc-metric oca-fc-highlight">{INR(totalDaily)} / day</div>
        </div>
      </div>

      {/* Parallel Zone Calculation Branches */}
      <div className="oca-flowchart-branches">
        {/* Zone A Branch */}
        <div className="oca-branch-card oca-branch-a">
          <div className="oca-branch-head">
            <span className="oca-branch-dot" style={{ background: '#2563eb' }} />
            <strong>ZONE A BRANCH (TRUCK-001)</strong>
          </div>
          <div className="oca-branch-body">
            <div className="oca-branch-item">
              <span>Tour Distance:</span><strong>{costA?.distKm} km</strong> ({costA?.binsCount} bins)
            </div>
            <div className="oca-branch-item">
              <span>Energy Type:</span><span className="oca-badge-chip" style={{ background: '#2563eb' }}>{FUEL_RATES[zoneA.fuelType].label}</span>
            </div>
            <div className="oca-branch-item">
              <span>Fuel Cost:</span><strong>{INR(costA?.fuelCost)}</strong> ({costA?.fuelConsumed} {costA?.fuelUnit})
            </div>
            <div className="oca-branch-item">
              <span>Wages (Driver + Helper):</span><strong>{INR((costA?.driverWage || 0) + (costA?.helperWage || 0))}</strong>
            </div>
            <div className="oca-branch-item">
              <span>Itemized Maintenance:</span><strong>{INR(costA?.totalMaint)}</strong> (Tyres, Engine, Hydraulics)
            </div>
            <div className="oca-branch-total" style={{ color: '#60a5fa' }}>
              <span>Zone A Daily Subtotal:</span><strong>{INR(costA?.totalCost)} / day</strong>
            </div>
          </div>
        </div>

        {/* Zone B Branch */}
        <div className="oca-branch-card oca-branch-b">
          <div className="oca-branch-head">
            <span className="oca-branch-dot" style={{ background: '#16a34a' }} />
            <strong>ZONE B BRANCH (TRUCK-002)</strong>
          </div>
          <div className="oca-branch-body">
            <div className="oca-branch-item">
              <span>Tour Distance:</span><strong>{costB?.distKm} km</strong> ({costB?.binsCount} bins)
            </div>
            <div className="oca-branch-item">
              <span>Energy Type:</span><span className="oca-badge-chip" style={{ background: '#16a34a' }}>{FUEL_RATES[zoneB.fuelType].label}</span>
            </div>
            <div className="oca-branch-item">
              <span>Fuel Cost:</span><strong>{INR(costB?.fuelCost)}</strong> ({costB?.fuelConsumed} {costB?.fuelUnit})
            </div>
            <div className="oca-branch-item">
              <span>Wages (Driver + Helper):</span><strong>{INR((costB?.driverWage || 0) + (costB?.helperWage || 0))}</strong>
            </div>
            <div className="oca-branch-item">
              <span>Itemized Maintenance:</span><strong>{INR(costB?.totalMaint)}</strong> (Tyres, Engine, Hydraulics)
            </div>
            <div className="oca-branch-total" style={{ color: '#4ade80' }}>
              <span>Zone B Daily Subtotal:</span><strong>{INR(costB?.totalCost)} / day</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================
// CUSTOM TOOLTIP FOR RECHARTS
// =============================================
function CustomBarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: '10px 14px', color: '#f1f5f9', fontSize: '0.8rem' }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || '#94a3b8' }}>
          {p.name}: <strong>{typeof p.value === 'number' && p.name?.includes('₹') ? INR(p.value) : p.value}</strong>
        </div>
      ))}
    </div>
  );
}

// =============================================
// MAIN COMPONENT
// =============================================
export default function OperationalCostAnalysis() {
  const [kmlData, setKmlData] = useState(null);
  const [dbVehicles, setDbVehicles] = useState([]);
  const [zoneA, setZoneA] = useState({ fuelType: 'diesel' });
  const [zoneB, setZoneB] = useState({ fuelType: 'diesel' });
  const [costA, setCostA] = useState(null);
  const [costB, setCostB] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [comparisonPeriod, setComparisonPeriod] = useState('monthly');
  const [activeTab, setActiveTab] = useState('timehorizons'); // default tab: timehorizons
  const reportRef = useRef(null);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!kmlData) return;
    recalculate(kmlData);
  }, [zoneA.fuelType, zoneB.fuelType, kmlData, dbVehicles]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [kml, vehicles] = await Promise.all([getKMLAdminData(), getVehiclesAdmin()]);
      const vehicleList = vehicles || [];
      setKmlData(kml);
      setDbVehicles(vehicleList);

      // Prefer the backend vehicle fuel/energy type when the truck can be matched.
      // The UI remains editable, but initial calculations now reflect backend data.
      const loadedTruckA = kml?.trucks?.find(t => t.name === 'TRUCK-001') || kml?.trucks?.[0];
      const loadedTruckB = kml?.trucks?.find(t => t.name === 'TRUCK-002') || kml?.trucks?.[1];
      const loadedVehicleA = resolveVehicleForTruck(vehicleList, loadedTruckA);
      const loadedVehicleB = resolveVehicleForTruck(vehicleList, loadedTruckB);
      const backendFuelA = getVehicleFuelType(loadedVehicleA);
      const backendFuelB = getVehicleFuelType(loadedVehicleB);
      if (backendFuelA && FUEL_RATES[backendFuelA]) setZoneA(prev => ({ ...prev, fuelType: backendFuelA }));
      if (backendFuelB && FUEL_RATES[backendFuelB]) setZoneB(prev => ({ ...prev, fuelType: backendFuelB }));

      setLoadError(false);
    } catch (err) {
      console.error('Failed to load operational data:', err);
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const recalculate = (kml) => {
    if (!kml?.depot || !kml?.bins) return;

    const depot = kml.depot;
    const binsA = kml.bins.filter(b => b.zone === 'ZONE A');
    const binsB = kml.bins.filter(b => b.zone === 'ZONE B');

    const distA = computeZoneDistance(depot, binsA);
    const distB = computeZoneDistance(depot, binsB);
    const truckA = kml.trucks?.find(t => t.name === 'TRUCK-001') || kml.trucks?.[0];
    const truckB = kml.trucks?.find(t => t.name === 'TRUCK-002') || kml.trucks?.[1];
    const vehicleA = resolveVehicleForTruck(dbVehicles, truckA);
    const vehicleB = resolveVehicleForTruck(dbVehicles, truckB);
    const baselineA = findBaselineRouteDistance(kml.routes, 'ZONE A', 'TRUCK-001', kml.bins);
    const baselineB = findBaselineRouteDistance(kml.routes, 'ZONE B', 'TRUCK-002', kml.bins);

    setCostA({ ...calcCost(distA, zoneA.fuelType, binsA, vehicleA), comparison: calculateRouteComparison(baselineA, distA, zoneA.fuelType, binsA, vehicleA), zone: 'ZONE A', binsA, vehicleMatched: Boolean(vehicleA) });
    setCostB({ ...calcCost(distB, zoneB.fuelType, binsB, vehicleB), comparison: calculateRouteComparison(baselineB, distB, zoneB.fuelType, binsB, vehicleB), zone: 'ZONE B', binsB, vehicleMatched: Boolean(vehicleB) });
  };

  const truckA = kmlData?.trucks?.find(t => t.name === 'TRUCK-001') || kmlData?.trucks?.[0];
  const truckB = kmlData?.trucks?.find(t => t.name === 'TRUCK-002') || kmlData?.trucks?.[1];
  const vehicleA = resolveVehicleForTruck(dbVehicles, truckA);
  const vehicleB = resolveVehicleForTruck(dbVehicles, truckB);
  const fleetComparison = costA && costB
    ? calculateFleetComparison(costA, costB)
    : null;
  const comparisonMultiplier = comparisonPeriod === 'yearly' ? 12 : 1;
  const operatingDaysMultiplier = comparisonPeriod === 'yearly' ? 312 : 26;
  const comparisonLabel = comparisonPeriod === 'yearly' ? 'Projected Annual' : 'Monthly';

  const barCompareCost = costA && costB ? [
    { name: 'Fuel Cost',    'ZONE A (₹)': costA.fuelCost,   'ZONE B (₹)': costB.fuelCost },
    { name: 'Driver Wage',  'ZONE A (₹)': costA.driverWage, 'ZONE B (₹)': costB.driverWage },
    { name: 'Helper Wage',  'ZONE A (₹)': costA.helperWage, 'ZONE B (₹)': costB.helperWage },
    { name: 'Maintenance',  'ZONE A (₹)': costA.totalMaint, 'ZONE B (₹)': costB.totalMaint },
    { name: 'Insurance',    'ZONE A (₹)': costA.insurance,  'ZONE B (₹)': costB.insurance },
    { name: 'Washing',      'ZONE A (₹)': costA.washing,    'ZONE B (₹)': costB.washing },
  ] : [];

  const barDistance = costA && costB ? [
    { name: 'ZONE A', 'Distance (km)': costA.distKm },
    { name: 'ZONE B', 'Distance (km)': costB.distKm },
  ] : [];

  const barBins = costA && costB ? [
    { name: 'ZONE A', 'Bins Covered': costA.binsCount },
    { name: 'ZONE B', 'Bins Covered': costB.binsCount },
  ] : [];

  const barEfficiency = costA && costB ? [
    { name: 'ZONE A', 'Cost/Km (₹)': costA.costPerKm, 'Cost/Bin (₹)': costA.costPerBin },
    { name: 'ZONE B', 'Cost/Km (₹)': costB.costPerKm, 'Cost/Bin (₹)': costB.costPerBin },
  ] : [];

  const barTimeHorizons = costA && costB ? [
    { name: '1 Day (Daily)',          'ZONE A (₹)': costA.cost1Day,   'ZONE B (₹)': costB.cost1Day,   'Combined (₹)': costA.cost1Day + costB.cost1Day },
    { name: '2 Weeks (12 Days)',     'ZONE A (₹)': costA.cost2Weeks, 'ZONE B (₹)': costB.cost2Weeks,                       'Combined (₹)': costA.cost2Weeks + costB.cost2Weeks },
    { name: '1 Month (26 Days)',      'ZONE A (₹)': costA.cost1Month, 'ZONE B (₹)': costB.cost1Month,                       'Combined (₹)': costA.cost1Month + costB.cost1Month },
    { name: '6 Months (156 Days)',    'ZONE A (₹)': costA.cost6Months,'ZONE B (₹)': costB.cost6Months,                      'Combined (₹)': costA.cost6Months + costB.cost6Months },
  ] : [];

  const barMaintenance = costA && costB ? [
    { name: 'Tyre Wear (₹1.20/km)',    'ZONE A (₹)': costA.tyreMaint,          'ZONE B (₹)': costB.tyreMaint },
    { name: 'Engine Oil (₹0.85/km)',   'ZONE A (₹)': costA.engineMaint,        'ZONE B (₹)': costB.engineMaint },
    { name: 'Hydraulics (₹1.10/km)',   'ZONE A (₹)': costA.hydraulicMaint,     'ZONE B (₹)': costB.hydraulicMaint },
    { name: 'Brakes/Clutch (₹0.60/km)','ZONE A (₹)': costA.brakeMaint,         'ZONE B (₹)': costB.brakeMaint },
    { name: 'Fixed Servicing',         'ZONE A (₹)': costA.periodicMaintFixed, 'ZONE B (₹)': costB.periodicMaintFixed },
  ] : [];

  const pieA = costA ? [
    { name: 'Fuel', value: costA.fuelCost },
    { name: 'Driver Wage', value: costA.driverWage },
    { name: 'Helper Wage', value: costA.helperWage },
    { name: 'Maintenance', value: costA.totalMaint },
    { name: 'Insurance', value: costA.insurance },
    { name: 'Washing', value: costA.washing },
  ] : [];

  const pieB = costB ? [
    { name: 'Fuel', value: costB.fuelCost },
    { name: 'Driver Wage', value: costB.driverWage },
    { name: 'Helper Wage', value: costB.helperWage },
    { name: 'Maintenance', value: costB.totalMaint },
    { name: 'Insurance', value: costB.insurance },
    { name: 'Washing', value: costB.washing },
  ] : [];

  // ---- PDF Download ----
  const downloadPDF = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();

    // Page 1 Header
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('CivicSync - Fleet Operational Cost & Efficiency Report', pageW / 2, 12, { align: 'center' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleString('en-IN')}  |  Source: mapping3.kml`, pageW / 2, 20, { align: 'center' });

    let y = 34;

    // --- SECTION 1: SYSTEM OPERATIONAL WORKFLOW FLOWCHART ---
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('System Operational Cost & Efficiency Workflow', 14, y);
    y += 6;

    // Flowchart Boxes (4 Steps in a horizontal pipeline)
    const boxW = 41;
    const boxH = 18;
    const gap = 5;
    const startX = 14;

    const steps = [
      { title: '1. GPS Coordinates', line1: 'mapping3.kml', line2: 'Depot + 14 Bins' },
      { title: '2. Route Tour', line1: 'Haversine Model', line2: `${((costA?.distKm || 0) + (costB?.distKm || 0)).toFixed(1)} km Total` },
      { title: '3. Fleet Allocation', line1: 'TRUCK-001 (Zone A)', line2: 'TRUCK-002 (Zone B)' },
      { title: '4. Daily Cost Output', line1: 'Combined Fleet', line2: RS((costA?.totalCost || 0) + (costB?.totalCost || 0)) },
    ];

    steps.forEach((step, idx) => {
      const bx = startX + idx * (boxW + gap);
      doc.setFillColor(idx === 3 ? 220 : 241, idx === 3 ? 252 : 245, idx === 3 ? 231 : 249);
      doc.setDrawColor(idx === 3 ? 22 : 148, idx === 3 ? 163 : 163, idx === 3 ? 74 : 184);
      doc.setLineWidth(0.4);
      doc.roundedRect(bx, y, boxW, boxH, 2, 2, 'FD');

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(idx === 3 ? 22 : 30, idx === 3 ? 101 : 41, idx === 3 ? 52 : 59);
      doc.text(step.title, bx + boxW / 2, y + 5, { align: 'center' });

      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(step.line1, bx + boxW / 2, y + 10, { align: 'center' });
      doc.text(step.line2, bx + boxW / 2, y + 14, { align: 'center' });

      if (idx < 3) {
        const arrowX = bx + boxW + 1;
        const arrowY = y + boxH / 2;
        doc.setDrawColor(100, 116, 139);
        doc.setLineWidth(0.6);
        doc.line(arrowX, arrowY, arrowX + 3, arrowY);
      }
    });

    y += boxH + 8;

    // --- SECTION 2: 4 TIME HORIZONS COST TABLE ---
    if (costA && costB) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('Multi-Horizon Operational Cost Projections (1 Day, 2 Weeks, 1 Month, 6 Months)', 14, y);
      y += 5;

      const dailyCombined = costA.totalCost + costB.totalCost;

      autoTable(doc, {
        startY: y,
        head: [['Time Horizon', 'Operating Days', 'ZONE A (TRUCK-001)', 'ZONE B (TRUCK-002)', 'Combined Fleet Expense']],
        body: [
          ['1 Day (Daily)', '1 Day', RS(costA.cost1Day), RS(costB.cost1Day), RS(dailyCombined)],
          ['2 Weeks', '12 Days (6d/wk)', RS(costA.cost2Weeks), RS(costB.cost2Weeks), RS(dailyCombined * 12)],
          ['1 Month', '26 Days', RS(costA.cost1Month), RS(costB.cost1Month), RS(dailyCombined * 26)],
          ['6 Months', '156 Days', RS(costA.cost6Months), RS(costB.cost6Months), RS(dailyCombined * 156)],
        ],
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
        columnStyles: { 0: { fontStyle: 'bold' }, 4: { fontStyle: 'bold', fillColor: [240, 253, 244], textColor: [22, 163, 74] } },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });

      y = doc.lastAutoTable.finalY + 8;

      // --- SECTION 3: ITEMIZED VEHICLE MAINTENANCE BREAKDOWN TABLE ---
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('Reference Commercial Vehicle Maintenance & Wear Breakdown', 14, y);
      y += 5;

      autoTable(doc, {
        startY: y,
        head: [['Maintenance Component', 'Standard Commercial Rate', 'ZONE A Cost/Day', 'ZONE B Cost/Day', 'Combined Daily Maint.']],
        body: [
          ['Tyre Wear & Alignment', 'Rs. 1.20 / km (Set of 6 commercial tyres)', RS(costA.tyreMaint), RS(costB.tyreMaint), RS(costA.tyreMaint + costB.tyreMaint)],
          ['Engine Servicing & Oil/Filters', 'Rs. 0.85 / km (Serviced every 10,000 km)', RS(costA.engineMaint), RS(costB.engineMaint), RS(costA.engineMaint + costB.engineMaint)],
          ['Hydraulic Compactor Arm & Seals', 'Rs. 1.10 / km (Fluid & RAM seals every 15k km)', RS(costA.hydraulicMaint), RS(costB.hydraulicMaint), RS(costA.hydraulicMaint + costB.hydraulicMaint)],
          ['Brakes, Clutch & Leaf Springs', 'Rs. 0.60 / km (Heavy shoes & lubrication)', RS(costA.brakeMaint), RS(costB.brakeMaint), RS(costA.brakeMaint + costB.brakeMaint)],
          ['Periodic Overhaul Allocation', 'Rs. 135.00 / day (Fixed monthly overhaul)', RS(costA.periodicMaintFixed), RS(costB.periodicMaintFixed), RS(costA.periodicMaintFixed + costB.periodicMaintFixed)],
          ['TOTAL MAINTENANCE EXPENSE', 'Rs. 3.75 / km + Rs. 135/day', RS(costA.totalMaint), RS(costB.totalMaint), RS(costA.totalMaint + costB.totalMaint)],
        ],
        styles: { fontSize: 8.5, cellPadding: 2.5 },
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
        columnStyles: { 0: { fontStyle: 'bold' }, 4: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        didParseCell: (data) => {
          if (data.row.raw?.[0] === 'TOTAL MAINTENANCE EXPENSE') {
            data.cell.styles.fillColor = [245, 158, 11];
            data.cell.styles.textColor = 255;
            data.cell.styles.fontStyle = 'bold';
          }
        }
      });

      y = doc.lastAutoTable.finalY + 8;

      // --- SECTION 4: VISUAL COMPARISON BARS ---
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('Visual Fleet Cost Comparison Diagram', 14, y);
      y += 6;

      const maxVal = Math.max(costA.totalCost, costB.totalCost);
      const maxBarW = 120;

      // Zone A Bar
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(37, 99, 235);
      doc.text('ZONE A (TRUCK-001):', 14, y + 4);
      const barWA = (costA.totalCost / maxVal) * maxBarW;
      doc.setFillColor(37, 99, 235);
      doc.roundedRect(55, y, barWA, 5, 1, 1, 'F');
      doc.setFontSize(7.5);
      doc.text(`${RS(costA.totalCost)} (${costA.distKm} km)`, 58 + barWA, y + 4);

      y += 8;

      // Zone B Bar
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(22, 163, 74);
      doc.text('ZONE B (TRUCK-002):', 14, y + 4);
      const barWB = (costB.totalCost / maxVal) * maxBarW;
      doc.setFillColor(22, 163, 74);
      doc.roundedRect(55, y, barWB, 5, 1, 1, 'F');
      doc.setFontSize(7.5);
      doc.text(`${RS(costB.totalCost)} (${costB.distKm} km)`, 58 + barWB, y + 4);

      // --- PAGE 2 FOR REAL-WORLD FUEL BENCHMARKS & AUDIT NOTES ---
      doc.addPage();

      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageW, 20, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('CivicSync - Reference Municipal Fuel Benchmarks', pageW / 2, 13, { align: 'center' });

      let y2 = 28;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('Maharashtra Reference Fuel & Energy Assumptions', 14, y2);
      y2 += 5;

      autoTable(doc, {
        startY: y2,
        head: [['Fuel / Energy Type', 'Market Price', 'Urban Mileage (Compactor PTO)', 'Est. Fuel Cost / Km', 'Driver & Helper Wages']],
        body: [
          ['Diesel (Heavy 10T Compactor)', 'Rs. 89.62 / litre', '4.5 km / litre', 'Rs. 19.92 / km', 'Rs. 850 (Driver) + Rs. 550 (Helper)'],
          ['Petrol (Light Tipper)', 'Rs. 97.76 / litre', '6.0 km / litre', 'Rs. 16.29 / km', 'Rs. 850 (Driver) + Rs. 550 (Helper)'],
          ['CNG (Medium Tipper)', 'Rs. 75.00 / kg', '7.5 km / kg', 'Rs. 10.00 / km', 'Rs. 850 (Driver) + Rs. 550 (Helper)'],
          ['Electric EV (3.5T Commercial)', 'Rs. 7.50 / kWh', '1.8 km / kWh', 'Rs. 4.17 / km', 'Rs. 850 (Driver) + Rs. 550 (Helper)'],
        ],
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [37, 99, 235], textColor: 255 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });

      y2 = doc.lastAutoTable.finalY + 8;

      doc.setFillColor(241, 245, 249);
      doc.roundedRect(14, y2, pageW - 28, 26, 2, 2, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('Operational Model & Parameter Notes:', 18, y2 + 5);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('1. Distances calculated via Haversine spherical geometry from mapping3.kml coordinates.', 18, y2 + 10);
      doc.text('2. Driver wage Rs. 850/day (Skilled) + Helper wage Rs. 550/day (Semi-Skilled) used as a reference operating assumption.', 18, y2 + 14);
      doc.text('3. Heavy compactor diesel mileage (4.5 km/L) accounts for urban stop-and-go driving and PTO hydraulic compactor operation.', 18, y2 + 18);
      doc.text('4. Maintenance rate (Rs. 3.75/km + Rs. 135/day) includes tyres, engine oil, hydraulic seals, and brakes.', 18, y2 + 22);
    }

    doc.save(`CivicSync_Operational_Cost_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  if (isLoading) {
    return (
      <div className="oca-loading">
        <div className="oca-spinner" />
        <p>Loading operational data from mapping3.kml…</p>
      </div>
    );
  }

  if (loadError && !kmlData) {
    return (
      <div className="oca-loading">
        <p>Unable to load operational cost data.</p>
        <button className="oca-btn oca-btn-primary" onClick={loadData}>Try Again</button>
      </div>
    );
  }

  const totalDaily = (costA?.totalCost || 0) + (costB?.totalCost || 0);

  return (
    <div className="oca-page">
      {/* Page Header */}
      <div className="oca-header">
        <div className="oca-header-left">
          <div className="oca-header-icon"><BarChart2 size={24} /></div>
          <div>
            <h1 className="oca-title">Vehicle Operational Cost Analysis</h1>
            <p className="oca-subtitle">
              Route-based cost estimation from <strong>mapping3.kml</strong> — Estimated Operational Parameters
            </p>
          </div>
        </div>
        <div className="oca-header-actions">
          <button className="oca-btn oca-btn-ghost" onClick={loadData} id="oca-refresh-btn">
            <RefreshCw size={15} /> Refresh
          </button>
          <button className="oca-btn oca-btn-primary" onClick={downloadPDF} id="oca-download-pdf-btn">
            <Download size={15} /> Download PDF
          </button>
        </div>
      </div>

      {/* Fuel Type Selectors */}
      <div className="oca-fuel-selectors">
        {[
          { label: 'ZONE A · TRUCK-001', state: zoneA, setter: setZoneA, color: '#2563eb' },
          { label: 'ZONE B · TRUCK-002', state: zoneB, setter: setZoneB, color: '#16a34a' },
        ].map(({ label, state, setter, color }) => (
          <div key={label} className="oca-fuel-card" style={{ '--zone-color': color }}>
            <div className="oca-fuel-label">
              <Fuel size={15} style={{ color }} />
              <span style={{ color }}>{label}</span>
            </div>
            <div className="oca-fuel-select-wrap">
              {Object.entries(FUEL_RATES).map(([key, val]) => (
                <button
                  key={key}
                  className={`oca-fuel-chip ${state.fuelType === key ? 'selected' : ''}`}
                  style={{ '--chip-color': val.color }}
                  onClick={() => setter(prev => ({ ...prev, fuelType: key }))}
                >
                  {val.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <section className="oca-comparison" aria-labelledby="oca-comparison-title">
        <div className="oca-comparison-heading">
          <div>
            <h2 id="oca-comparison-title">Route Optimization Cost Comparison</h2>
            <p>Baseline estimated from the static route in mapping3.kml; optimized distance uses the current zone tour.</p>
          </div>
          <div className="oca-period-toggle" role="group" aria-label="Comparison period">
            {['monthly', 'yearly'].map(period => (
              <button key={period} className={comparisonPeriod === period ? 'active' : ''} onClick={() => setComparisonPeriod(period)}>
                {period === 'monthly' ? 'Monthly' : 'Yearly'}
              </button>
            ))}
          </div>
        </div>
        {fleetComparison ? (
          <>
            <div className="oca-comparison-summary">
              {[
                ['Estimated Cost Without Optimization', fleetComparison.monthlyBaseline * comparisonMultiplier, '#f59e0b'],
                ['Optimized Operating Cost', fleetComparison.monthlyOptimized * comparisonMultiplier, '#22c55e'],
                [fleetComparison.monthlySavings >= 0 ? 'Estimated Savings' : 'Additional Cost', Math.abs(fleetComparison.monthlySavings) * comparisonMultiplier, fleetComparison.monthlySavings >= 0 ? '#4ade80' : '#f87171'],
                [fleetComparison.monthlySavings >= 0 ? 'Cost Reduction' : 'Cost Increase', Math.abs(fleetComparison.savingsPercentage), fleetComparison.monthlySavings >= 0 ? '#60a5fa' : '#f87171', true],
              ].map(([label, value, color, isPercentage]) => (
                <div className="oca-comparison-kpi" key={label}>
                  <span>{label}</span>
                  <strong style={{ color }}>{isPercentage ? `${Number(value || 0).toFixed(1)}%` : INR(value)}</strong>
                </div>
              ))}
            </div>
            <div className="oca-comparison-grid">
              <div>
                <h3>{comparisonLabel} Cost Components</h3>
                <table className="oca-table oca-comparison-table">
                  <thead><tr><th>Cost Component</th><th>Without Optimization</th><th>With Optimization</th><th>Difference</th></tr></thead>
                  <tbody>
                    {fleetComparison.components.map(component => {
                      const label = { fuelCost: 'Fuel', totalMaint: 'Maintenance', driverWage: 'Driver Wage', helperWage: 'Helper Wage', insurance: 'Insurance', washing: 'Washing' }[component.key];
                      const baseline = component.baseline * comparisonMultiplier;
                      const optimized = component.optimized * comparisonMultiplier;
                      const isSaving = baseline >= optimized;
                      return <tr key={component.key}><td>{label}</td><td>{INR(baseline)}</td><td>{INR(optimized)}</td><td className={isSaving ? 'oca-td-green' : 'oca-td-red'}>{isSaving ? '-' : '+'}{INR(Math.abs(baseline - optimized))}</td></tr>;
                    })}
                    <tr className="oca-comparison-total"><td>Total</td><td>{INR(fleetComparison.monthlyBaseline * comparisonMultiplier)}</td><td>{INR(fleetComparison.monthlyOptimized * comparisonMultiplier)}</td><td className={fleetComparison.monthlySavings >= 0 ? 'oca-td-green' : 'oca-td-red'}>{fleetComparison.monthlySavings >= 0 ? '-' : '+'}{INR(Math.abs(fleetComparison.monthlySavings) * comparisonMultiplier)}</td></tr>
                  </tbody>
                </table>
              </div>
              <div className="oca-distance-summary">
                <h3>Distance and Fuel Saving</h3>
                <div><span>Distance Without Optimization</span><strong>{(fleetComparison.baselineDistance * operatingDaysMultiplier).toFixed(2)} km</strong></div>
                <div><span>Optimized Distance</span><strong>{(fleetComparison.optimizedDistance * operatingDaysMultiplier).toFixed(2)} km</strong></div>
                <div><span>{fleetComparison.distanceSaved >= 0 ? 'Distance Saved' : 'Additional Distance'}</span><strong>{Math.abs(fleetComparison.distanceSaved * operatingDaysMultiplier).toFixed(2)} km</strong></div>
                <div><span>{fleetComparison.distanceReductionPercentage >= 0 ? 'Distance Reduction' : 'Distance Increase'}</span><strong>{Math.abs(fleetComparison.distanceReductionPercentage).toFixed(1)}%</strong></div>
                {fleetComparison.energyByType.map(energy => (
                  <React.Fragment key={energy.fuelType}>
                    <div><span>{energy.label} Without Optimization</span><strong>{(energy.baseline * operatingDaysMultiplier).toFixed(2)} {energy.unit}</strong></div>
                    <div><span>{energy.label} With Optimization</span><strong>{(energy.optimized * operatingDaysMultiplier).toFixed(2)} {energy.unit}</strong></div>
                    <div><span>{energy.label} Saved</span><strong>{Math.max(0, energy.saved * operatingDaysMultiplier).toFixed(2)} {energy.unit}</strong></div>
                  </React.Fragment>
                ))}
                <div><span>Fuel / Energy Cost Saved</span><strong>{INR(Math.max(0, fleetComparison.monthlyFuelCostSavings * comparisonMultiplier))}</strong></div>
              </div>
            </div>
          </>
        ) : (
          <p className="oca-comparison-empty">Baseline route data unavailable. Run route optimization or add a static route to mapping3.kml to compare costs.</p>
        )}
      </section>

      {/* 4 Time-Horizon Summary KPI Cards (1 Day, 2 Weeks, 1 Month, 6 Months) */}
      {costA && costB && (
        <div className="oca-kpis">
          {[
            { label: '1 Day (Daily Fleet Cost)', value: INR(totalDaily), icon: Calendar, color: '#2563eb', sub: `A: ${INR(costA.cost1Day)} · B: ${INR(costB.cost1Day)}` },
            { label: '2 Weeks (12 Operating Days)', value: INR(totalDaily * 12), icon: DollarSign, color: '#3b82f6', sub: `A: ${INR(costA.cost2Weeks)} · B: ${INR(costB.cost2Weeks)}` },
            { label: '1 Month (26 Operating Days)', value: INR(totalDaily * 26), icon: TrendingUp, color: '#7c3aed', sub: `A: ${INR(costA.cost1Month)} · B: ${INR(costB.cost1Month)}` },
            { label: '6 Months (156 Operating Days)', value: INR(totalDaily * 156), icon: AlertTriangle, color: '#ef4444', sub: `A: ${INR(costA.cost6Months)} · B: ${INR(costB.cost6Months)}` },
          ].map(({ label, value, icon: Icon, color, sub }) => (
            <div key={label} className="oca-kpi-card" style={{ '--kpi-color': color }}>
              <div className="oca-kpi-icon" style={{ background: `${color}22`, color }}>
                <Icon size={20} />
              </div>
              <div className="oca-kpi-body">
                <div className="oca-kpi-value">{value}</div>
                <div className="oca-kpi-label">{label}</div>
                <div className="oca-kpi-sub">{sub}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Zone Cards Side-by-Side with Maintenance Breakdown */}
      {costA && costB && (
        <div className="oca-zone-cards">
          {[
            { zone: 'ZONE A', cost: costA, truck: truckA, fuelType: zoneA.fuelType, color: '#2563eb' },
            { zone: 'ZONE B', cost: costB, truck: truckB, fuelType: zoneB.fuelType, color: '#16a34a' },
          ].map(({ zone, cost, truck, fuelType, color }) => (
            <div key={zone} className="oca-zone-card" style={{ '--zone-color': color }}>
              <div className="oca-zone-card-header" style={{ background: color }}>
                <Truck size={18} />
                <span>{zone}</span>
                <span className="oca-zone-truck">{truck?.name || 'TRUCK'}</span>
                <span className={`oca-fuel-badge`} style={{ background: FUEL_RATES[fuelType].color }}>
                  {FUEL_RATES[fuelType].label}
                </span>
              </div>
              <div className="oca-zone-card-body">
                <div className="oca-zone-rows">
                  <div className="oca-zone-row">
                    <span>Route Distance</span><strong>{cost.distKm} km</strong>
                  </div>
                  <div className="oca-zone-row">
                    <span>Bins Covered</span><strong>{cost.binsCount} stops</strong>
                  </div>
                  <div className="oca-zone-row">
                    <span>{FUEL_RATES[fuelType].label} Consumed</span><strong>{cost.fuelConsumed} {cost.fuelUnit}</strong>
                  </div>
                  <div className="oca-zone-row">
                    <span>Efficiency Source</span><strong>{cost.mileageSource === 'backend' ? `Backend vehicle · ${cost.mileageKmPerL} km/${cost.fuelUnit}` : `Reference estimate · ${cost.mileageKmPerL} km/${cost.fuelUnit}`}</strong>
                  </div>
                  <div className="oca-zone-row oca-row-fuel">
                    <span>Fuel Cost</span><strong>{INR(cost.fuelCost)}</strong>
                  </div>
                  <div className="oca-zone-row">
                    <span>Driver Wage (Reference)</span><strong>{INR(cost.driverWage)}</strong>
                  </div>
                  <div className="oca-zone-row">
                    <span>Helper Wage (Reference)</span><strong>{INR(cost.helperWage)}</strong>
                  </div>
                  <div className="oca-zone-row oca-row-maint">
                    <span>Vehicle Maintenance Breakdown</span><strong>{INR(cost.totalMaint)}</strong>
                  </div>
                  <div className="oca-maint-sublist">
                    <div>• Tyres Wear (₹1.20/km): {INR(cost.tyreMaint)}</div>
                    <div>• Engine Oil/Filters (₹0.85/km): {INR(cost.engineMaint)}</div>
                    <div>• Hydraulics &amp; Compactor (₹1.10/km): {INR(cost.hydraulicMaint)}</div>
                    <div>• Brakes &amp; Clutch (₹0.60/km): {INR(cost.brakeMaint)}</div>
                    <div>• Periodic Servicing: {INR(cost.periodicMaintFixed)}</div>
                  </div>
                  <div className="oca-zone-row">
                    <span>Commercial Insurance</span><strong>{INR(cost.insurance)}</strong>
                  </div>
                  <div className="oca-zone-row">
                    <span>Disinfection Washing</span><strong>{INR(cost.washing)}</strong>
                  </div>
                </div>
                <div className="oca-zone-total" style={{ borderTop: `2px solid ${color}`, color }}>
                  <span>Total Daily Cost</span>
                  <strong>{INR(cost.totalCost)} / day</strong>
                </div>
                <div className="oca-zone-efficiency">
                  <span>₹{cost.costPerKm}/km</span>
                  <span>·</span>
                  <span>₹{cost.costPerBin}/bin</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Chart & Flowchart Tabs Section */}
      <div className="oca-chart-section">
        <div className="oca-tabs">
          {[
            { id: 'timehorizons', label: '1 Day / 2 Wks / 1 Mo / 6 Mo Projections' },
            { id: 'maintenance', label: 'Vehicle Maintenance Breakdown' },
            { id: 'flowchart', label: 'Workflow Flowchart Diagram' },
            { id: 'overview', label: 'Daily Cost Breakdown Bar Chart' },
            { id: 'efficiency', label: 'Efficiency Metrics' },
            { id: 'pie', label: 'Cost Composition Pie Chart' },
          ].map(t => (
            <button
              key={t.id}
              className={`oca-tab ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}
              id={`oca-tab-${t.id}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab 1: 4 Time-Horizon Projections */}
        {activeTab === 'timehorizons' && costA && costB && (
          <div className="oca-chart-panel">
            <h3 className="oca-chart-title">Multi-Horizon Cost Analysis — 1 Day, 2 Weeks, 1 Month, 6 Months</h3>
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={barTimeHorizons} margin={{ top: 10, right: 24, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis tickFormatter={v => `₹${v}`} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip content={<CustomBarTooltip />} />
                <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
                <Bar dataKey="ZONE A (₹)" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar dataKey="ZONE B (₹)" fill="#16a34a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Combined (₹)" fill="#7c3aed" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="Combined (₹)" position="top" style={{ fill: '#4ade80', fontSize: 11, fontWeight: 700 }} formatter={v => INR(v)} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Time Horizon Table */}
            <div className="oca-projection-table">
              <h4 style={{ color: '#e2e8f0', marginBottom: 12 }}>🗓️ 4-Horizon Fleet Cost Projections Table</h4>
              <table className="oca-table">
                <thead>
                  <tr>
                    <th>Time Horizon</th>
                    <th>Operating Days</th>
                    <th>ZONE A (TRUCK-001)</th>
                    <th>ZONE B (TRUCK-002)</th>
                    <th>Combined Fleet Total</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { horizon: '1 Day (Daily)', days: '1 Day', a: costA.cost1Day, b: costB.cost1Day },
                    { horizon: '2 Weeks', days: '12 Days (6d/wk)', a: costA.cost2Weeks, b: costB.cost2Weeks },
                    { horizon: '1 Month', days: '26 Days', a: costA.cost1Month, b: costB.cost1Month },
                    { horizon: '6 Months', days: '156 Days', a: costA.cost6Months, b: costB.cost6Months },
                  ].map(({ horizon, days, a, b }) => (
                    <tr key={horizon}>
                      <td style={{ fontWeight: 700, color: '#f1f5f9' }}>{horizon}</td>
                      <td style={{ color: '#94a3b8' }}>{days}</td>
                      <td className="oca-td-blue">{INR(a)}</td>
                      <td className="oca-td-green">{INR(b)}</td>
                      <td className="oca-td-purple" style={{ fontSize: '0.9rem' }}>{INR(a + b)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Vehicle Maintenance Breakdown */}
        {activeTab === 'maintenance' && costA && costB && (
          <div className="oca-chart-panel">
            <h3 className="oca-chart-title">Reference Commercial Vehicle Maintenance &amp; Component Wear Breakdown</h3>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={barMaintenance} margin={{ top: 10, right: 24, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tickFormatter={v => `₹${v}`} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip content={<CustomBarTooltip />} />
                <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
                <Bar dataKey="ZONE A (₹)" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar dataKey="ZONE B (₹)" fill="#16a34a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            {/* Maintenance Detail Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginTop: '20px' }}>
              {[
                { title: 'Tyre Wear & Alignment', rate: '₹1.20 / km', desc: '6 commercial truck tyres @ ₹12,000 replaced every 35,000 km', icon: Wrench, color: '#f59e0b' },
                { title: 'Engine Oil & Filters', rate: '₹0.85 / km', desc: 'Engine oil, fuel filter & air filter replaced every 10,000 km', icon: Wrench, color: '#ef4444' },
                { title: 'Hydraulic Compactor & Seals', rate: '₹1.10 / km', desc: 'Hydraulic fluid, arm seals & RAM cylinders every 15,000 km', icon: Wrench, color: '#3b82f6' },
                { title: 'Brakes, Clutch & Leaf Springs', rate: '₹0.60 / km', desc: 'Heavy-duty brake shoes, clutch plate & spring greasing', icon: Wrench, color: '#22c55e' },
              ].map(({ title, rate, desc, icon: Icon, color }) => (
                <div key={title} style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '12px', borderLeft: `3px solid ${color}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '0.82rem', color: '#f1f5f9' }}>{title}</strong>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color, background: `${color}22`, padding: '2px 6px', borderRadius: 4 }}>{rate}</span>
                  </div>
                  <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '6px 0 0' }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Operational Flowchart */}
        {activeTab === 'flowchart' && (
          <OperationalWorkflowFlowchart costA={costA} costB={costB} zoneA={zoneA} zoneB={zoneB} />
        )}

        {/* Tab 4: Cost Breakdown Bar Chart */}
        {activeTab === 'overview' && (
          <div className="oca-chart-panel">
            <h3 className="oca-chart-title">Daily Cost Breakdown by Category</h3>
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={barCompareCost} margin={{ top: 10, right: 24, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis tickFormatter={v => `₹${v}`} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip content={<CustomBarTooltip />} />
                <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
                <Bar dataKey="ZONE A (₹)" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar dataKey="ZONE B (₹)" fill="#16a34a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Tab 5: Efficiency Metrics */}
        {activeTab === 'efficiency' && (
          <div className="oca-chart-panel">
            <h3 className="oca-chart-title">Efficiency Metrics — Cost per Km &amp; Cost per Bin (₹)</h3>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={barEfficiency} margin={{ top: 10, right: 24, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 13 }} />
                <YAxis tickFormatter={v => `₹${v}`} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip content={<CustomBarTooltip />} />
                <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
                <Bar dataKey="Cost/Km (₹)" fill="#f59e0b" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="Cost/Km (₹)" position="top" style={{ fill: '#f1f5f9', fontSize: 12, fontWeight: 700 }} formatter={v => `₹${v}`} />
                </Bar>
                <Bar dataKey="Cost/Bin (₹)" fill="#7c3aed" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="Cost/Bin (₹)" position="top" style={{ fill: '#f1f5f9', fontSize: 12, fontWeight: 700 }} formatter={v => `₹${v}`} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Tab 6: Cost Composition Pie Chart */}
        {activeTab === 'pie' && (
          <div className="oca-chart-panel">
            <div className="oca-chart-row">
              <div className="oca-chart-half">
                <h3 className="oca-chart-title" style={{ color: '#60a5fa' }}>ZONE A — Cost Composition</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={pieA} cx="50%" cy="50%" outerRadius={110} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {pieA.map((_, i) => <Cell key={i} fill={PIE_PALETTE[i % PIE_PALETTE.length]} />)}
                    </Pie>
                    <Tooltip formatter={v => INR(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="oca-chart-half">
                <h3 className="oca-chart-title" style={{ color: '#4ade80' }}>ZONE B — Cost Composition</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={pieB} cx="50%" cy="50%" outerRadius={110} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {pieB.map((_, i) => <Cell key={i} fill={PIE_PALETTE[i % PIE_PALETTE.length]} />)}
                    </Pie>
                    <Tooltip formatter={v => INR(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Assumptions Footer */}
      <div className="oca-assumptions">
        <h4>📋 Maharashtra Reference Operational Assumptions</h4>
        <ul>
          <li>Route distances computed using <strong>Haversine nearest-neighbour tour</strong> from the central depot through all zone bins and back based on <strong>mapping3.kml</strong>.</li>
          <li>Diesel Heavy Compactor: ₹89.62/litre @ 4.5 km/L (stop-and-go + PTO hydraulic compactor operation).</li>
          <li>Wages: Driver @ ₹850/day (Skilled) + Helper @ ₹550/day (Semi-Skilled) used as a reference operating assumption.</li>
          <li>Maintenance: Tyres ₹1.20/km + Engine Oil/Filters ₹0.85/km + Hydraulics ₹1.10/km + Brakes ₹0.60/km + Fixed Servicing ₹135/day.</li>
          <li>Operating days: 2 Weeks = 12 Days (6d/wk) · 1 Month = 26 Days · 6 Months = 156 Days.</li>
        </ul>
      </div>
    </div>
  );
}
