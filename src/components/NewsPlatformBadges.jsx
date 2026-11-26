import React from 'react'
import {
  PcIcon,
  PlayStationIcon,
  XboxIcon,
  SwitchIcon,
} from './icons'

function PlatformGlyph({ platform }) {
  switch (platform) {
    case 'PC':
      return <PcIcon size={13} aria-hidden="true" />
    case 'PlayStation':
      return <PlayStationIcon size={13} aria-hidden="true" />
    case 'Xbox':
      return <XboxIcon size={13} aria-hidden="true" />
    case 'Switch':
      return <SwitchIcon size={13} aria-hidden="true" />
    default:
      return null
  }
}

export default function NewsPlatformBadges({ platforms }) {
  if (!Array.isArray(platforms) || platforms.length === 0) return null
  return (
    <span className="news-platform-icons" aria-label={`Platforms: ${platforms.join(', ')}`}>
      {platforms.slice(0, 4).map((platform) => (
        <span
          key={platform}
          className="news-platform-icon"
          title={platform}
          aria-label={platform}
        >
          <PlatformGlyph platform={platform} />
        </span>
      ))}
    </span>
  )
}
