export const SNAPSHOT_TTL_MS = 10 * 60 * 1000
export const SNAPSHOT_TIMEOUT_MS = 12000

const snapshotCache = new Map()

function normalizeSnapshotName(name) {
  return String(name || '')
    .trim()
    .replace(/^\/+data\//, '')
    .replace(/\.json$/i, '')
}

export function clearSnapshotCache(name) {
  if (name) {
    snapshotCache.delete(normalizeSnapshotName(name))
  } else {
    snapshotCache.clear()
  }
}

/**
 * Fetch with an AbortController timeout (default 12s) and optional parent AbortSignal forwarding.
 */
export async function fetchWithTimeout(url, options = {}, timeoutMs = SNAPSHOT_TIMEOUT_MS) {
  const controller = new AbortController()
  const parentSignal = options?.signal
  let onParentAbort = null

  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort(parentSignal.reason)
    } else {
      onParentAbort = () => controller.abort(parentSignal.reason)
      parentSignal.addEventListener('abort', onParentAbort, { once: true })
    }
  }

  const timer = setTimeout(() => {
    controller.abort(new DOMException('Request timed out', 'TimeoutError'))
  }, timeoutMs)

  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
    if (parentSignal && onParentAbort) {
      parentSignal.removeEventListener('abort', onParentAbort)
    }
  }
}

/**
 * Shared snapshot loader for /data/<name>.json.
 * - Concurrent callers share one in-flight promise.
 * - Cached values younger than 10 minutes are returned without a network request.
 * - refresh: true forces a new request.
 * - Failed requests are never cached so the next call retries.
 */
export async function loadSnapshot(name, { refresh = false, timeoutMs = SNAPSHOT_TIMEOUT_MS } = {}) {
  const key = normalizeSnapshotName(name)
  if (!key) {
    throw new Error('INVALID_DATA: Snapshot name is required')
  }

  const existing = snapshotCache.get(key)
  if (!refresh && existing) {
    if (existing.value !== undefined && Date.now() - existing.fetchedAt < SNAPSHOT_TTL_MS) {
      return existing.value
    }
    if (existing.promise) {
      return existing.promise
    }
  }

  const url = `/data/${key}.json`
  const promise = (async () => {
    let response
    try {
      response = await fetchWithTimeout(url, {}, timeoutMs)
    } catch (err) {
      if (err?.name === 'AbortError' || err?.name === 'TimeoutError') {
        const timeoutErr = new Error(`NETWORK_ERROR: Timed out fetching ${url}`)
        timeoutErr.name = err.name
        timeoutErr.cause = err
        throw timeoutErr
      }
      const netErr = new Error(`NETWORK_ERROR: Network connection failed while fetching ${url}`)
      netErr.cause = err
      throw netErr
    }

    if (response.status === 404) {
      throw new Error(`NOT_FOUND: Snapshot file ${url} not found (404)`)
    }

    const contentType = response.headers?.get?.('content-type') || ''
    if (
      contentType.includes('text/html') ||
      (contentType && !contentType.includes('json') && !contentType.includes('text/plain'))
    ) {
      throw new Error(`NOT_FOUND: Server returned HTML index fallback instead of JSON for ${url}`)
    }

    if (!response.ok) {
      throw new Error(`HTTP_ERROR: Server returned HTTP ${response.status} for ${url}`)
    }

    let data
    try {
      data = await response.json()
    } catch (parseErr) {
      const err = new Error(`INVALID_DATA: Snapshot ${url} is not valid JSON`)
      err.cause = parseErr
      throw err
    }

    snapshotCache.set(key, {
      promise: null,
      fetchedAt: Date.now(),
      value: data,
    })

    return data
  })()

  snapshotCache.set(key, {
    promise,
    fetchedAt: existing?.fetchedAt || 0,
    value: existing?.value,
  })

  try {
    return await promise
  } catch (err) {
    const current = snapshotCache.get(key)
    if (current?.promise === promise) {
      snapshotCache.delete(key)
    }
    throw err
  }
}
