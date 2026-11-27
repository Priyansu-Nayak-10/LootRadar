import { getTimeTone } from '../lib/freeGames'

function formatExactTooltip(endDate) {
  if (!endDate || endDate === 'N/A') return undefined
  let d = null
  if (endDate instanceof Date) {
    d = endDate
  } else if (typeof endDate === 'number') {
    d = new Date(endDate)
  } else if (typeof endDate === 'string') {
    const clean = endDate.includes('T') ? endDate : `${endDate.replace(' ', 'T')}Z`
    d = new Date(clean)
  }
  if (!d || Number.isNaN(d.getTime())) return undefined
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default function TimeLeft({
  endDate,
  label,
  now,
  variant = 'text',
  tone: explicitTone,
  className = '',
}) {
  if (!label) return null
  const tone = explicitTone ?? getTimeTone(endDate, now)
  const baseClass =
    variant === 'badge' ? `wr-badge wr-badge--time-${tone}` : `wr-time wr-time--${tone}`
  const title = formatExactTooltip(endDate)

  return (
    <span className={`${baseClass} ${className}`.trim()} title={title}>
      {label}
    </span>
  )
}
