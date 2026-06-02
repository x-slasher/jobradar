import { formatDistanceToNow, format } from 'date-fns'

export function scoreColor(score) {
  if (score === null || score === undefined) return 'text-slate-500'
  if (score >= 80) return 'text-signal'
  if (score >= 60) return 'text-amber-400'
  return 'text-red-400'
}

export function scoreBarColor(score) {
  if (score === null || score === undefined) return 'bg-slate-600'
  if (score >= 80) return 'bg-signal'
  if (score >= 60) return 'bg-amber-400'
  return 'bg-red-400'
}

export const STATUS_CONFIG = {
  new: { label: 'New', classes: 'bg-signal-muted text-signal border border-signal/20' },
  interested: { label: 'Interested', classes: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' },
  applied: { label: 'Applied', classes: 'bg-violet-500/10 text-violet-400 border border-violet-500/20' },
  skipped: { label: 'Skipped', classes: 'bg-white/5 text-slate-500 border border-white/10' },
}

export const PLATFORM_CONFIG = {
  weworkremotely: { label: 'We Work Remotely', short: 'WWR', color: 'text-orange-400' },
  himalayas: { label: 'Himalayas', short: 'HIM', color: 'text-sky-400' },
  arcdev: { label: 'Arc.dev', short: 'ARC', color: 'text-purple-400' },
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
  } catch {
    return '—'
  }
}

export function formatDateFull(dateStr) {
  if (!dateStr) return '—'
  try {
    return format(new Date(dateStr), 'MMM d, yyyy · HH:mm')
  } catch {
    return '—'
  }
}

export function getPlatformLabel(platform) {
  return PLATFORM_CONFIG[platform]?.label || platform
}
