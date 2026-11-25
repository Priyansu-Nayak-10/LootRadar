import {
  bestDeal,
  createItadClient,
  fetchPrices,
  resolveItadId,
} from '../scripts/lib/itad.mjs'

// Note for Netlify Functions:
// Replace `export default async function handler(req, res)` with
// `export async function handler(event)` parsing `JSON.parse(event.body || '{}')`
// and returning `{ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(...) }`.

const CACHE_TTL_MS = 30 * 60 * 1000
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000
const RATE_LIMIT_MAX = 30
const MAX_ITEMS_PER_REQUEST = 25

const responseCache = new Map()
const ipRateLimits = new Map()

function getClientIp(req) {
  const forwarded = req.headers?.['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim()
  }
  return req.socket?.remoteAddress || 'unknown'
}

function isRateLimited(ip) {
  const now = Date.now()
  const entry = ipRateLimits.get(ip)
  if (!entry || now - entry.start > RATE_LIMIT_WINDOW_MS) {
    ipRateLimits.set(ip, { start: now, count: 1 })
    return false
  }
  entry.count++
  return entry.count > RATE_LIMIT_MAX
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.ITAD_API_KEY
  if (!apiKey || !apiKey.trim()) {
    return res.status(503).json({
      error: 'ITAD_API_KEY is not configured on the server.',
    })
  }

  const ip = getClientIp(req)
  if (isRateLimited(ip)) {
    return res.status(429).json({
      error: 'Too many price lookup requests. Please try again in a few minutes.',
    })
  }

  let body = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' })
    }
  }

  const rawIds = Array.isArray(body?.ids)
    ? body.ids
    : typeof req.query?.ids === 'string'
      ? req.query.ids.split(',').filter(Boolean)
      : []

  const rawTitles = Array.isArray(body?.titles)
    ? body.titles
    : typeof req.query?.titles === 'string'
      ? req.query.titles.split(',').filter(Boolean)
      : []

  const items = [
    ...rawIds.map((id) => ({ id: String(id).trim(), title: null })),
    ...rawTitles.map((t) =>
      typeof t === 'string'
        ? { id: null, title: t.trim(), steamAppId: null }
        : {
            id: t?.itadId || null,
            title: String(t?.title || '').trim(),
            steamAppId: t?.steamAppId || null,
          }
    ),
  ]
    .filter((item) => item.id || item.title)
    .slice(0, MAX_ITEMS_PER_REQUEST)

  if (items.length === 0) {
    return res.status(200).json({ prices: {}, cachedAt: new Date().toISOString() })
  }

  const now = Date.now()
  const results = {}
  const toResolve = []
  const idsToFetch = []

  for (const item of items) {
    const cacheKey = item.id ? `id:${item.id}` : `title:${item.title.toLowerCase()}`
    const cached = responseCache.get(cacheKey)
    if (cached && now - cached.time < CACHE_TTL_MS) {
      results[item.id || item.title] = cached.value
    } else if (item.id) {
      idsToFetch.push({ key: item.id, itadId: item.id, cacheKey })
    } else {
      toResolve.push({ key: item.title, title: item.title, steamAppId: item.steamAppId, cacheKey })
    }
  }

  try {
    const client = createItadClient({ apiKey: apiKey.trim() })

    for (const entry of toResolve) {
      const resolvedId = await resolveItadId(client, entry.title, entry.steamAppId)
      if (resolvedId) {
        idsToFetch.push({ key: entry.key, itadId: resolvedId, cacheKey: entry.cacheKey })
      } else {
        const unresolvedVal = { itadId: null, deal: null }
        responseCache.set(entry.cacheKey, { time: now, value: unresolvedVal })
        results[entry.key] = unresolvedVal
      }
    }

    if (idsToFetch.length > 0) {
      const priceEntries = await fetchPrices(
        client,
        idsToFetch.map((x) => x.itadId)
      )
      const byId = new Map(priceEntries.map((p) => [p.id, p]))

      for (const reqItem of idsToFetch) {
        const rawEntry = byId.get(reqItem.itadId)
        const normalized = rawEntry ? bestDeal(rawEntry) : null
        const payload = { itadId: reqItem.itadId, deal: normalized }
        responseCache.set(reqItem.cacheKey, { time: now, value: payload })
        results[reqItem.key] = payload
      }
    }

    return res.status(200).json({
      prices: results,
      cachedAt: new Date(now).toISOString(),
    })
  } catch (error) {
    return res.status(502).json({
      error: error?.message || 'Could not fetch live ITAD prices.',
    })
  }
}
