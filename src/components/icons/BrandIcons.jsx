import React from 'react'

function BaseBrandSvg({
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

// ─── PLATFORM BRAND ICONS ─────────────────────────────────────────────────────

export function PlayStationIcon(props) {
  return (
    <BaseBrandSvg viewBox="0 0 24 24" {...props}>
      <path d="M8.5 4.5c.3 0 .7.1 1 .2l7.2 2.7c1.3.5 2.3 1.6 2.3 3.1 0 1.7-1.3 3.1-3 3.1H14v6.9c0 .8-.7 1.5-1.5 1.5s-1.5-.7-1.5-1.5V13.6H9c-2.8 0-5-2.2-5-5s2.2-5 5-5h-.5zm5.5 6.1h2c.6 0 1-.4 1-1 0-.5-.4-.9-.9-1l-2.1-.8v2.8zm-5.5-3.1c-1.1 0-2 .9-2 2s.9 2 2 2h2V7.5h-2z" />
    </BaseBrandSvg>
  )
}

export function XboxIcon(props) {
  return (
    <BaseBrandSvg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m8.5 6 7 12M15.5 6l-7 12" />
    </BaseBrandSvg>
  )
}

export function SwitchIcon(props) {
  return (
    <BaseBrandSvg viewBox="0 0 16 16" {...props}>
      <path d="M5.2 2A2.2 2.2 0 0 0 3 4.2v7.6A2.2 2.2 0 0 0 5.2 14h2.1V2H5.2Zm.2 3.2a1 1 0 1 1 0 2 1 1 0 0 1 0-2ZM8.7 2v12h2.1a2.2 2.2 0 0 0 2.2-2.2V4.2A2.2 2.2 0 0 0 10.8 2H8.7Zm2.1 6.3a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" />
    </BaseBrandSvg>
  )
}

// ─── STORE BRAND ICONS ───────────────────────────────────────────────────────

export function SteamIcon(props) {
  return (
    <BaseBrandSvg viewBox="0 0 24 24" {...props}>
      <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.005.105.005.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 12-5.373 12-12s-5.373-12-12-12z" />
    </BaseBrandSvg>
  )
}

export function EpicGamesIcon(props) {
  return (
    <BaseBrandSvg viewBox="0 0 24 24" {...props}>
      <path d="M4.5 2.5h15v14.5l-7.5 4.5-7.5-4.5V2.5zm3 3v9.5l4.5 2.7 4.5-2.7V5.5H7.5zm2 2h5v1.8h-3v1.2h2.5v1.8H11.5v1.5h3.2v1.8H9.5V7.5z" />
    </BaseBrandSvg>
  )
}

export function GogIcon(props) {
  return (
    <BaseBrandSvg viewBox="0 0 24 24" {...props}>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c3.87 0 7 3.13 7 7 0 1.9-.76 3.63-2 4.9L8.1 8c1.07-.63 2.44-1 3.9-1zm-7 7c0-1.9.76-3.63 2-4.9L15.9 16c-1.07.63-2.44 1-3.9 1-3.87 0-7-3.13-7-7z" />
    </BaseBrandSvg>
  )
}

export function EaIcon(props) {
  return (
    <BaseBrandSvg viewBox="0 0 24 24" {...props}>
      <path d="M2.5 17.5 8 6.5l4 8h-2.5l-1.5-3-1.8 3.5h3.8L9 17.5H2.5zm9.5-3 5.5-8h4.5l-4 6 4 5H18l-2.5-3.5L14 16v1.5h-2V14.5z" />
    </BaseBrandSvg>
  )
}

export function HumbleIcon(props) {
  return (
    <BaseBrandSvg viewBox="0 0 24 24" {...props}>
      <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm3.5 14.5h-2v-3.5h-3v3.5h-2v-9h2v3.5h3V7.5h2z" />
    </BaseBrandSvg>
  )
}

// Helper to resolve store name to brand icon or generic fallback
export function StoreIcon({ store = '', size = 14, className = '', ...props }) {
  const s = String(store).toLowerCase()
  if (s.includes('steam')) return <SteamIcon size={size} className={className} {...props} />
  if (s.includes('epic')) return <EpicGamesIcon size={size} className={className} {...props} />
  if (s.includes('gog')) return <GogIcon size={size} className={className} {...props} />
  if (s.includes('ea') || s.includes('origin')) return <EaIcon size={size} className={className} {...props} />
  if (s.includes('humble')) return <HumbleIcon size={size} className={className} {...props} />
  if (s.includes('playstation') || s.includes('ps store') || s.includes('psn')) return <PlayStationIcon size={size} className={className} {...props} />
  if (s.includes('xbox') || s.includes('microsoft')) return <XboxIcon size={size} className={className} {...props} />
  if (s.includes('switch') || s.includes('nintendo')) return <SwitchIcon size={size} className={className} {...props} />
  return null
}

// ─── FOOTER SOCIAL BRAND ICONS ────────────────────────────────────────────────

export function DiscordIcon(props) {
  return (
    <BaseBrandSvg viewBox="0 0 20 19" {...props}>
      <path d="M16.224 3.768a14.5 14.5 0 0 0-3.67-1.153c-.158.286-.343.67-.47.976a13.5 13.5 0 0 0-4.067 0c-.128-.306-.317-.69-.476-.976A14.4 14.4 0 0 0 3.868 3.77C1.546 7.28.916 10.703 1.231 14.077a14.7 14.7 0 0 0 4.5 2.306q.545-.748.965-1.587a9.5 9.5 0 0 1-1.518-.74q.191-.14.372-.293c2.927 1.369 6.107 1.369 8.999 0q.183.152.372.294-.723.437-1.52.74.418.838.963 1.588a14.6 14.6 0 0 0 4.504-2.308c.37-3.911-.63-7.302-2.644-10.309m-9.13 8.234c-.878 0-1.599-.82-1.599-1.82 0-.998.705-1.82 1.6-1.82.894 0 1.614.82 1.599 1.82.001 1-.705 1.82-1.6 1.82m5.91 0c-.878 0-1.599-.82-1.599-1.82 0-.998.705-1.82 1.6-1.82.893 0 1.614.82 1.599 1.82 0 1-.706 1.82-1.6 1.82" />
    </BaseBrandSvg>
  )
}

export function GithubIcon(props) {
  return (
    <BaseBrandSvg viewBox="0 0 19 19" {...props}>
      <path fillRule="evenodd" clipRule="evenodd" d="M9.356 1.85C5.05 1.85 1.57 5.356 1.57 9.694a7.84 7.84 0 0 0 5.324 7.44c.387.079.528-.168.528-.376 0-.182-.013-.805-.013-1.454-2.165.467-2.616-.935-2.616-.935-.349-.91-.864-1.143-.864-1.143-.71-.48.051-.48.051-.48.787.051 1.2.805 1.2.805.695 1.194 1.817.857 2.268.649.064-.507.27-.857.49-1.052-1.728-.182-3.545-.857-3.545-3.87 0-.857.31-1.558.8-2.104-.078-.195-.349-1 .077-2.078 0 0 .657-.208 2.14.805a7.5 7.5 0 0 1 1.946-.26c.657 0 1.328.092 1.946.26 1.483-1.013 2.14-.805 2.14-.805.426 1.078.155 1.883.078 2.078.502.546.799 1.247.799 2.104 0 3.013-1.818 3.675-3.558 3.87.284.247.528.714.528 1.454 0 1.052-.012 1.896-.012 2.156 0 .208.142.455.528.377a7.84 7.84 0 0 0 5.324-7.441c.013-4.338-3.48-7.844-7.773-7.844" />
    </BaseBrandSvg>
  )
}

export function XIcon(props) {
  return (
    <BaseBrandSvg viewBox="0 0 19 19" {...props}>
      <path fillRule="evenodd" clipRule="evenodd" d="M1.893 1.98c.052.072 1.245 1.769 2.653 3.77l2.892 4.114c.183.261.333.48.333.486s-.068.089-.152.183l-.522.593-.765.867-3.597 4.087c-.375.426-.734.834-.798.905a1 1 0 0 0-.118.148c0 .01.236.017.664.017h.663l.729-.83c.4-.457.796-.906.879-.999a692 692 0 0 0 1.794-2.038c.034-.037.301-.34.594-.675l.551-.624.345-.392a7 7 0 0 1 .34-.374c.006 0 .93 1.306 2.052 2.903l2.084 2.965.045.063h2.275c1.87 0 2.273-.003 2.266-.021-.008-.02-1.098-1.572-3.894-5.547-2.013-2.862-2.28-3.246-2.273-3.266.008-.019.282-.332 2.085-2.38l2-2.274 1.567-1.782c.022-.028-.016-.03-.65-.03h-.674l-.3.342a871 871 0 0 1-1.782 2.025c-.067.075-.405.458-.75.852a100 100 0 0 1-.803.91c-.148.172-.299.344-.99 1.127-.304.343-.32.358-.345.327-.015-.019-.904-1.282-1.976-2.808L6.365 1.85H1.8zm1.782.91 8.078 11.294c.772 1.08 1.413 1.973 1.425 1.984.016.017.241.02 1.05.017l1.03-.004-2.694-3.766L7.796 5.75 5.722 2.852l-1.039-.004-1.039-.004z" />
    </BaseBrandSvg>
  )
}

export function BlueskyIcon(props) {
  return (
    <BaseBrandSvg viewBox="0 0 16 17" {...props}>
      <path d="M7.75 7.735c-.693-1.348-2.58-3.86-4.334-5.097-1.68-1.187-2.32-.981-2.74-.79C.188 2.065.1 2.812.1 3.251s.241 3.602.398 4.13c.52 1.744 2.367 2.333 4.07 2.145-2.495.37-4.71 1.278-1.805 4.512 3.196 3.309 4.38-.71 4.987-2.746.608 2.036 1.307 5.91 4.93 2.746 2.72-2.746.747-4.143-1.747-4.512 1.702.189 3.55-.4 4.07-2.145.156-.528.397-3.691.397-4.13s-.088-1.186-.575-1.406c-.42-.19-1.06-.395-2.741.79-1.755 1.24-3.64 3.752-4.334 5.099" />
    </BaseBrandSvg>
  )
}
