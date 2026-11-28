// Verified against GET https://api.rawg.io/api/stores
export const RAWG_STORE_NAMES = {
  1: 'Steam',
  2: 'Xbox Store',
  3: 'PlayStation Store',
  4: 'App Store',
  5: 'GOG',
  6: 'Nintendo Store',
  7: 'Xbox 360 Store',
  8: 'Google Play',
  9: 'itch.io',
  11: 'Epic Games',
}

export const STORE_PRIORITY_ORDER = [
  'Steam',
  'Epic Games',
  'GOG',
  'PlayStation Store',
  'Xbox Store',
  'Nintendo Store',
]

export function canonicalStoreName(name = '') {
  const lower = String(name || '').trim().toLowerCase()
  if (!lower) return ''
  if (lower.includes('steam')) return 'Steam'
  if (lower.includes('epic')) return 'Epic Games'
  if (lower.includes('gog')) return 'GOG'
  if (lower.includes('playstation') || lower === 'ps store' || lower === 'psn') return 'PlayStation Store'
  if (lower.includes('xbox 360')) return 'Xbox 360 Store'
  if (lower.includes('xbox') || lower.includes('microsoft')) return 'Xbox Store'
  if (lower.includes('nintendo')) return 'Nintendo Store'
  if (lower.includes('itch')) return 'itch.io'
  if (lower.includes('app store')) return 'App Store'
  if (lower.includes('google play')) return 'Google Play'
  return String(name).trim()
}

export function normalizeRawgStore(entry) {
  if (!entry || typeof entry !== 'object') return null
  const storeId = entry.store_id ?? entry.store?.id ?? entry.storeId ?? entry.id ?? null
  const mappedName = storeId != null ? RAWG_STORE_NAMES[Number(storeId)] : null
  const rawName = entry.store?.name || entry.name || mappedName || 'Store'
  const name = canonicalStoreName(rawName) || 'Store'
  const url = typeof entry.url === 'string' && entry.url.trim() ? entry.url.trim() : null
  const key = storeId != null ? `id:${storeId}` : `name:${name.toLowerCase()}`
  return {
    storeId: storeId != null ? Number(storeId) : null,
    name,
    url,
    key,
  }
}

export function sortStoresByPriority(stores = [], preferredStoreName = null) {
  const preferredCanonical = canonicalStoreName(preferredStoreName)
  const rankOf = (store) => {
    const canon = canonicalStoreName(store?.name)
    if (preferredCanonical && canon === preferredCanonical) return -1
    const idx = STORE_PRIORITY_ORDER.indexOf(canon)
    return idx >= 0 ? idx : STORE_PRIORITY_ORDER.length
  }

  return [...stores].sort((a, b) => {
    const rA = rankOf(a)
    const rB = rankOf(b)
    if (rA !== rB) return rA - rB
    const hasUrlA = a?.url ? 0 : 1
    const hasUrlB = b?.url ? 0 : 1
    return hasUrlA - hasUrlB
  })
}
