import React from 'react'
import Icon from './Icon'
import {
  Radar,
  Compass,
  Gift,
  Tag,
  Library,
  Heart,
  Newspaper,
  CircleUser,
  Search,
  X,
  Bell,
  BellOff,
  BellRing,
  Trash2,
  Check,
  CircleCheck,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Flame,
  Star,
  Send,
  Monitor,
  Gamepad2,
  Clock,
  Info,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react'

export { default as Icon } from './Icon'

// ─── NAV & SHELL ICONS ────────────────────────────────────────────────────────
export function RadarIcon(props) {
  return <Icon icon={Radar} {...props} />
}

export function CompassIcon(props) {
  return <Icon icon={Compass} {...props} />
}

export function GiftIcon(props) {
  return <Icon icon={Gift} {...props} />
}

export function TagIcon(props) {
  return <Icon icon={Tag} {...props} />
}

export function LibraryIcon(props) {
  return <Icon icon={Library} {...props} />
}

export function HeartIcon({ active, filled, fill, className = '', ...props }) {
  const isFilled = active || filled
  return (
    <Icon
      icon={Heart}
      fill={isFilled ? fill || 'var(--c-wish)' : 'none'}
      color={isFilled ? 'var(--c-wish)' : undefined}
      className={`icon-heart ${isFilled ? 'is-active' : ''} ${className}`.trim()}
      {...props}
    />
  )
}

export function NewspaperIcon(props) {
  return <Icon icon={Newspaper} {...props} />
}

export function AccountIcon(props) {
  return <Icon icon={CircleUser} {...props} />
}

export function SearchIcon(props) {
  return <Icon icon={Search} {...props} />
}

export function CloseIcon(props) {
  return <Icon icon={X} {...props} />
}

// ─── ACTION & UTILITY ICONS ──────────────────────────────────────────────────
export function BellIcon({ active, className = '', ...props }) {
  if (active === false) {
    return <Icon icon={BellOff} className={`wishlist-icon wishlist-icon--muted ${className}`.trim()} {...props} />
  }
  return <Icon icon={active ? BellRing : Bell} className={`${active ? 'icon-bell-active wishlist-icon--active' : ''} ${className}`.trim()} {...props} />
}

export function BellOffIcon(props) {
  return <Icon icon={BellOff} {...props} />
}

export function TrashIcon(props) {
  return <Icon icon={Trash2} {...props} />
}

export function CheckIcon(props) {
  return <Icon icon={Check} {...props} />
}

export function CircleCheckIcon(props) {
  return <Icon icon={CircleCheck} {...props} />
}

export function ExternalLinkIcon(props) {
  return <Icon icon={ExternalLink} {...props} />
}

export function ChevronLeftIcon(props) {
  return <Icon icon={ChevronLeft} {...props} />
}

export function ChevronRightIcon(props) {
  return <Icon icon={ChevronRight} {...props} />
}

export function ChevronDownIcon(props) {
  return <Icon icon={ChevronDown} {...props} />
}

export function FlameIcon({ gradient = true, className = '', ...props }) {
  if (!gradient) {
    return <Icon icon={Flame} fill="currentColor" className={className} {...props} />
  }
  return (
    <span className={`flame-icon-wrap ${className}`.trim()} style={{ display: 'inline-flex', verticalAlign: 'middle', alignItems: 'center' }}>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
        <linearGradient id="fire-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--c-fire-a)" />
          <stop offset="100%" stopColor="var(--c-fire-b)" />
        </linearGradient>
      </svg>
      <Icon icon={Flame} fill="url(#fire-gradient)" color="var(--c-fire-b)" {...props} />
    </span>
  )
}

export function StarIcon(props) {
  return <Icon icon={Star} fill="currentColor" {...props} />
}

export function SendIcon(props) {
  return <Icon icon={Send} {...props} />
}

export function PcIcon(props) {
  return <Icon icon={Monitor} {...props} />
}

export function GamepadIcon(props) {
  return <Icon icon={Gamepad2} {...props} />
}

export function ClockIcon(props) {
  return <Icon icon={Clock} {...props} />
}

export function InfoIcon(props) {
  return <Icon icon={Info} {...props} />
}

export function RotateCcwIcon(props) {
  return <Icon icon={RotateCcw} {...props} />
}

export function AlertTriangleIcon(props) {
  return <Icon icon={AlertTriangle} {...props} />
}

// ─── BRAND LOGOS ─────────────────────────────────────────────────────────────
export {
  PlayStationIcon,
  XboxIcon,
  SwitchIcon,
  SteamIcon,
  EpicGamesIcon,
  GogIcon,
  EaIcon,
  HumbleIcon,
  StoreIcon,
  DiscordIcon,
  GithubIcon,
  XIcon as XBrandIcon,
  BlueskyIcon,
} from './BrandIcons'

// ─── BRAND RADAR MARK (WisherRadar Header / Footer Mark) ──────────────────────
export function RadarMarkIcon({ size = 22, className = '', ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      width={size}
      height={size}
      stroke="currentColor"
      strokeWidth="1.75"
      className={className}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <path d="m12 12 6.2-6.2M12 3.5v2M3.5 12h2" strokeLinecap="round" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    </svg>
  )
}
