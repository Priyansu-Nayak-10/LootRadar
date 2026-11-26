import React from 'react'

/**
 * Universal Icon wrapper for WishRadar.
 * Defaults: size 20, strokeWidth 1.75, aria-hidden="true", focusable="false", color="currentColor".
 */
export default function Icon({
  icon: Component,
  size = 20,
  strokeWidth = 1.75,
  color = 'currentColor',
  className = '',
  'aria-hidden': ariaHidden = true,
  'aria-label': ariaLabel,
  title,
  fill,
  ...props
}) {
  if (!Component) return null

  // If an aria-label or title is supplied, it's not purely decorative
  const isDecorative = !ariaLabel && !title && ariaHidden

  return (
    <Component
      size={size}
      strokeWidth={strokeWidth}
      color={color}
      fill={fill || 'none'}
      className={className}
      aria-hidden={isDecorative ? 'true' : undefined}
      aria-label={ariaLabel}
      title={title}
      focusable="false"
      {...props}
    />
  )
}
