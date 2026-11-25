import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatDealPrice,
  formatDealExpiry,
  matchDealForGame,
  parseDealsParams,
  serializeDealsParams,
  filterAndSortDeals,
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
    const sampleDeals = [
      {
        itadId: 'd1',
        title: 'Hades',
        shop: { id: 61, name: 'Steam' },
        price: 440,
        cut: 60,
        isLowestEver: true,
        expiry: '2026-12-01T10:00:00Z',
      },
      {
        itadId: 'd2',
        title: 'Dead Cells',
        shop: { id: 16, name: 'Epic Game Store' },
        price: 399,
        cut: 50,
        isLowestEver: false,
        expiry: '2026-11-27T10:00:00Z',
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
    ]

    it('filters by store, minDiscount, maxPrice, lowestOnly, and query', () => {
      assert.equal(filterAndSortDeals(sampleDeals, { store: '61' }).length, 1)
      assert.equal(filterAndSortDeals(sampleDeals, { minDiscount: '75' }).length, 1)
      assert.equal(filterAndSortDeals(sampleDeals, { maxPrice: 500 }).length, 2)
      assert.equal(filterAndSortDeals(sampleDeals, { lowestOnly: true }).length, 2)
      assert.equal(filterAndSortDeals(sampleDeals, { q: 'hades' }).length, 1)
    })

    it('sorts by savings, price, and expiry ascending', () => {
      const bySavings = filterAndSortDeals(sampleDeals, { sort: 'savings' })
      assert.equal(bySavings[0].itadId, 'd3')

      const byPrice = filterAndSortDeals(sampleDeals, { sort: 'price' })
      assert.equal(byPrice[0].itadId, 'd2')

      const byExpiry = filterAndSortDeals(sampleDeals, { sort: 'expiry' })
      assert.equal(byExpiry[0].itadId, 'd2')
      assert.equal(byExpiry[1].itadId, 'd1')
      assert.equal(byExpiry[2].itadId, 'd3')
    })
  })
})
