import { useEffect, useMemo, useState, useRef } from 'react'
import DealCard from '../components/DealCard'
import cachedFetch from '../lib/cachedFetch'
import {
  STORE_NAMES,
  formatStoreName,
  useLowestPrices,
  parseDealsParams,
  serializeDealsParams,
  filterAndSortDeals,
} from '../lib/dealsData'

const BASE = 'https://www.cheapshark.com'

function SkeletonCard() {
  return (
    <div className="deal-card-skeleton" aria-hidden="true">
      <div className="deal-card-skeleton__media" />
      <div className="deal-card-skeleton__body">
        <div className="deal-card-skeleton__title" />
        <div className="deal-card-skeleton__meta" />
        <div className="deal-card-skeleton__price" />
        <div className="deal-card-skeleton__btn" />
      </div>
    </div>
  )
}

function FlameIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="13"
      height="13"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2c-.5 2.5-2.5 4.5-4.5 6-2 1.5-3.5 4-3.5 7 0 4.4 3.6 8 8 8s8-3.6 8-8c0-3.5-2-6.5-4-8.5-.5 2-1.5 3.5-3 4.5C13 8 13.5 4.5 12 2z" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

export default function Deals({ getGameActions, onAvailabilityChange }) {
  // Read initial state from URL query
  const initialParams = useMemo(() => {
    if (typeof window === 'undefined') return parseDealsParams('')
    return parseDealsParams(window.location.search)
  }, [])

  const [store, setStore] = useState(initialParams.store)
  const [minDiscount, setMinDiscount] = useState(initialParams.minDiscount)
  const [sort, setSort] = useState(initialParams.sort)
  const [searchQuery, setSearchQuery] = useState(initialParams.q)
  const [debouncedQuery, setDebouncedQuery] = useState(initialParams.q)
  const [lowestOnly, setLowestOnly] = useState(initialParams.lowestOnly)
  const [maxPrice, setMaxPrice] = useState(initialParams.maxPrice)
  const [minRating, setMinRating] = useState(initialParams.minRating)
  const [showExtras, setShowExtras] = useState(initialParams.showExtras)
  const [currency, setCurrency] = useState(initialParams.currency)
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false)

  // Data fetching state
  const [stores, setStores] = useState([])
  const [allDeals, setAllDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [snapshotTime, setSnapshotTime] = useState(null)
  const [isUsingSnapshot, setIsUsingSnapshot] = useState(false)
  const [reload, setReload] = useState(0)

  // Paging state
  const [visibleCount, setVisibleCount] = useState(24)

  // Currency exchange rate
  const [inrRate, setInrRate] = useState(null)

  // Debounce search query input (200ms)
  const searchTimerRef = useRef(null)
  function handleSearchChange(e) {
    const val = e.target.value
    setSearchQuery(val)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setDebouncedQuery(val)
    }, 200)
  }

  // Sync state changes to URL query
  useEffect(() => {
    if (typeof window === 'undefined') return
    const currentParams = parseDealsParams(window.location.search)
    const nextState = {
      store,
      minDiscount,
      sort,
      q: debouncedQuery,
      lowestOnly,
      maxPrice,
      minRating,
      showExtras,
      currency,
    }
    const nextQuery = serializeDealsParams(nextState)
    const currentQuery = serializeDealsParams(currentParams)

    if (nextQuery !== currentQuery) {
      const nextUrl = `/deals${nextQuery}`
      window.history.replaceState({}, '', nextUrl)
    }
  }, [
    store,
    minDiscount,
    sort,
    debouncedQuery,
    lowestOnly,
    maxPrice,
    minRating,
    showExtras,
    currency,
  ])

  // Listen to popstate (back/forward navigation)
  useEffect(() => {
    function onPopState() {
      const p = parseDealsParams(window.location.search)
      setStore(p.store)
      setMinDiscount(p.minDiscount)
      setSort(p.sort)
      setSearchQuery(p.q)
      setDebouncedQuery(p.q)
      setLowestOnly(p.lowestOnly)
      setMaxPrice(p.maxPrice)
      setMinRating(p.minRating)
      setShowExtras(p.showExtras)
      setCurrency(p.currency)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  // Load stores list once
  useEffect(() => {
    let cancelled = false
    fetch('/data/cheapshark-deals.json')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (!cancelled && Array.isArray(data.stores)) {
          setStores(data.stores)
        }
      })
      .catch(() => {
        cachedFetch(`${BASE}/api/1.0/stores`)
          .then((list) => {
            if (!cancelled && Array.isArray(list)) {
              setStores(list.filter((s) => Number(s.isActive) === 1))
            }
          })
          .catch(() => {})
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Load currency exchange rate (USD to INR, cached 24h)
  useEffect(() => {
    const cacheKey = 'lootradar_usd_inr_rate'
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null')
      if (
        cached &&
        Date.now() - cached.time < 24 * 60 * 60 * 1000 &&
        Number(cached.rate) > 0
      ) {
        setInrRate(Number(cached.rate))
        return undefined
      }
    } catch {}

    let cancelled = false
    fetch('https://open.er-api.com/v6/latest/USD')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        const rate = Number(data?.rates?.INR)
        if (!cancelled && rate > 0) {
          setInrRate(rate)
          try {
            localStorage.setItem(cacheKey, JSON.stringify({ time: Date.now(), rate }))
          } catch {}
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [])

  // Fetch deals when sort or store changes
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      setVisibleCount(24)

      // Map sort value to CheapShark API sort field
      let apiSort = 'Deal Rating'
      if (sort === 'savings') apiSort = 'Savings'
      else if (sort === 'price') apiSort = 'Price'
      else if (sort === 'meta') apiSort = 'Metacritic'

      const params = new URLSearchParams({
        onSale: '1',
        pageSize: '60',
        sortBy: apiSort,
        desc: '0', // In CheapShark, desc=0 returns highest savings, deal rating, metacritic and lowest price first
      })
      if (store) params.set('storeID', store)

      try {
        let data = null
        let fromSnapshot = false
        let snapTime = null

        // If no specific store is filtered, try snapshot first for instant render
        if (!store && sort === 'savings') {
          try {
            const snapRes = await fetch('/data/cheapshark-deals.json')
            if (snapRes.ok) {
              const snapJson = await snapRes.json()
              if (Array.isArray(snapJson?.deals) && snapJson.deals.length > 0) {
                data = snapJson.deals
                snapTime = snapJson.generatedAt || null
                fromSnapshot = true
              }
            }
          } catch {}
        }

        // Live API call if not loaded or if specific store/sort is requested
        if (!data) {
          try {
            data = await cachedFetch(`${BASE}/api/1.0/deals?${params}`)
            fromSnapshot = false
            snapTime = null
          } catch (liveErr) {
            // If live fails, try snapshot fallback
            const snapRes = await fetch('/data/cheapshark-deals.json')
            if (snapRes.ok) {
              const snapJson = await snapRes.json()
              data = snapJson.deals || []
              snapTime = snapJson.generatedAt || null
              fromSnapshot = true
            } else {
              throw liveErr
            }
          }
        }

        if (!cancelled) {
          setAllDeals(Array.isArray(data) ? data : [])
          setIsUsingSnapshot(fromSnapshot)
          setSnapshotTime(snapTime)
        }
      } catch {
        if (!cancelled) {
          setError('Could not load deals. Check your connection and try again.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [store, sort, reload])

  // Lazy-load lowest ever prices for currently loaded deals in batches of 25
  const { lowestMap } = useLowestPrices(allDeals)

  // Filter and sort deals client-side
  const filteredDeals = useMemo(() => {
    return filterAndSortDeals(
      allDeals,
      {
        q: debouncedQuery,
        store,
        minDiscount,
        maxPrice,
        minRating,
        lowestOnly,
        showExtras,
        sort,
      },
      lowestMap
    )
  }, [
    allDeals,
    debouncedQuery,
    store,
    minDiscount,
    maxPrice,
    minRating,
    lowestOnly,
    showExtras,
    sort,
    lowestMap,
  ])

  // Notify parent of available deals
  useEffect(() => {
    if (typeof onAvailabilityChange === 'function') {
      onAvailabilityChange(filteredDeals)
    }
  }, [onAvailabilityChange, filteredDeals])

  const visibleDeals = useMemo(() => {
    return filteredDeals.slice(0, visibleCount)
  }, [filteredDeals, visibleCount])

  const hasMore = visibleCount < filteredDeals.length

  const isFiltered = Boolean(
    store !== '' ||
    minDiscount !== '0' ||
    sort !== 'deals' ||
    debouncedQuery !== '' ||
    lowestOnly ||
    maxPrice < 100 ||
    minRating > 0 ||
    showExtras
  )

  function handleResetFilters() {
    setStore('')
    setMinDiscount('0')
    setSort('deals')
    setSearchQuery('')
    setDebouncedQuery('')
    setLowestOnly(false)
    setMaxPrice(100)
    setMinRating(0)
    setShowExtras(false)
  }

  // Pre-filter store list for "Other" dropdown (excluding All, Steam 1, Epic 25, GOG 7)
  const primaryStoreIds = new Set(['1', '25', '7'])
  const otherStores = stores.filter((s) => !primaryStoreIds.has(String(s.storeID)))
  const isOtherStoreActive = Boolean(store && !primaryStoreIds.has(String(store)))
  const otherStoreName =
    isOtherStoreActive
      ? stores.find((s) => String(s.storeID) === String(store))?.storeName || 'Other'
      : 'Other'

  return (
    <section className="deals-page-redesign" aria-label="PC Game Deals">
      {/* ─── Header & Search ─── */}
      <header className="deals-header">
        <div className="deals-header__titles">
          <span className="lr-section-heading__kicker">PC STORE DEALS</span>
          <div className="deals-header__title-row">
            <h1>Game <strong>Deals</strong></h1>
            <span className="deals-count-badge">
              {loading ? 'Loading...' : `${filteredDeals.length} deals`}
            </span>
          </div>
        </div>

        {/* Debounced Search Input */}
        <div className="deals-search-box">
          <SearchIcon />
          <input
            type="search"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search deals by title..."
            className="deals-search-input"
            aria-label="Filter deals by title"
          />
          {searchQuery && (
            <button
              type="button"
              className="deals-search-clear"
              onClick={() => {
                setSearchQuery('')
                setDebouncedQuery('')
              }}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </header>

      {/* ─── Filter Bar ─── */}
      <div className="deals-filters-container">
        {/* Row 1: Store Chips */}
        <div className="deals-filter-row deals-filter-row--stores" role="group" aria-label="Filter by Store">
          <button
            type="button"
            className={`deals-chip ${!store ? 'is-active' : ''}`}
            onClick={() => setStore('')}
          >
            All
          </button>
          <button
            type="button"
            className={`deals-chip ${store === '1' ? 'is-active' : ''}`}
            onClick={() => setStore(store === '1' ? '' : '1')}
          >
            Steam
          </button>
          <button
            type="button"
            className={`deals-chip ${store === '25' ? 'is-active' : ''}`}
            onClick={() => setStore(store === '25' ? '' : '25')}
          >
            Epic
          </button>
          <button
            type="button"
            className={`deals-chip ${store === '7' ? 'is-active' : ''}`}
            onClick={() => setStore(store === '7' ? '' : '7')}
          >
            GOG
          </button>

          {/* "Other" Store Dropdown Menu */}
          <div className="deals-dropdown-wrapper">
            <select
              className={`deals-select-chip ${isOtherStoreActive ? 'is-active' : ''}`}
              value={isOtherStoreActive ? store : ''}
              onChange={(e) => setStore(e.target.value)}
              aria-label="Other stores"
            >
              <option value="">{isOtherStoreActive ? otherStoreName : 'Other stores...'}</option>
              {otherStores.map((s) => (
                <option key={s.storeID} value={s.storeID}>
                  {s.storeName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Discount Chips, Lowest-Ever Toggle, Sort, Currency Pill */}
        <div className="deals-filter-row deals-filter-row--controls">
          {/* Min-Discount Chips */}
          <div className="deals-chip-group" role="group" aria-label="Minimum discount">
            <button
              type="button"
              className={`deals-chip deals-chip--sm ${minDiscount === '0' ? 'is-active' : ''}`}
              onClick={() => setMinDiscount('0')}
            >
              Any
            </button>
            <button
              type="button"
              className={`deals-chip deals-chip--sm ${minDiscount === '25' ? 'is-active' : ''}`}
              onClick={() => setMinDiscount(minDiscount === '25' ? '0' : '25')}
            >
              25%+
            </button>
            <button
              type="button"
              className={`deals-chip deals-chip--sm ${minDiscount === '50' ? 'is-active' : ''}`}
              onClick={() => setMinDiscount(minDiscount === '50' ? '0' : '50')}
            >
              50%+
            </button>
            <button
              type="button"
              className={`deals-chip deals-chip--sm ${minDiscount === '75' ? 'is-active' : ''}`}
              onClick={() => setMinDiscount(minDiscount === '75' ? '0' : '75')}
            >
              75%+
            </button>
          </div>

          {/* Lowest Ever Toggle Chip */}
          <button
            type="button"
            className={`deals-chip deals-chip--lowest ${lowestOnly ? 'is-active' : ''}`}
            onClick={() => setLowestOnly(!lowestOnly)}
            aria-pressed={lowestOnly}
            title="Filter by games at or near their lowest recorded price"
          >
            <FlameIcon /> Lowest ever
          </button>

          {/* Sort Menu */}
          <div className="deals-sort-wrapper">
            <select
              className="deals-select deals-select--sort"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Sort deals"
            >
              <option value="deals">Best deals</option>
              <option value="savings">Biggest discount</option>
              <option value="price">Lowest price</option>
              <option value="meta">Metacritic</option>
            </select>
          </div>

          {/* Currency Pill Switch */}
          <div className="deals-currency-container">
            <div className="deals-currency-switch" aria-label="Display currency">
              <button
                type="button"
                className={currency === 'USD' ? 'is-selected' : ''}
                onClick={() => setCurrency('USD')}
              >
                USD
              </button>
              <button
                type="button"
                className={currency === 'INR' ? 'is-selected' : ''}
                onClick={() => setCurrency('INR')}
              >
                INR
              </button>
            </div>
            <span className="deals-currency-approx" title="Currency converted with live exchange rates">
              approx.
            </span>
          </div>

          {/* "More filters" Toggle Button */}
          <button
            type="button"
            className={`deals-more-btn ${moreFiltersOpen ? 'is-open' : ''}`}
            onClick={() => setMoreFiltersOpen(!moreFiltersOpen)}
            aria-expanded={moreFiltersOpen}
          >
            More filters <ChevronDownIcon />
          </button>

          {/* Active Reset Filters Button */}
          {isFiltered && (
            <button
              type="button"
              className="deals-active-reset-btn"
              onClick={handleResetFilters}
              title="Reset all filters to default"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              Reset filters
            </button>
          )}
        </div>

        {/* Collapsed "More filters" Panel */}
        {moreFiltersOpen && (
          <div className="deals-more-panel" role="region" aria-label="Additional filters">
            {/* Price Slider */}
            <div className="deals-filter-field">
              <label className="deals-range-label" htmlFor="deals-max-price">
                Max Price: <strong>${maxPrice} USD</strong>
              </label>
              <input
                id="deals-max-price"
                type="range"
                min="5"
                max="100"
                step="5"
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="deals-range-slider"
              />
            </div>

            {/* Min Rating Selector */}
            <div className="deals-filter-field">
              <label className="deals-field-label" htmlFor="deals-min-rating">
                Minimum Rating
              </label>
              <select
                id="deals-min-rating"
                className="deals-select"
                value={minRating}
                onChange={(e) => setMinRating(Number(e.target.value))}
              >
                <option value="0">Any rating</option>
                <option value="70">70%+ positive / MC 70</option>
                <option value="80">80%+ positive / MC 80</option>
                <option value="90">90%+ positive / MC 90</option>
              </select>
            </div>

            {/* DLC Note & Reveal Toggle */}
            <div className="deals-dlc-note">
              <span>{showExtras ? 'DLC, packs & expansions visible.' : 'DLC and bundles hidden.'}</span>
              <button
                type="button"
                className="deals-link-toggle"
                onClick={() => setShowExtras(!showExtras)}
              >
                {showExtras ? 'Hide DLC/bundles' : 'Reveal DLC/bundles'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Snapshot offline note if using snapshot */}
      {isUsingSnapshot && snapshotTime && (
        <div className="deals-snapshot-note" role="status">
          Showing saved deals from {new Date(snapshotTime).toLocaleDateString()}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="deals-error-box" role="alert">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setReload((k) => k + 1)}
            className="deals-retry-btn"
          >
            Retry
          </button>
        </div>
      )}

      {/* Grid of DealCards */}
      <div className="deals-grid-redesign" role="feed" aria-busy={loading}>
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
          : visibleDeals.map((deal) => {
              const lowestInfo = lowestMap[String(deal.gameID)]
              return (
                <DealCard
                  key={deal.dealID}
                  deal={deal}
                  storeName={formatStoreName(
                    stores.find((s) => String(s.storeID) === String(deal.storeID))?.storeName ||
                      STORE_NAMES[String(deal.storeID)]
                  )}
                  getGameActions={getGameActions}
                  lowestPrice={lowestInfo?.price}
                  lowestLoading={!lowestInfo && !deal.cheapest}
                  currency={currency}
                  inrRate={inrRate}
                />
              )
            })}
      </div>

      {/* Empty State */}
      {!loading && !error && filteredDeals.length === 0 && (
        <div className="deals-empty-state">
          <p className="deals-empty-title">No deals match these filters.</p>
          <p className="deals-empty-desc">
            Try adjusting your search query, increasing the maximum price, or lowering the minimum discount.
          </p>
          <button
            type="button"
            className="deals-reset-btn"
            onClick={handleResetFilters}
          >
            Reset filters
          </button>
        </div>
      )}

      {/* Load More Button */}
      {!loading && !error && hasMore && (
        <div className="deals-pagination">
          <button
            type="button"
            className="deals-load-more-btn"
            onClick={() => setVisibleCount((prev) => prev + 24)}
          >
            Load more deals ({filteredDeals.length - visibleCount} remaining)
          </button>
        </div>
      )}
    </section>
  )
}
