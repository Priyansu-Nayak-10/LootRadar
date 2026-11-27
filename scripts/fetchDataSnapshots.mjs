import { mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { collectNewsSnapshot } from './lib/news.mjs'
import { collectItadSnapshot } from './lib/itad.mjs'
import { freeGameMergeKey } from '../src/lib/freeGames.js'

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

async function main() {
  await mkdir(DATA_DIR, { recursive: true })

  const skipNews = process.argv.includes('--skip-news')
  const [itadRes, newsRes, freeGamesRes, alwaysFreeRes] = await Promise.allSettled([
    runItadSnapshot(),
    skipNews ? Promise.resolve({ articles: [] }) : runNewsSnapshot(),
    fetchJson('https://www.gamerpower.com/api/giveaways?type=game'),
    fetchJson('https://www.freetogame.com/api/games'),
  ])

  const itadSnapshot = itadRes.status === 'fulfilled' ? itadRes.value : { deals: [], free: [] }
  const newsSnapshot = newsRes.status === 'fulfilled' ? newsRes.value : { articles: [] }

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
    cleanFreeGames = freeGamesRes.value
      .filter((game) => game.status === 'Active')
      .map((game) => {
        const mergeKey = freeGameMergeKey(game.title)
        const matchedWorth = itadWorthMap.get(mergeKey) || null
        // Never store USD worth (e.g. "$4.99") as INR
        const worth = matchedWorth || (game.worth?.currency === 'INR' ? game.worth : null)

        return {
          id: game.id,
          title: game.title,
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
    cleanAlwaysFreeGames = alwaysFreeRes.value
      .slice(0, 120)
      .map((game) => ({
        id: game.id,
        title: game.title,
        description: game.short_description,
        genre: game.genre,
        platform: game.platform,
        publisher: game.publisher,
        developer: game.developer,
        releaseDate: game.release_date,
        thumbnail: game.thumbnail,
        gameUrl: game.game_url,
        profileUrl: game.freetogame_profile_url,
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
    `Saved ${cleanFreeGames.length} free games, ${cleanAlwaysFreeGames.length} always-free games, ${itadSnapshot.deals?.length || 0} ITAD deals, and ${newsSnapshot.articles.length} news stories`
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
