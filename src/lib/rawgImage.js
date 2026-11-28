const RESIZE_PREFIX_RE = /^\/media\/resize\/\d+\/-\//

/**
 * Rewrites media.rawg.io/media/... URLs to /media/resize/<width>/-/...
 * Leaves already-resized, cropped, non-RAWG, or invalid URLs untouched.
 */
export function rawgImage(url, width) {
  if (!url || typeof url !== 'string') return url
  const trimmed = url.trim()
  if (!trimmed || !Number.isFinite(Number(width)) || Number(width) <= 0) return url

  try {
    const parsed = new URL(trimmed)
    if (parsed.hostname !== 'media.rawg.io') return url
    if (!parsed.pathname.startsWith('/media/')) return url
    if (parsed.pathname.startsWith('/media/resize/') || parsed.pathname.startsWith('/media/crop/')) {
      return url
    }
    parsed.pathname = `/media/resize/${Math.round(Number(width))}/-/${parsed.pathname.slice('/media/'.length)}`
    return parsed.toString()
  } catch {
    return url
  }
}

/**
 * If url is a media.rawg.io /media/resize/<w>/-/... URL, returns the original /media/... URL;
 * otherwise returns null.
 */
export function getOriginalRawgUrl(url) {
  if (!url || typeof url !== 'string') return null
  try {
    const parsed = new URL(url.trim())
    if (parsed.hostname !== 'media.rawg.io') return null
    if (!RESIZE_PREFIX_RE.test(parsed.pathname)) return null
    parsed.pathname = parsed.pathname.replace(RESIZE_PREFIX_RE, '/media/')
    return parsed.toString()
  } catch {
    return null
  }
}
