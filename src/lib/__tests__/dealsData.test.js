import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatDealPrice,
  formatDealExpiry,
  formatDealTitle,
  isDealActive,
  matchDealForGame,
  parseDealsParams,
  serializeDealsParams,
  filterAndSortDeals,
  getDealsErrorMessage,
  fetchDealsData,
  MAX_PRICE_CAP,
} from '../dealsData.js'

describe('dealsData helpers and logic (ITAD INR)', () => {
  describe('formatDealPrice', () => {
    it('returns Free for 0', () => {
      assert.equal(formatDealPrice(0), 'Free')
      assert.equal(formatDealPrice('0'), 'Free')
    })

    it('formats whole INR numbers with Indian grouping and keeps paise when present', () => {
      assert.equal(formatDealPrice(3499), '₹3,499')
      assert.equal(formatDealPrice(174.95), '₹174.95')
      assert.equal(formatDealPrice(125000), '₹1,25,000')
    })

    it('handles invalid inputs gracefully', () => {
      assert.equal(formatDealPrice(null), '-')
      assert.equal(formatDealPrice('invalid'), '-')
    })
  })

  describe('formatDealExpiry', () => {
    it('formats relative countdown under 72 hours and local date beyond 72 hours', () => {
      const now = Date.parse('2026-11-25T10:00:00Z')
      const in2d4h = new Date(now + (2 * 24 + 4) * 3600000).toISOString()
      assert.equal(formatDealExpiry(in2d4h, now), 'Ends in 2d 4h')

      const in5h = new Date(now + 5 * 3600000).toISOString()
      assert.equal(formatDealExpiry(in5h, now), 'Ends in 5h')

      const in5d = new Date(now + 5 * 24 * 3600000).toISOString()
      const longLabel = formatDealExpiry(in5d, now)
      assert.ok(longLabel && longLabel.startsWith('Ends '))
      assert.ok(!longLabel.includes('Ends in'))

      assert.equal(formatDealExpiry(new Date(now - 1000).toISOString(), now), 'Ended')
      assert.equal(formatDealExpiry(null, now), null)
    })
  })

  describe('formatDealTitle', () => {
    it('strips non-Latin/Arabic subtitle and keeps English title', () => {
      assert.equal(formatDealTitle('Umm Oyoun - ام عيون'), 'Umm Oyoun')
    })

    it('keeps standard English and alphanumeric titles unchanged', () => {
      assert.equal(formatDealTitle('The Witcher 3: Wild Hunt'), 'The Witcher 3: Wild Hunt')
      assert.equal(formatDealTitle('Cyberpunk 2077'), 'Cyberpunk 2077')
      assert.equal(formatDealTitle('Amazing Adventures: The Lost Tomb'), 'Amazing Adventures: The Lost Tomb')
    })

    it('handles empty or non-string titles gracefully', () => {
      assert.equal(formatDealTitle(''), '')
      assert.equal(formatDealTitle(null), '')
      assert.equal(formatDealTitle(undefined), '')
    })
  })

  describe('isDealActive', () => {
    const now = Date.parse('2026-11-27T10:00:00Z')

    it('returns false for deals with past end dates', () => {
      assert.equal(
        isDealActive({ expiry: '2026-11-26T16:00:00.000Z' }, now),
        false
      )
      assert.equal(
        isDealActive({ expiry: new Date(now - 1000).toISOString() }, now),
        false
      )
    })

    it('returns true for deals with future end dates', () => {
      assert.equal(
        isDealActive({ expiry: '2026-11-30T16:00:00.000Z' }, now),
        true
      )
      assert.equal(
        isDealActive({ expiry: new Date(now + 3600000).toISOString() }, now),
        true
      )
    })

    it('returns true for deals with no end date (open-ended)', () => {
      assert.equal(isDealActive({ expiry: null }, now), true)
      assert.equal(isDealActive({ expiry: undefined }, now), true)
      assert.equal(isDealActive({ title: 'Game Without Expiry' }, now), true)
    })

    it('handles invalid inputs gracefully', () => {
      assert.equal(isDealActive(null, now), false)
      assert.equal(isDealActive(undefined, now), false)
      assert.equal(isDealActive('not-a-deal', now), false)
      assert.equal(isDealActive({ expiry: 'invalid-date' }, now), true)
    })
  })

  describe('matchDealForGame (edition-safe title & steamAppId matching)', () => {
    const deals = [
      { itadId: '1', title: 'ELDEN RING', price: 1799, cut: 50, steamAppId: '1245620' },
      { itadId: '2', title: 'Cyberpunk 2077: Deluxe Edition', price: 1499, cut: 50, steamAppId: null },
      { itadId: '3', title: 'The Witcher 3: Wild Hunt', price: 299, cut: 80, steamAppId: '292030' },
    ]

    it('matches by normalized title stripping punctuation', () => {
      const matched = matchDealForGame({ name: 'The Witcher 3 Wild Hunt' }, deals)
      assert.equal(matched?.itadId, '3')
    })

    it('does NOT cross-match Deluxe edition with base game', () => {
      const baseQuery = matchDealForGame({ name: 'Cyberpunk 2077' }, deals)
      assert.equal(baseQuery, null)

      const deluxeQuery = matchDealForGame({ name: 'Cyberpunk 2077 Deluxe Edition' }, deals)
      assert.equal(deluxeQuery?.itadId, '2')
    })

    it('matches by steamAppId when both sides have it', () => {
      const matched = matchDealForGame(
        { name: 'Elden Ring (JP)', steamAppId: '1245620' },
        deals
      )
      assert.equal(matched?.itadId, '1')
    })
  })

  describe('URL params parsing and serialization', () => {
    it('parses URL query params into state object', () => {
      const search = '?store=steam&min=50&sort=price&q=witcher&lowest=1&maxPrice=2000'
      const parsed = parseDealsParams(search)

      assert.equal(parsed.store, '61')
      assert.equal(parsed.minDiscount, '50')
      assert.equal(parsed.sort, 'price')
      assert.equal(parsed.q, 'witcher')
      assert.equal(parsed.lowestOnly, true)
      assert.equal(parsed.maxPrice, 2000)
    })

    it('serializes state back to URL query string', () => {
      const state = {
        store: '16',
        minDiscount: '50',
        sort: 'expiry',
        q: 'witcher',
        lowestOnly: true,
        maxPrice: 2500,
      }
      const query = serializeDealsParams(state)
      assert.match(query, /store=epic/)
      assert.match(query, /min=50/)
      assert.match(query, /sort=expiry/)
      assert.match(query, /q=witcher/)
      assert.match(query, /lowest=1/)
      assert.match(query, /maxPrice=2500/)
    })

    it('returns empty string for default state', () => {
      const state = {
        store: '',
        minDiscount: '0',
        sort: 'deals',
        q: '',
        lowestOnly: false,
        maxPrice: MAX_PRICE_CAP,
      }
      assert.equal(serializeDealsParams(state), '')
    })
  })

  describe('filterAndSortDeals', () => {
    const testNow = Date.parse('2026-11-27T10:00:00Z')
    const sampleDeals = [
      {
        itadId: 'd1',
        title: 'Hades',
        shop: { id: 61, name: 'Steam' },
        price: 440,
        cut: 60,
        isLowestEver: true,
        expiry: '2026-12-05T10:00:00Z',
      },
      {
        itadId: 'd2',
        title: 'Dead Cells',
        shop: { id: 16, name: 'Epic Game Store' },
        price: 399,
        cut: 50,
        isLowestEver: false,
        expiry: '2026-12-01T10:00:00Z',
      },
      {
        itadId: 'd3',
        title: 'EA Sports FC',
        shop: { id: 52, name: 'EA Store' },
        price: 1999,
        cut: 75,
        isLowestEver: true,
        expiry: null,
      },
      {
        itadId: 'd-expired',
        title: 'Together After Dark (Expired)',
        shop: { id: 61, name: 'Steam' },
        price: 199,
        cut: 80,
        isLowestEver: true,
        expiry: '2026-11-26T16:00:00.000Z',
      },
    ]

    it('filters by store, minDiscount, maxPrice, lowestOnly, and query, while dropping expired deals', () => {
      assert.equal(filterAndSortDeals(sampleDeals, { store: '61' }, testNow).length, 1) // only Hades, not expired
      assert.equal(filterAndSortDeals(sampleDeals, { minDiscount: '75' }, testNow).length, 1)
      assert.equal(filterAndSortDeals(sampleDeals, { maxPrice: 500 }, testNow).length, 2)
      assert.equal(filterAndSortDeals(sampleDeals, { lowestOnly: true }, testNow).length, 2)
      assert.equal(filterAndSortDeals(sampleDeals, { q: 'hades' }, testNow).length, 1)
      // Verify expired deal is dropped
      assert.equal(filterAndSortDeals(sampleDeals, { q: 'Together After Dark' }, testNow).length, 0)
    })

    it('sorts by savings, price, and expiry ascending', () => {
      const bySavings = filterAndSortDeals(sampleDeals, { sort: 'savings' }, testNow)
      assert.equal(bySavings[0].itadId, 'd3')

      const byPrice = filterAndSortDeals(sampleDeals, { sort: 'price' }, testNow)
      assert.equal(byPrice[0].itadId, 'd2')

      const byExpiry = filterAndSortDeals(sampleDeals, { sort: 'expiry' }, testNow)
      assert.equal(byExpiry[0].itadId, 'd2')
      assert.equal(byExpiry[1].itadId, 'd1')
      assert.equal(byExpiry[2].itadId, 'd3')
    })
  })

  describe('getDealsErrorMessage and fetchDealsData error differentiation', () => {
    it('returns differentiated user-friendly messages per errorType', () => {
      assert.equal(
        getDealsErrorMessage('not_found'),
        'No deals data file found. Snapshot will be generated soon.'
      )
      assert.equal(
        getDealsErrorMessage('network_error'),
        'Network error loading deals. Check your connection and try again.'
      )
      assert.equal(
        getDealsErrorMessage('invalid_data'),
        'Deals data is empty or invalid. Please try again later.'
      )
      assert.equal(
        getDealsErrorMessage('unknown'),
        'Could not load deals. Check your connection and try again.'
      )
    })

    it('rejects with NOT_FOUND on 404 or HTML index fallback', async () => {
      const origFetch = globalThis.fetch
      try {
        globalThis.fetch = async () => ({
          status: 404,
          ok: false,
          headers: new Headers({ 'content-type': 'text/plain' }),
        })
        await assert.rejects(
          async () => fetchDealsData(true),
          (err) => err.message.startsWith('NOT_FOUND')
        )

        globalThis.fetch = async () => ({
          status: 200,
          ok: true,
          headers: new Headers({ 'content-type': 'text/html' }),
          text: async () => '<!doctype html>',
        })
        await assert.rejects(
          async () => fetchDealsData(true),
          (err) => err.message.startsWith('NOT_FOUND')
        )
      } finally {
        globalThis.fetch = origFetch
      }
    })

    it('skips malformed items and keeps valid items', async () => {
      const origFetch = globalThis.fetch
      try {
        globalThis.fetch = async () => ({
          status: 200,
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            generatedAt: '2026-11-25T12:00:00Z',
            deals: [
              { itadId: 'g1', title: 'Game 1', price: 999, cut: 50 },
              { itadId: null, title: 'Corrupt' },
              { itadId: 'g2', title: 'Game 2', price: 'invalid' },
              { itadId: 'g3', title: 'Game 3', price: 499, cut: 70 },
            ],
            free: [],
            shops: [{ id: 61, name: 'Steam' }],
          }),
        })

        const res = await fetchDealsData(true)
        assert.equal(res.deals.length, 2)
        assert.equal(res.deals[0].itadId, 'g1')
        assert.equal(res.deals[1].itadId, 'g3')
      } finally {
        globalThis.fetch = origFetch
      }
    })
  })
})
