const STATUS_CONFIG = {
  active:       { label: 'Active',       cls: 'status-active' },
  in_transit:   { label: 'In Transit',   cls: 'status-transit' },
  maintenance:  { label: 'Maintenance',  cls: 'status-maintenance' },
  open:         { label: 'Open',         cls: 'status-critical' },
  assigned:     { label: 'Assigned',     cls: 'status-assigned' },
  resolved:     { label: 'Resolved',     cls: 'status-resolved' },
  solved:       { label: 'Solved',       cls: 'status-resolved' },
  closed:       { label: 'Closed',       cls: 'status-resolved' },
  cleaned:      { label: 'Cleaned',      cls: 'status-resolved' },
  critical:     { label: 'Critical',     cls: 'status-critical' },
  warning:      { label: 'Warning',      cls: 'status-pending' },
  normal:       { label: 'Normal',       cls: 'status-resolved' },
  low:          { label: 'Low',          cls: 'status-assigned' },
  medium:       { label: 'Medium',       cls: 'status-pending' },
  high:         { label: 'High',         cls: 'status-critical' },
}

export default function StatusBadge({ status, label }) {
  const config = STATUS_CONFIG[status] || { label: label || status, cls: '' }
  return (
    <span className={`badge ${config.cls}`}>
      {label || config.label}
    </span>
  )
}
