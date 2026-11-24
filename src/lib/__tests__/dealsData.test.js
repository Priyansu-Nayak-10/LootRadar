import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  isDlcLike,
  getDealFlag,
  formatDealPrice,
  parseDealsParams,
  serializeDealsParams,
  filterAndSortDeals,
} from '../dealsData.js'

describe('dealsData helpers and logic', () => {
  describe('isDlcLike', () => {
    it('detects all standard and extended DLC/extra keywords', () => {
      assert.equal(isDlcLike('Cyberpunk 2077: Phantom Liberty - Expansion'), true)
      assert.equal(isDlcLike('Destiny 2: Season Pass'), true)
      assert.equal(isDlcLike('Celeste Original Soundtrack'), true)
      assert.equal(isDlcLike('Hollow Knight OST'), true)
      assert.equal(isDlcLike('Baldurs Gate 3 - Digital Artbook'), true)
      assert.equal(isDlcLike('Street Fighter 6 - Outfit Skin Pack'), true)
      assert.equal(isDlcLike('Path of Exile - Cosmetic Wings'), true)
      assert.equal(isDlcLike('Deep Rock Galactic - Supporter Upgrade'), true)
      assert.equal(isDlcLike('Borderlands 3 DLC: Bounty of Blood'), true)
      assert.equal(isDlcLike('Portal 2 - Downloadable Content'), true)
      assert.equal(isDlcLike('Valve Complete Bundle'), true)
      assert.equal(isDlcLike('Sims 4 Expansion Pack'), true)
    })

    it('returns false for full standalone base games', () => {
      assert.equal(isDlcLike('The Witcher 3: Wild Hunt'), false)
      assert.equal(isDlcLike('Grand Theft Auto V'), false)
      assert.equal(isDlcLike('Red Dead Redemption 2'), false)
      assert.equal(isDlcLike('Hades'), false)
      assert.equal(isDlcLike('Cyberpunk 2077'), false)
      assert.equal(isDlcLike(''), false)
      assert.equal(isDlcLike(null), false)
    })
  })

  describe('getDealFlag', () => {
    it('returns "lowest" when salePrice <= cheapestEverPrice', () => {
      assert.equal(getDealFlag(4.99, 4.99, 5, 20), 'lowest')
      assert.equal(getDealFlag(4.99, 5.00, 5, 20), 'lowest')
      // With small 0.01 tolerance
      assert.equal(getDealFlag(4.999, 4.99, 5, 20), 'lowest')
    })

    it('returns "great" when not lowest but dealRating >= 8 or savings >= 50', () => {
      assert.equal(getDealFlag(19.99, 9.99, 8.5, 30), 'great')
      assert.equal(getDealFlag(19.99, 9.99, 6.0, 60), 'great')
    })

    it('returns null when neither lowest nor great', () => {
      assert.equal(getDealFlag(24.99, 14.99, 5.0, 20), null)
      assert.equal(getDealFlag(39.99, null, 4.0, 15), null)
    })
  })

  describe('formatDealPrice', () => {
    it('returns Free for 0', () => {
      assert.equal(formatDealPrice(0), 'Free')
      assert.equal(formatDealPrice('0.00'), 'Free')
    })

    it('formats USD prices with 2 decimal digits', () => {
      assert.equal(formatDealPrice(14.99, 'USD'), '$14.99')
      assert.equal(formatDealPrice(5, 'USD'), '$5.00')
      assert.equal(formatDealPrice('0.99', 'USD'), '$0.99')
    })

    it('formats and rounds INR prices', () => {
      const inrRate = 83.5
      // 10 * 83.5 = 835
      assert.equal(formatDealPrice(10, 'INR', inrRate), '₹835')
      // 14.99 * 83.5 = 1251.665 -> 1252
      assert.equal(formatDealPrice(14.99, 'INR', inrRate), '₹1,252')
    })

    it('handles invalid inputs gracefully', () => {
      assert.equal(formatDealPrice(null), '-')
      assert.equal(formatDealPrice('invalid'), '-')
    })
  })

  describe('URL params parsing and serialization', () => {
    it('parses URL query params into state object', () => {
      const search = '?store=steam&min=50&sort=price&q=witcher&lowest=1&maxPrice=30&rating=80&extras=1&currency=INR'
      const parsed = parseDealsParams(search)

      assert.equal(parsed.store, '1') // 'steam' mapped to '1'
      assert.equal(parsed.minDiscount, '50')
      assert.equal(parsed.sort, 'price')
      assert.equal(parsed.q, 'witcher')
      assert.equal(parsed.lowestOnly, true)
      assert.equal(parsed.maxPrice, 30)
      assert.equal(parsed.minRating, 80)
      assert.equal(parsed.showExtras, true)
      assert.equal(parsed.currency, 'INR')
    })

    it('serializes state back to URL query string', () => {
      const state = {
        store: '1',
        minDiscount: '50',
        sort: 'price',
        q: 'witcher',
        lowestOnly: true,
        maxPrice: 30,
        minRating: 80,
        showExtras: true,
        currency: 'INR',
      }
      const query = serializeDealsParams(state)
      assert.match(query, /store=steam/)
      assert.match(query, /min=50/)
      assert.match(query, /sort=price/)
      assert.match(query, /q=witcher/)
      assert.match(query, /lowest=1/)
      assert.match(query, /maxPrice=30/)
      assert.match(query, /rating=80/)
      assert.match(query, /extras=1/)
      assert.match(query, /currency=INR/)
    })

    it('returns empty string for default state', () => {
      const state = {
        store: '',
        minDiscount: '0',
        sort: 'deals',
        q: '',
        lowestOnly: false,
        maxPrice: 100,
        minRating: 0,
        showExtras: false,
        currency: 'USD',
      }
      assert.equal(serializeDealsParams(state), '')
    })
  })

  describe('filterAndSortDeals', () => {
    const sampleDeals = [
      {
        dealID: 'd1',
        gameID: '101',
        title: 'Hades',
        storeID: '1',
        salePrice: '12.49',
        savings: '50.0',
        dealRating: '9.5',
        metacriticScore: '93',
        steamRatingPercent: '98',
      },
      {
        dealID: 'd2',
        gameID: '102',
        title: 'Hades Soundtrack',
        storeID: '1',
        salePrice: '4.99',
        savings: '50.0',
        dealRating: '8.0',
        metacriticScore: '0',
        steamRatingPercent: '95',
      },
      {
        dealID: 'd3',
        gameID: '103',
        title: 'Dead Cells',
        storeID: '25',
        salePrice: '9.99',
        savings: '60.0',
        dealRating: '9.0',
        metacriticScore: '89',
        steamRatingPercent: '96',
      },
      {
        dealID: 'd4',
        gameID: '104',
        title: 'Cyberpunk 2077',
        storeID: '7',
        salePrice: '29.99',
        savings: '50.0',
        dealRating: '8.2',
        metacriticScore: '86',
        steamRatingPercent: '82',
      },
      {
        dealID: 'd5',
        gameID: '105',
        title: 'Free Game Giveaway',
        storeID: '25',
        salePrice: '0.00',
        savings: '100.0',
        dealRating: '10.0',
        metacriticScore: '0',
        steamRatingPercent: '0',
      },
    ]

    it('filters out DLC items when showExtras is false', () => {
      const result = filterAndSortDeals(sampleDeals, { showExtras: false })
      const titles = result.map((d) => d.title)
      assert.equal(titles.includes('Hades Soundtrack'), false)
      assert.equal(titles.includes('Hades'), true)
    })

    it('includes DLC items when showExtras is true', () => {
      const result = filterAndSortDeals(sampleDeals, { showExtras: true })
      const titles = result.map((d) => d.title)
      assert.equal(titles.includes('Hades Soundtrack'), true)
    })

    it('filters by search query', () => {
      const result = filterAndSortDeals(sampleDeals, { q: 'cyber' })
      assert.equal(result.length, 1)
      assert.equal(result[0].title, 'Cyberpunk 2077')
    })

    it('filters by store ID', () => {
      const result = filterAndSortDeals(sampleDeals, { store: '7' })
      assert.equal(result.length, 1)
      assert.equal(result[0].title, 'Cyberpunk 2077')
    })

    it('filters by minimum discount', () => {
      const result = filterAndSortDeals(sampleDeals, { minDiscount: '60' })
      // savings >= 60 are Dead Cells (60) and Free Game (100)
      assert.equal(result.length, 2)
    })

    it('filters by lowestOnly using lowestPricesMap', () => {
      const lowestMap = {
        '101': { price: 12.49 }, // Hades matches
        '103': { price: 4.99 },  // Dead Cells salePrice is 9.99 > 4.99 -> does not match
      }
      const result = filterAndSortDeals(sampleDeals, { lowestOnly: true }, lowestMap)
      assert.equal(result.length, 1)
      assert.equal(result[0].title, 'Hades')
    })

    it('sorts correctly', () => {
      // By savings: 100% first, then 60%, then 50%
      const bySavings = filterAndSortDeals(sampleDeals, { sort: 'savings' })
      assert.equal(bySavings[0].title, 'Free Game Giveaway')
      assert.equal(bySavings[1].title, 'Dead Cells')

      // By price: 0.00 first, then 9.99, then 12.49, then 29.99
      const byPrice = filterAndSortDeals(sampleDeals, { sort: 'price' })
      assert.equal(byPrice[0].salePrice, '0.00')
      assert.equal(byPrice[byPrice.length - 1].salePrice, '29.99')

      // By metacritic: 93 (Hades) first, then 89 (Dead Cells), then 86 (Cyberpunk)
      const byMeta = filterAndSortDeals(sampleDeals, { sort: 'meta' })
      assert.equal(byMeta[0].title, 'Hades')
      assert.equal(byMeta[1].title, 'Dead Cells')
    })
  })
})
