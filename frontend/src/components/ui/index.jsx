import { Loader2, AlertTriangle } from 'lucide-react'
import { STATUS_CONFIG, PLATFORM_CONFIG } from '../../utils/helpers'

export function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.new
  return (
    <span className={`status-badge ${cfg.classes}`}>
      {cfg.label}
    </span>
  )
}

export function PlatformBadge({ platform }) {
  const cfg = PLATFORM_CONFIG[platform] || { short: platform?.toUpperCase(), color: 'text-slate-400' }
  return (
    <span className={`font-mono text-xs font-medium ${cfg.color}`}>
      {cfg.short}
    </span>
  )
}

export function Spinner({ size = 'md', className = '' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-5 h-5', lg: 'w-8 h-8' }
  return (
    <Loader2 className={`animate-spin text-signal ${sizes[size]} ${className}`} />
  )
}

export function PageSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <Spinner size="lg" />
    </div>
  )
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      {Icon && (
        <div className="w-12 h-12 rounded-full bg-signal-muted flex items-center justify-center mb-4">
          <Icon className="w-5 h-5 text-signal" />
        </div>
      )}
      <p className="font-display font-semibold text-white mb-1">{title}</p>
      {description && (
        <p className="text-sm text-slate-500 max-w-xs mb-4">{description}</p>
      )}
      {action}
    </div>
  )
}

export function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-white">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

export function ConfirmDialog({ open, title, description, onConfirm, onCancel, danger }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative card p-6 w-full max-w-sm mx-4 animate-fade-up">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <div>
            <p className="font-display font-semibold text-white text-sm">{title}</p>
            <p className="text-xs text-slate-500 mt-1">{description}</p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button className="btn-ghost text-xs px-3 py-1.5" onClick={onCancel}>Cancel</button>
          <button
            className={`text-xs px-3 py-1.5 rounded-lg font-body font-medium transition-all duration-200 ${
              danger
                ? 'bg-red-500/15 border border-red-500/25 text-red-400 hover:bg-red-500/25'
                : 'btn-primary'
            }`}
            onClick={onConfirm}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}

export function ScoreDisplay({ score, className = '' }) {
  if (score === null || score === undefined) {
    return <span className={`score-badge text-slate-600 ${className}`}>—</span>
  }
  const color = score >= 80 ? 'text-signal' : score >= 60 ? 'text-amber-400' : 'text-red-400'
  return (
    <span className={`score-badge ${color} ${className}`}>{score}%</span>
  )
}

export function ScoreBar({ score }) {
  if (score === null || score === undefined) return null
  const color = score >= 80 ? 'bg-signal' : score >= 60 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="w-full h-1 bg-ink-600 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${score}%` }}
      />
    </div>
  )
}

export function Tag({ children, className = '' }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono
      bg-ink-700 border border-white/8 text-slate-400 ${className}`}>
      {children}
    </span>
  )
}
