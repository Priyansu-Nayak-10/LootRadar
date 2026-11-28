/*
 * Icon sources and licenses:
 * - Simple Icons via react-icons/si (CC0 1.0)
 * - Font Awesome Free brands via react-icons/fa6 (CC BY 4.0)
 * - Bootstrap Icons via react-icons/bs (MIT)
 * Brand marks belong to their respective owners and are used only to identify platforms and stores.
 */
import React from 'react'
import {
  SiPlaystation,
  SiSteam,
  SiEpicgames,
  SiGogdotcom,
  SiEa,
  SiUbisoft,
  SiItchdotio,
  SiHumblebundle,
} from 'react-icons/si'
import { FaWindows, FaXbox, FaAmazon, FaGamepad } from 'react-icons/fa6'
import { BsNintendoSwitch } from 'react-icons/bs'

// Normalize visual weight across Simple Icons, Font Awesome 6, and Bootstrap Icons
const ICON_SCALE_MAP = {
  Windows: 0.94,
  PlayStation: 1.04,
  Xbox: 0.94,
  Switch: 0.92,
  Steam: 0.96,
  Epic: 0.94,
  GOG: 0.96,
  EA: 0.96,
  Ubisoft: 0.96,
  Itch: 0.96,
  Humble: 0.96,
  Amazon: 0.94,
  Gamepad: 0.98,
}

export function BrandIconBox({
  icon: IconComp,
  scaleKey,
  size = 16,
  className = '',
  title,
  'aria-label': ariaLabel,
  'aria-hidden': ariaHidden,
  ...props
}) {
  if (!IconComp) return null
  const scale = scaleKey ? ICON_SCALE_MAP[scaleKey] ?? 1 : 1
  const label = ariaLabel || title
  const isDecorative = !label || ariaHidden === true || ariaHidden === 'true'

  return (
    <span
      className={`wr-brand-icon ${className}`.trim()}
      role={isDecorative ? undefined : 'img'}
      aria-label={isDecorative ? undefined : label}
      aria-hidden={isDecorative ? 'true' : undefined}
      title={title}
      style={{
        width: size,
        height: size,
        display: 'inline-grid',
        placeItems: 'center',
        flex: 'none',
        lineHeight: 0,
      }}
      {...props}
    >
      <IconComp
        aria-hidden="true"
        focusable="false"
        style={{
          width: '100%',
          height: '100%',
          fill: 'currentColor',
          transform: scale !== 1 ? `scale(${scale})` : undefined,
        }}
      />
    </span>
  )
}

// ─── PLATFORM BRAND ICONS ─────────────────────────────────────────────────────

export function WindowsIcon(props) {
  return <BrandIconBox icon={FaWindows} scaleKey="Windows" {...props} />
}

export function PlayStationIcon(props) {
  return <BrandIconBox icon={SiPlaystation} scaleKey="PlayStation" {...props} />
}

export function XboxIcon(props) {
  return <BrandIconBox icon={FaXbox} scaleKey="Xbox" {...props} />
}

export function SwitchIcon(props) {
  return <BrandIconBox icon={BsNintendoSwitch} scaleKey="Switch" {...props} />
}

// ─── STORE BRAND ICONS ───────────────────────────────────────────────────────

export function SteamIcon(props) {
  return <BrandIconBox icon={SiSteam} scaleKey="Steam" {...props} />
}

export function EpicGamesIcon(props) {
  return <BrandIconBox icon={SiEpicgames} scaleKey="Epic" {...props} />
}

export function GogIcon(props) {
  return <BrandIconBox icon={SiGogdotcom} scaleKey="GOG" {...props} />
}

export function EaIcon(props) {
  return <BrandIconBox icon={SiEa} scaleKey="EA" {...props} />
}

export function UbisoftIcon(props) {
  return <BrandIconBox icon={SiUbisoft} scaleKey="Ubisoft" {...props} />
}

export function ItchIcon(props) {
  return <BrandIconBox icon={SiItchdotio} scaleKey="Itch" {...props} />
}

export function HumbleIcon(props) {
  return <BrandIconBox icon={SiHumblebundle} scaleKey="Humble" {...props} />
}

export function AmazonIcon(props) {
  return <BrandIconBox icon={FaAmazon} scaleKey="Amazon" {...props} />
}

export function GamepadBrandIcon(props) {
  return <BrandIconBox icon={FaGamepad} scaleKey="Gamepad" {...props} />
}

// Helper to resolve store name to brand icon (generic gamepad fallback for STOVE / Meta Quest / Other)
export function StoreIcon({ store = '', size = 14, className = '', ...props }) {
  const s = String(store).toLowerCase()
  if (s.includes('steam')) return <SteamIcon size={size} className={className} {...props} />
  if (s.includes('epic')) return <EpicGamesIcon size={size} className={className} {...props} />
  if (s.includes('gog')) return <GogIcon size={size} className={className} {...props} />
  if (s.includes('ea') || s.includes('origin')) return <EaIcon size={size} className={className} {...props} />
  if (s.includes('ubisoft') || s.includes('uplay')) return <UbisoftIcon size={size} className={className} {...props} />
  if (s.includes('itch')) return <ItchIcon size={size} className={className} {...props} />
  if (s.includes('humble')) return <HumbleIcon size={size} className={className} {...props} />
  if (s.includes('amazon') || s.includes('prime')) return <AmazonIcon size={size} className={className} {...props} />
  if (s.includes('playstation') || s.includes('ps store') || s.includes('psn')) return <PlayStationIcon size={size} className={className} {...props} />
  if (s.includes('xbox') || s.includes('microsoft')) return <XboxIcon size={size} className={className} {...props} />
  if (s.includes('switch') || s.includes('nintendo')) return <SwitchIcon size={size} className={className} {...props} />
  return <GamepadBrandIcon size={size} className={className} {...props} />
}

// ─── FOOTER SOCIAL BRAND ICONS ────────────────────────────────────────────────

function BaseSocialSvg({
  size = 15,
  viewBox = '0 0 24 24',
  className = '',
  'aria-hidden': ariaHidden = true,
  'aria-label': ariaLabel,
  title,
  children,
  ...props
}) {
  const isDecorative = !ariaLabel && !title && ariaHidden
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="currentColor"
      className={className}
      aria-hidden={isDecorative ? 'true' : undefined}
      aria-label={ariaLabel}
      title={title}
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

export function DiscordIcon(props) {
  return (
    <BaseSocialSvg viewBox="0 0 20 19" {...props}>
      <path d="M16.224 3.768a14.5 14.5 0 0 0-3.67-1.153c-.158.286-.343.67-.47.976a13.5 13.5 0 0 0-4.067 0c-.128-.306-.317-.69-.476-.976A14.4 14.4 0 0 0 3.868 3.77C1.546 7.28.916 10.703 1.231 14.077a14.7 14.7 0 0 0 4.5 2.306q.545-.748.965-1.587a9.5 9.5 0 0 1-1.518-.74q.191-.14.372-.293c2.927 1.369 6.107 1.369 8.999 0q.183.152.372.294-.723.437-1.52.74.418.838.963 1.588a14.6 14.6 0 0 0 4.504-2.308c.37-3.911-.63-7.302-2.644-10.309m-9.13 8.234c-.878 0-1.599-.82-1.599-1.82 0-.998.705-1.82 1.6-1.82.894 0 1.614.82 1.599 1.82.001 1-.705 1.82-1.6 1.82m5.91 0c-.878 0-1.599-.82-1.599-1.82 0-.998.705-1.82 1.6-1.82.893 0 1.614.82 1.599 1.82 0 1-.706 1.82-1.6 1.82" />
    </BaseSocialSvg>
  )
}

export function GithubIcon(props) {
  return (
    <BaseSocialSvg viewBox="0 0 19 19" {...props}>
      <path fillRule="evenodd" clipRule="evenodd" d="M9.356 1.85C5.05 1.85 1.57 5.356 1.57 9.694a7.84 7.84 0 0 0 5.324 7.44c.387.079.528-.168.528-.376 0-.182-.013-.805-.013-1.454-2.165.467-2.616-.935-2.616-.935-.349-.91-.864-1.143-.864-1.143-.71-.48.051-.48.051-.48.787.051 1.2.805 1.2.805.695 1.194 1.817.857 2.268.649.064-.507.27-.857.49-1.052-1.728-.182-3.545-.857-3.545-3.87 0-.857.31-1.558.8-2.104-.078-.195-.349-1 .077-2.078 0 0 .657-.208 2.14.805a7.5 7.5 0 0 1 1.946-.26c.657 0 1.328.092 1.946.26 1.483-1.013 2.14-.805 2.14-.805.426 1.078.155 1.883.078 2.078.502.546.799 1.247.799 2.104 0 3.013-1.818 3.675-3.558 3.87.284.247.528.714.528 1.454 0 1.052-.012 1.896-.012 2.156 0 .208.142.455.528.377a7.84 7.84 0 0 0 5.324-7.441c.013-4.338-3.48-7.844-7.773-7.844" />
    </BaseSocialSvg>
  )
}

export function XIcon(props) {
  return (
    <BaseSocialSvg viewBox="0 0 19 19" {...props}>
      <path fillRule="evenodd" clipRule="evenodd" d="M1.893 1.98c.052.072 1.245 1.769 2.653 3.77l2.892 4.114c.183.261.333.48.333.486s-.068.089-.152.183l-.522.593-.765.867-3.597 4.087c-.375.426-.734.834-.798.905a1 1 0 0 0-.118.148c0 .01.236.017.664.017h.663l.729-.83c.4-.457.796-.906.879-.999a692 692 0 0 0 1.794-2.038c.034-.037.301-.34.594-.675l.551-.624.345-.392a7 7 0 0 1 .34-.374c.006 0 .93 1.306 2.052 2.903l2.084 2.965.045.063h2.275c1.87 0 2.273-.003 2.266-.021-.008-.02-1.098-1.572-3.894-5.547-2.013-2.862-2.28-3.246-2.273-3.266.008-.019.282-.332 2.085-2.38l2-2.274 1.567-1.782c.022-.028-.016-.03-.65-.03h-.674l-.3.342a871 871 0 0 1-1.782 2.025c-.067.075-.405.458-.75.852a100 100 0 0 1-.803.91c-.148.172-.299.344-.99 1.127-.304.343-.32.358-.345.327-.015-.019-.904-1.282-1.976-2.808L6.365 1.85H1.8zm1.782.91 8.078 11.294c.772 1.08 1.413 1.973 1.425 1.984.016.017.241.02 1.05.017l1.03-.004-2.694-3.766L7.796 5.75 5.722 2.852l-1.039-.004-1.039-.004z" />
    </BaseSocialSvg>
  )
}

export function BlueskyIcon(props) {
  return (
    <BaseSocialSvg viewBox="0 0 16 17" {...props}>
      <path d="M7.75 7.735c-.693-1.348-2.58-3.86-4.334-5.097-1.68-1.187-2.32-.981-2.74-.79C.188 2.065.1 2.812.1 3.251s.241 3.602.398 4.13c.52 1.744 2.367 2.333 4.07 2.145-2.495.37-4.71 1.278-1.805 4.512 3.196 3.309 4.38-.71 4.987-2.746.608 2.036 1.307 5.91 4.93 2.746 2.72-2.746.747-4.143-1.747-4.512 1.702.189 3.55-.4 4.07-2.145.156-.528.397-3.691.397-4.13s-.088-1.186-.575-1.406c-.42-.19-1.06-.395-2.741.79-1.755 1.24-3.64 3.752-4.334 5.099" />
    </BaseSocialSvg>
  )
}
