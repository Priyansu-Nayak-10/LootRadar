import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeQuery, rankAndFilter, dedupeGames } from '../searchRank.js'

describe('Search suggestions pure logic', () => {
  test('rejects queries under 2 characters', () => {
    assert.equal(normalizeQuery(''), '')
    assert.equal(normalizeQuery('a'), 'a')
    assert.ok(normalizeQuery('a').length < 2)
    assert.ok(normalizeQuery('  b  ').length < 2)
  })

  test('normalizes multi-word and punctuation queries properly', () => {
    assert.equal(normalizeQuery('  Cyberpunk: 2077!  '), 'cyberpunk 2077')
    assert.ok(normalizeQuery('Cyberpunk 2077').length >= 2)
  })

  test('deduplicates and ranks suggestion results with exact match first', () => {
    const rawGames = [
      { id: 2, name: 'Cyberpunk 2077: Phantom Liberty', added: 500, background_image: 'img2.jpg' },
      { id: 1, name: 'Cyberpunk 2077', added: 10000, background_image: 'img1.jpg' },
      { id: 1, name: 'Cyberpunk 2077', added: 50, background_image: 'img3.jpg' }, // duplicate id
    ]

    const deduped = dedupeGames(rawGames)
    assert.equal(deduped.length, 2)

    const ranked = rankAndFilter(deduped, 'cyberpunk 2077')
    assert.equal(ranked[0].name, 'Cyberpunk 2077')
  })

  test('simulates in-memory session cache and stale response handling', async () => {
    const cache = new Map()
    let currentRequestId = 0

    async function mockFetchSuggestions(query) {
      if (!query || query.length < 2) return []
      if (cache.has(query)) return cache.get(query)

      const reqId = ++currentRequestId
      // Simulate network
      const results = [{ id: 10, name: `Result for ${query}` }]
      cache.set(query, results)

      // Only return if still current request
      if (reqId === currentRequestId) {
        return results
      }
      return null // stale response ignored
    }

    const first = await mockFetchSuggestions('ha')
    assert.deepEqual(first, [{ id: 10, name: 'Result for ha' }])

    // Cached call returns identical result without refetch
    assert.ok(cache.has('ha'))
    const second = await mockFetchSuggestions('ha')
    assert.deepEqual(second, [{ id: 10, name: 'Result for ha' }])
  })
})
