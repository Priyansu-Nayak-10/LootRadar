import { useState, useEffect } from 'react'
import { wishRadarArt } from '../assets/art'
import { getOriginalRawgUrl } from '../lib/rawgImage'

/**
 * SafeImage displays image candidates in specified priority order:
 * 1. Steam library_hero.jpg (if steamAppID is present)
 * 2. Steam header.jpg (if steamAppID is present)
 * 3. Source imageUrl / src (plus original RAWG URL once if src was resized)
 * 4. wishRadarArt.hero.src (only as last-resort image fallback)
 * 5. .lr-art-fallback text block
 */
export default function SafeImage({
  src,
  steamAppID,
  alt = '',
  className = '',
  loading = 'lazy',
  decoding = 'async',
  fetchPriority,
  width,
  height,
  fallbackText = 'WISHRADAR',
}) {
  const [candidateIndex, setCandidateIndex] = useState(0)

  // Build candidate image sources in priority order
  const candidates = []
  if (steamAppID && steamAppID !== '0' && steamAppID !== 'null') {
    candidates.push(`https://cdn.cloudflare.steamstatic.com/steam/apps/${steamAppID}/library_hero.jpg`)
    candidates.push(`https://cdn.cloudflare.steamstatic.com/steam/apps/${steamAppID}/header.jpg`)
  }
  if (src && typeof src === 'string' && src.trim()) {
    const trimmed = src.trim()
    candidates.push(trimmed)
    const originalRawg = getOriginalRawgUrl(trimmed)
    if (originalRawg && originalRawg !== trimmed) {
      candidates.push(originalRawg)
    }
  }
  if (wishRadarArt.hero?.src && typeof wishRadarArt.hero.src === 'string' && wishRadarArt.hero.src.trim()) {
    candidates.push(wishRadarArt.hero.src.trim())
  }

  // Reset index if steamAppID or src changes
  useEffect(() => {
    setCandidateIndex(0)
  }, [steamAppID, src])

  const currentSrc = candidates[candidateIndex]

  if (!currentSrc || candidateIndex >= candidates.length) {
    const initial = (fallbackText || 'L').trim().charAt(0).toUpperCase()
    return (
      <div className={`lr-art-fallback ${className}`} aria-hidden="true">
        {fallbackText || initial}
      </div>
    )
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      loading={loading}
      decoding={decoding}
      fetchPriority={fetchPriority}
      width={width}
      height={height}
      onError={() => setCandidateIndex((prev) => prev + 1)}
      className={className}
    />
  )
}
