import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeDeal,
  processItadDeals,
  collectItadSnapshot,
  createItadClient,
  extractSteamAppId,
  resolveItadId,
  strictMatchScore,
  fetchPrices,
  bestDeal,
  shouldAlert,
} from '../../../scripts/lib/itad.mjs'

const FIXTURE_DEALS = [
  {
    id: 'itad-1',
    slug: 'elden-ring',
    title: 'ELDEN RING',
    type: 'game',
    assets: {
      banner600: 'https://assets.isthereanydeal.com/018d937f/banner600.jpg',
      banner400: 'https://assets.isthereanydeal.com/018d937f/banner400.jpg',
      boxart: 'https://assets.isthereanydeal.com/018d937f/boxart.jpg',
    },
    deal: {
      shop: { id: 61, name: 'Steam' },
      price: { amount: 1799, currency: 'INR' },
      regular: { amount: 3599, currency: 'INR' },
      cut: 50,
      historyLow: { amount: 1799, currency: 'INR' },
      historyLow_1y: { amount: 1799, currency: 'INR' },
      historyLow_3m: { amount: 2159, currency: 'INR' },
      flag: 'H',
      platforms: [{ id: 1, name: 'Windows' }],
      expiry: '2026-12-01T18:00:00+00:00',
      url: 'https://isthereanydeal.com/deals/elden-ring-steam',
    },
  },
  {
    id: 'itad-1',
    slug: 'elden-ring',
    title: 'ELDEN RING',
    type: 'game',
    assets: {
      banner400: 'https://assets.isthereanydeal.com/018d937f/banner400.jpg',
    },
    deal: {
      shop: { id: 16, name: 'Epic Game Store' },
      price: { amount: 1999, currency: 'INR' },
      regular: { amount: 3599, currency: 'INR' },
      cut: 44,
      historyLow: { amount: 1799, currency: 'INR' },
      flag: null,
      platforms: [],
      expiry: null,
      url: 'https://isthereanydeal.com/deals/elden-ring-epic',
    },
  },
  {
    id: 'itad-dlc',
    slug: 'elden-ring-costume-pack',
    title: 'ELDEN RING Costume Pack',
    type: 'dlc',
    assets: {},
    deal: {
      shop: { id: 61, name: 'Steam' },
      price: { amount: 99, currency: 'INR' },
      regular: { amount: 499, currency: 'INR' },
      cut: 80,
      historyLow: { amount: 99, currency: 'INR' },
      flag: 'N',
      url: 'https://isthereanydeal.com/deals/dlc',
    },
  },
  {
    id: 'itad-low-cut',
    slug: 'small-discount',
    title: 'Small Discount Game',
    type: 'game',
    assets: {},
    deal: {
      shop: { id: 52, name: 'EA Store' },
      price: { amount: 850, currency: 'INR' },
      regular: { amount: 1000, currency: 'INR' },
      cut: 15,
      historyLow: { amount: 500, currency: 'INR' },
      flag: null,
      url: 'https://isthereanydeal.com/deals/small',
    },
  },
  {
    id: 'itad-free',
    slug: 'free-game-in',
    title: 'Free Game India',
    type: 'game',
    assets: { boxart: 'https://assets.isthereanydeal.com/free/boxart.jpg' },
    deal: {
      shop: { id: 16, name: 'Epic Game Store' },
      price: { amount: 0, currency: 'INR' },
      regular: { amount: 1499, currency: 'INR' },
      cut: 100,
      historyLow: { amount: 0, currency: 'INR' },
      flag: 'N',
      expiry: '2026-11-30T16:00:00Z',
      url: 'https://isthereanydeal.com/deals/free-game',
    },
  },
]

test('normalizeDeal sets isLowestEver, isNewLow, expiry, and image priority', () => {
  const normalized = normalizeDeal(FIXTURE_DEALS[0], {
    fetchedAt: '2026-11-25T10:00:00.000Z',
    steamAppId: '1245620',
  })

  assert.equal(normalized.itadId, 'itad-1')
  assert.equal(normalized.image, 'https://assets.isthereanydeal.com/018d937f/banner600.jpg')
  assert.equal(normalized.price, 1799)
  assert.equal(normalized.currency, 'INR')
  assert.equal(normalized.isLowestEver, true)
  assert.equal(normalized.isNewLow, true)
  assert.equal(normalized.expiry, '2026-12-01T18:00:00.000Z')
  assert.equal(normalized.steamAppId, '1245620')

  const notLow = normalizeDeal(FIXTURE_DEALS[1])
  assert.equal(notLow.isLowestEver, false)
  assert.equal(notLow.isNewLow, false)
  assert.equal(notLow.expiry, null)
  assert.equal(notLow.image, 'https://assets.isthereanydeal.com/018d937f/banner400.jpg')
})

test('processItadDeals filters type=game, cut>=20, dedupes by itadId keeping best price, and separates free games', () => {
  const { deals, free } = processItadDeals(FIXTURE_DEALS, {
    fetchedAt: '2026-11-25T10:00:00.000Z',
  })

  assert.equal(deals.length, 1)
  assert.equal(deals[0].itadId, 'itad-1')
  assert.equal(deals[0].shop.name, 'Steam')
  assert.equal(deals[0].price, 1799)

  assert.equal(free.length, 1)
  assert.equal(free[0].itadId, 'itad-free')
  assert.equal(free[0].price, 0)
  assert.equal(free[0].expiry, '2026-11-30T16:00:00.000Z')
})

test('createItadClient retries on 429 using Retry-After, enforces budget cap, and never leaks API key', async () => {
  const secretKey = 'super-secret-itad-key-999'
  let calls = 0
  const waits = []

  const mockedFetch = async () => {
    calls++
    if (calls === 1) {
      return {
        ok: false,
        status: 429,
        headers: { get: (name) => (name === 'Retry-After' ? '1' : null) },
      }
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ list: [FIXTURE_DEALS[0]] }),
    }
  }

  const client = createItadClient({
    apiKey: secretKey,
    fetchImpl: mockedFetch,
    sleep: async (ms) => waits.push(ms),
    delayMs: 0,
    maxRequests: 3,
  })

  const data = await client.fetchDeals({ shopId: 61 })
  assert.equal(calls, 2)
  assert.ok(waits.includes(1000))
  assert.equal(data.list.length, 1)

  // 3rd request hits budget cap of 3? calls=2 used 2 of 3; 3rd succeeds, 4th rejects
  await client.fetchDeals({ shopId: 16 })
  await assert.rejects(
    () => client.fetchDeals({ shopId: 52 }),
    (err) => err.message.includes('budget exceeded')
  )

  const failingClient = createItadClient({
    apiKey: secretKey,
    fetchImpl: async () => {
      throw new Error(`Failed with key=${secretKey}`)
    },
    sleep: async () => {},
    delayMs: 0,
  })

  await assert.rejects(
    () => failingClient.fetchDeals({ shopId: 61 }),
    (err) => !err.message.includes(secretKey) && err.message.includes('[REDACTED]')
  )
})

test('resolveItadId enforces strict Deluxe vs base edition matching', async () => {
  assert.equal(strictMatchScore('Elden Ring', 'ELDEN RING Deluxe Edition'), 0)
  assert.equal(strictMatchScore('Elden Ring Deluxe Edition', 'ELDEN RING'), 0)
  assert.equal(strictMatchScore('Elden Ring', 'ELDEN RING'), 3)

  const client = createItadClient({
    apiKey: 'test-key',
    sleep: async () => {},
    delayMs: 0,
    fetchImpl: async (url) => {
      if (url.includes('/games/lookup/v1')) {
        return { ok: true, status: 200, json: async () => ({ found: false }) }
      }
      if (url.includes('/games/search/v1')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            { id: 'id-deluxe', title: 'Cyberpunk 2077: Deluxe Edition', type: 'game' },
            { id: 'id-dlc', title: 'Cyberpunk 2077: Phantom Liberty', type: 'dlc' },
          ],
        }
      }
      return { ok: false, status: 404 }
    },
  })

  // Searching base "Cyberpunk 2077" must NOT resolve to Deluxe Edition
  const resolved = await resolveItadId(client, 'Cyberpunk 2077')
  assert.equal(resolved, null)
})

test('fetchPrices batches up to 200 IDs and bestDeal picks lowest INR across allowlisted shops', async () => {
  const batches = []
  const client = createItadClient({
    apiKey: 'test-key',
    sleep: async () => {},
    delayMs: 0,
    fetchImpl: async (_url, opts) => {
      const body = JSON.parse(opts.body)
      batches.push(body.length)
      return {
        ok: true,
        status: 200,
        json: async () => [
          {
            id: 'id-1',
            historyLow: { all: { amount: 1500, currency: 'INR' } },
            deals: [
              { shop: { id: 99, name: 'KeyReseller' }, price: { amount: 900 }, regular: { amount: 3000 }, cut: 70 },
              { shop: { id: 16, name: 'Epic Game Store' }, price: { amount: 1800 }, regular: { amount: 3000 }, cut: 40 },
              { shop: { id: 61, name: 'Steam' }, price: { amount: 1500 }, regular: { amount: 3000 }, cut: 50, url: 'https://itad/steam' },
            ],
          },
        ],
      }
    },
  })

  const ids = Array.from({ length: 205 }, (_, i) => `id-${i + 1}`)
  const prices = await fetchPrices(client, ids)
  assert.deepEqual(batches, [200, 5])

  const best = bestDeal(prices[0])
  assert.equal(best.store, 'Steam')
  assert.equal(best.price, 1500)
  assert.equal(best.historyLow, 1500)
  assert.equal(best.isLowestEver, true)
})

test('shouldAlert evaluates free, good, any, great, and unknown-history fallback', () => {
  assert.equal(shouldAlert({ price: 0, cut: 100, sensitivity: 'great' }), true)
  assert.equal(shouldAlert({ price: 900, cut: 10, historyLow: 900, sensitivity: 'any' }), false)

  // good: cut >= 25 AND price <= historyLow * 1.10
  assert.equal(shouldAlert({ price: 1100, cut: 30, historyLow: 1000, sensitivity: 'good' }), true)
  assert.equal(shouldAlert({ price: 1300, cut: 30, historyLow: 1000, sensitivity: 'good' }), false)
  // good fallback when historyLow unknown: cut >= 40
  assert.equal(shouldAlert({ price: 1300, cut: 35, historyLow: null, sensitivity: 'good' }), false)
  assert.equal(shouldAlert({ price: 1200, cut: 40, historyLow: null, sensitivity: 'good' }), true)

  // any: cut >= 25
  assert.equal(shouldAlert({ price: 1500, cut: 25, historyLow: 500, sensitivity: 'any' }), true)

  // great: cut >= 50 OR price <= historyLow
  assert.equal(shouldAlert({ price: 1500, cut: 45, historyLow: 1000, sensitivity: 'great' }), false)
  assert.equal(shouldAlert({ price: 1000, cut: 30, historyLow: 1000, sensitivity: 'great' }), true)
  assert.equal(shouldAlert({ price: 1500, cut: 50, historyLow: 1000, sensitivity: 'great' }), true)
})

test('collectItadSnapshot merges across shops, maps Steam appIds, and returns empty safely on failure', async () => {
  const mockedFetch = async (url) => {
    if (url.includes('shops=61')) {
      return { ok: true, status: 200, json: async () => ({ list: [FIXTURE_DEALS[0]] }) }
    }
    if (url.includes('shops=16')) {
      return { ok: true, status: 200, json: async () => ({ list: [FIXTURE_DEALS[4]] }) }
    }
    if (url.includes('shops=52')) {
      return { ok: true, status: 200, json: async () => ({ list: [] }) }
    }
    if (url.includes('/lookup/shop/61/id/v1')) {
      return { ok: true, status: 200, json: async () => ({ 'itad-1': ['app/1245620'] }) }
    }
    return { ok: false, status: 404 }
  }

  const snapshot = await collectItadSnapshot({
    apiKey: 'test-key',
    fetchImpl: mockedFetch,
    sleep: async () => {},
  })

  assert.equal(snapshot.deals.length, 1)
  assert.equal(snapshot.deals[0].steamAppId, '1245620')
  assert.equal(snapshot.free.length, 1)
  assert.deepEqual(snapshot.stats.emptyShops, ['EA Store'])

  const failedSnapshot = await collectItadSnapshot({
    apiKey: 'test-key',
    fetchImpl: async () => {
      throw new Error('Network down')
    },
    sleep: async () => {},
  })
  assert.equal(failedSnapshot.deals.length, 0)
  assert.equal(extractSteamAppId(['app/570']), '570')
})
