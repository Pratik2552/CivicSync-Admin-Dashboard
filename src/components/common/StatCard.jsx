import './StatCard.css'

export default function StatCard({ label, value, icon: Icon, iconColor, trend, trendLabel, borderColor }) {
  return (
    <div className="stat-card" style={borderColor ? { borderTopColor: borderColor } : undefined}>
      <div className="stat-card-header">
        <span className="stat-label">{label}</span>
        {Icon && (
          <div className="stat-icon" style={iconColor ? { color: iconColor, background: iconColor + '18' } : undefined}>
            <Icon size={16} />
          </div>
        )}
      </div>
      <div className="stat-value">{value}</div>
      {trendLabel && (
        <div className={`stat-trend ${trend === 'up' ? 'trend-up' : trend === 'down' ? 'trend-down' : ''}`}>
          {trendLabel}
        </div>
      )}
    </div>
  )
}
