import { mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { collectNewsSnapshot } from './lib/news.mjs'
import {
  bestDeal,
  collectItadSnapshot,
  createItadClient,
  fetchPrices,
  resolveItadId,
} from './lib/itad.mjs'
import { cleanTitle, freeGameMergeKey, isMobile, normalizeStore, parseWorthUsd } from '../src/lib/freeGames.js'

const USER_AGENT = 'WishRadar/1.0 (free portfolio project)'
const DATA_DIR = new URL('../public/data/', import.meta.url)

async function fetchJson(url) {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!response.ok) throw new Error(`Request failed (${response.status}) for ${url}`)
  return response.json()
}

async function saveJson(filename, value, targetDir = DATA_DIR) {
  await writeFile(
    new URL(filename, targetDir),
    `${JSON.stringify(value, null, 2)}\n`,
    'utf8'
  )
}

export async function runNewsSnapshot({ outDir = DATA_DIR } = {}) {
  await mkdir(outDir, { recursive: true })
  const snapshot = await collectNewsSnapshot()

  if (snapshot.failedSources.length > 0) {
    for (const failed of snapshot.failedSources) {
      console.warn(`News feed failed (${failed.source}): ${failed.reason}`)
    }
  }

  if (snapshot.articles.length === 0) {
    console.warn('All news sources failed or returned 0 valid articles. Keeping previous gaming-news.json untouched.')
    return snapshot
  }

  await saveJson(
    'gaming-news.json',
    {
      generatedAt: snapshot.generatedAt,
      sources: snapshot.sources,
      articles: snapshot.articles,
    },
    outDir
  )

  return snapshot
}

export async function runItadSnapshot({ outDir = DATA_DIR } = {}) {
  await mkdir(outDir, { recursive: true })
  if (!process.env.ITAD_API_KEY || !process.env.ITAD_API_KEY.trim()) {
    console.warn('ITAD_API_KEY is missing. Keeping previous itad-deals.json untouched.')
    return { deals: [], free: [], skipped: true }
  }

  try {
    const snapshot = await collectItadSnapshot()
    if (!Array.isArray(snapshot.deals) || snapshot.deals.length === 0) {
      console.warn('ITAD returned 0 deals. Keeping previous itad-deals.json untouched.')
      return snapshot
    }

    await saveJson(
      'itad-deals.json',
      {
        generatedAt: snapshot.generatedAt,
        country: snapshot.country,
        currency: snapshot.currency,
        shops: snapshot.shops,
        deals: snapshot.deals,
        free: snapshot.free,
      },
      outDir
    )

    return snapshot
  } catch (error) {
    console.warn('ITAD snapshot failed:', error?.message || 'unknown error')
    return { deals: [], free: [], failed: true }
  }
}

export async function runFxSnapshot({ outDir = DATA_DIR } = {}) {
  await mkdir(outDir, { recursive: true })
  try {
    const data = await fetchJson('https://api.frankfurter.dev/v1/latest?base=USD&symbols=INR')
    const inr = Number(data?.rates?.INR)
    if (!Number.isFinite(inr) || inr <= 0) {
      throw new Error('Invalid INR rate in Frankfurter response')
    }
    const payload = {
      base: 'USD',
      rates: { INR: inr },
      updatedAt: data?.date || new Date().toISOString().slice(0, 10),
      source: 'Frankfurter (ECB)',
    }
    await saveJson('fx-rates.json', payload, outDir)
    return payload
  } catch (error) {
    console.warn('FX snapshot failed (keeping previous fx-rates.json):', error?.message || 'unknown error')
    return null
  }
}

async function enrichGamerPowerWorthWithItad(activeGames, itadWorthMap) {
  const apiKey = process.env.ITAD_API_KEY?.trim()
  if (!apiKey) return

  const candidates = []
  const seenKeys = new Set()
  for (const game of activeGames) {
    if (isMobile(game)) continue
    if (String(game.type || 'Game').toLowerCase() !== 'game') continue
    const cleaned = cleanTitle(game.title)
    const mergeKey = freeGameMergeKey(cleaned)
    if (!mergeKey || itadWorthMap.has(mergeKey) || seenKeys.has(mergeKey)) continue
    seenKeys.add(mergeKey)
    candidates.push({ title: cleaned, mergeKey })
  }

  if (candidates.length === 0) return

  try {
    const client = createItadClient({ apiKey, maxRequests: 40, delayMs: 150 })
    const resolved = []
    for (const item of candidates.slice(0, 25)) {
      const itadId = await resolveItadId(client, item.title)
      if (itadId) resolved.push({ ...item, itadId })
    }
    if (resolved.length === 0) return

    const priceEntries = await fetchPrices(client, resolved.map((r) => r.itadId))
    const byId = new Map(priceEntries.map((p) => [p.id, p]))
    for (const item of resolved) {
      const entry = byId.get(item.itadId)
      const deal = entry ? bestDeal(entry) : null
      const regular = Number(deal?.regular || entry?.deals?.[0]?.regular?.amount || 0)
      if (regular > 0) {
        itadWorthMap.set(item.mergeKey, {
          amount: regular,
          currency: 'INR',
          source: deal?.shop || 'ITAD',
        })
      }
    }
  } catch (error) {
    console.warn('ITAD worth enrichment warning:', error?.message || 'unknown error')
  }
}

async function main() {
  await mkdir(DATA_DIR, { recursive: true })

  const skipNews = process.argv.includes('--skip-news')
  const [itadRes, newsRes, fxRes, freeGamesRes, alwaysFreeRes] = await Promise.allSettled([
    runItadSnapshot(),
    skipNews ? Promise.resolve({ articles: [] }) : runNewsSnapshot(),
    runFxSnapshot(),
    fetchJson('https://www.gamerpower.com/api/giveaways'),
    fetchJson('https://www.freetogame.com/api/games'),
  ])

  const itadSnapshot = itadRes.status === 'fulfilled' ? itadRes.value : { deals: [], free: [] }
  const newsSnapshot = newsRes.status === 'fulfilled' ? newsRes.value : { articles: [] }
  const fxSnapshot = fxRes.status === 'fulfilled' ? fxRes.value : null

  // Build lookup map for ITAD INR worth
  const itadWorthMap = new Map()
  for (const item of [...(itadSnapshot.free || []), ...(itadSnapshot.deals || [])]) {
    if (item?.title && item.regular > 0) {
      const key = freeGameMergeKey(item.title)
      if (key && !itadWorthMap.has(key)) {
        itadWorthMap.set(key, {
          amount: item.regular,
          currency: 'INR',
          source: item.shop?.name || 'ITAD',
        })
      }
    }
  }

  let cleanFreeGames = []
  if (freeGamesRes.status === 'fulfilled' && Array.isArray(freeGamesRes.value)) {
    const activeGp = freeGamesRes.value.filter((game) => game.status === 'Active')
    await enrichGamerPowerWorthWithItad(activeGp, itadWorthMap)

    cleanFreeGames = activeGp.map((game) => {
      const mergeKey = freeGameMergeKey(cleanTitle(game.title))
      const matchedWorth = itadWorthMap.get(mergeKey) || null
      const worth = matchedWorth || (parseWorthUsd(game.worth) > 0 ? game.worth : null)

      return {
        id: game.id,
        title: game.title,
        type: game.type || 'Game',
        store: normalizeStore(game),
        platforms: game.platforms,
        thumbnail: game.thumbnail,
        worth,
        end_date: game.end_date,
        open_giveaway_url: game.open_giveaway_url,
        gamerpower_url: game.gamerpower_url,
      }
    })

    await saveJson('gamerpower-free-games.json', {
      generatedAt: new Date().toISOString(),
      source: 'GamerPower',
      sourceUrl: 'https://www.gamerpower.com',
      games: cleanFreeGames,
    })
  } else {
    console.warn('GamerPower fetch failed or returned non-array:', freeGamesRes.reason?.message || 'unknown error')
  }

  let cleanAlwaysFreeGames = []
  if (alwaysFreeRes.status === 'fulfilled' && Array.isArray(alwaysFreeRes.value)) {
    cleanAlwaysFreeGames = alwaysFreeRes.value.map((game) => ({
      id: game.id,
      title: game.title,
      thumbnail: game.thumbnail,
      genre: game.genre,
      platform: game.platform,
      publisher: game.publisher,
      game_url: game.game_url,
      short_description: String(game.short_description || '').trim().slice(0, 140),
    }))

    await saveJson('always-free-games.json', {
      generatedAt: new Date().toISOString(),
      source: 'FreeToGame',
      sourceUrl: 'https://www.freetogame.com',
      games: cleanAlwaysFreeGames,
    })
  } else {
    console.warn('FreeToGame fetch failed:', alwaysFreeRes.reason?.message || 'unknown error')
  }

  console.log(
    `Saved ${cleanFreeGames.length} free giveaways, ${cleanAlwaysFreeGames.length} always-free games, ${itadSnapshot.deals?.length || 0} ITAD deals, FX=${fxSnapshot?.rates?.INR || 'kept'}, and ${newsSnapshot.articles.length} news stories`
  )
}

const args = process.argv.slice(2)
const newsOnly = args.includes('--news-only')
const itadOnly = args.includes('--itad-only')
const outIdx = args.indexOf('--out')
const outArg = outIdx >= 0 ? args[outIdx + 1] : null
const resolvedOutDir = outArg
  ? pathToFileURL(outArg.endsWith('/') || outArg.endsWith('\\') ? outArg : `${outArg}/`)
  : DATA_DIR

if (itadOnly) {
  runItadSnapshot({ outDir: resolvedOutDir })
    .then((snapshot) => {
      if (snapshot.skipped || snapshot.failed) return
      console.log(
        `ITAD snapshot: ${snapshot.deals.length} deals, ${snapshot.free.length} free | Requests used: ${snapshot.stats?.requestsUsed ?? 0}`
      )
      if (snapshot.stats?.perShopCounts) {
        console.log('Per-shop raw counts:', snapshot.stats.perShopCounts)
      }
      if (snapshot.stats?.emptyShops?.length) {
        console.warn('Shops with no deals:', snapshot.stats.emptyShops.join(', '))
      }
      console.table(
        snapshot.deals.slice(0, 15).map((d) => ({
          title: d.title.slice(0, 42),
          shop: d.shop?.name,
          priceINR: d.price,
          regular: d.regular,
          cut: `-${d.cut}%`,
          historyLow: d.historyLow,
          expiry: d.expiry || '-',
          type: d.type,
        }))
      )
    })
    .catch((error) => {
      console.warn('ITAD-only snapshot warning:', error.message)
    })
} else if (newsOnly) {
  runNewsSnapshot({ outDir: resolvedOutDir })
    .then((snapshot) => {
      console.log(
        `News-only snapshot: ${snapshot.articles.length} stories from ${snapshot.sources.length} sources (${snapshot.failedSources.length} failed)`
      )
    })
    .catch((error) => {
      console.warn('News-only snapshot warning:', error.message)
    })
} else {
  main().catch((error) => {
    console.error(error.message)
    process.exit(1)
  })
}
