import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { loadSnapshot, clearSnapshotCache } from '../snapshots.js'

describe('snapshots shared loader', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    clearSnapshotCache()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('deduplicates 5 concurrent calls into 1 fetch', async () => {
    let calls = 0
    globalThis.fetch = async () => {
      calls++
      await new Promise((r) => setTimeout(r, 15))
      return new Response(JSON.stringify({ games: [{ id: 1 }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    const results = await Promise.all([
      loadSnapshot('gamerpower-free-games'),
      loadSnapshot('gamerpower-free-games'),
      loadSnapshot('gamerpower-free-games'),
      loadSnapshot('gamerpower-free-games'),
      loadSnapshot('gamerpower-free-games'),
    ])

    assert.equal(calls, 1)
    assert.equal(results.length, 5)
    for (const res of results) {
      assert.deepEqual(res, { games: [{ id: 1 }] })
    }
  })

  it('returns cached value on a second call within 10 minutes without fetching', async () => {
    let calls = 0
    globalThis.fetch = async () => {
      calls++
      return new Response(JSON.stringify({ current: ['A'] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    const first = await loadSnapshot('epic-free-games')
    const second = await loadSnapshot('epic-free-games')
    assert.equal(calls, 1)
    assert.deepEqual(first, second)
  })

  it('forces a new fetch when refresh: true is passed', async () => {
    let calls = 0
    globalThis.fetch = async () => {
      calls++
      return new Response(JSON.stringify({ version: calls }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    const first = await loadSnapshot('fx-rates')
    const refreshed = await loadSnapshot('fx-rates', { refresh: true })
    assert.equal(calls, 2)
    assert.equal(first.version, 1)
    assert.equal(refreshed.version, 2)
  })

  it('does not cache failed fetches so the next call retries', async () => {
    let calls = 0
    globalThis.fetch = async () => {
      calls++
      if (calls === 1) {
        return new Response('Server Error', { status: 500 })
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    await assert.rejects(() => loadSnapshot('gaming-news'), /HTTP_ERROR/)
    const recovered = await loadSnapshot('gaming-news')
    assert.equal(calls, 2)
    assert.deepEqual(recovered, { ok: true })
  })

  it('aborts and rejects when timeout expires', async () => {
    let aborted = false
    globalThis.fetch = (_url, opts) =>
      new Promise((_resolve, reject) => {
        opts.signal.addEventListener('abort', () => {
          aborted = true
          const err = new Error('Aborted')
          err.name = 'AbortError'
          reject(err)
        })
      })

    await assert.rejects(
      () => loadSnapshot('always-free-games', { timeoutMs: 30 }),
      /NETWORK_ERROR/
    )
    assert.equal(aborted, true)
  })
})
