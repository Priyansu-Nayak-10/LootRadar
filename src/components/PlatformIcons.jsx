import { memo } from 'react'
import { PcIcon } from './icons'
import { PlayStationIcon, XboxIcon, SwitchIcon } from './icons/BrandIcons'

export const PlatformIcons = memo(function PlatformIcons({ platforms, size = 16, className = 'platform-icon' }) {
  if (!Array.isArray(platforms) || platforms.length === 0) return null

  const slugs = platforms.map((p) => {
    if (typeof p === 'string') return p.toLowerCase()
    return (p?.platform?.slug || p?.platform?.name || p?.name || '').toLowerCase()
  })

  const icons = []
  const hasPC = slugs.some((s) => s.includes('pc') || s.includes('windows') || s.includes('linux') || s.includes('mac'))
  const hasPS = slugs.some((s) => s.includes('playstation') || s.includes('ps'))
  const hasXbox = slugs.some((s) => s.includes('xbox'))
  const hasNintendo = slugs.some((s) => s.includes('nintendo') || s.includes('switch') || s.includes('wii'))

  if (hasPC) {
    icons.push(
      <PcIcon key="pc" size={size} strokeWidth={1.8} className={className} title="PC" aria-label="PC" />
    )
  }
  if (hasPS) {
    icons.push(
      <PlayStationIcon key="ps" size={size} className={className} title="PlayStation" aria-label="PlayStation" />
    )
  }
  if (hasXbox) {
    icons.push(
      <XboxIcon key="xbox" size={size} className={className} title="Xbox" aria-label="Xbox" />
    )
  }
  if (hasNintendo) {
    icons.push(
      <SwitchIcon key="nintendo" size={size} className={className} title="Nintendo" aria-label="Nintendo" />
    )
  }

  if (icons.length === 0) return null

  return <>{icons}</>
})

export default PlatformIcons
