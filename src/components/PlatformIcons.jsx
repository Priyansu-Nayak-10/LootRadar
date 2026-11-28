/*
 * Platform icon sources and licenses:
 * - Simple Icons via react-icons/si (CC0 1.0)
 * - Font Awesome Free via react-icons/fa6 (CC BY 4.0)
 * - Bootstrap Icons via react-icons/bs (MIT)
 * Brand marks belong to their respective owners and are used only to identify platforms.
 */
import { memo } from 'react'
import { WindowsIcon, PlayStationIcon, XboxIcon, SwitchIcon } from './icons/BrandIcons'

export const PlatformIcons = memo(function PlatformIcons({
  platforms,
  size = 18,
  className = 'platform-icon',
  maxIcons,
}) {
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
      <WindowsIcon key="pc" size={size} className={className} title="PC" aria-label="PC" />
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
      <SwitchIcon key="nintendo" size={size} className={className} title="Nintendo Switch" aria-label="Nintendo Switch" />
    )
  }

  if (icons.length === 0) return null

  const visible = typeof maxIcons === 'number' ? icons.slice(0, maxIcons) : icons
  return (
    <span
      className="wr-platform-icons"
      style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
    >
      {visible}
    </span>
  )
})

export default PlatformIcons
