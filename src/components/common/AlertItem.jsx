import { AlertTriangle, AlertCircle, Info, CheckCircle } from 'lucide-react'
import './AlertItem.css'

const ICONS = {
  critical: AlertTriangle,
  warning: AlertCircle,
  info: Info,
}

const SEVERITY_LABELS = {
  critical: 'CRITICAL',
  warning: 'WARNING',
  info: 'INFO',
}

export default function AlertItem({ alert }) {
  const Icon = ICONS[alert.severity] || Info
  return (
    <div className={`alert-item alert-${alert.severity} ${alert.acknowledged ? 'acknowledged' : ''}`}>
      <div className="alert-icon">
        <Icon size={14} />
      </div>
      <div className="alert-body">
        <div className="alert-meta">
          <span className={`alert-severity-label alert-sev-${alert.severity}`}>
            {SEVERITY_LABELS[alert.severity]}
          </span>
          <span className="alert-time">{alert.timestamp}</span>
        </div>
        <p className="alert-message">{alert.message}</p>
      </div>
    </div>
  )
}
