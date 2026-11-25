import { useEffect, useMemo, useState, useRef } from 'react'
import DealCard from '../components/DealCard'
import {
  MAX_PRICE_CAP,
  formatDealPrice,
  formatStoreName,
  parseDealsParams,
  serializeDealsParams,
  filterAndSortDeals,
  useDeals,
} from '../lib/dealsData'

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
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false)
  const [visibleCount, setVisibleCount] = useState(24)

  const {
    deals: allDeals,
    stores,
    updatedLabel,
    isStale,
    loading,
    error,
    reload,
  } = useDeals()

  const searchTimerRef = useRef(null)
  function handleSearchChange(e) {
    const val = e.target.value
    setSearchQuery(val)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setDebouncedQuery(val)
    }, 200)
  }

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
    }
    const nextQuery = serializeDealsParams(nextState)
    const currentQuery = serializeDealsParams(currentParams)

    if (nextQuery !== currentQuery) {
      window.history.replaceState({}, '', `/deals${nextQuery}`)
    }
  }, [store, minDiscount, sort, debouncedQuery, lowestOnly, maxPrice])

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
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const storeChips = useMemo(() => {
    if (Array.isArray(stores) && stores.length > 0) {
      return stores.map((s) => ({
        id: String(s.id),
        label: formatStoreName(s.name),
      }))
    }
    return [
      { id: '61', label: 'Steam' },
      { id: '16', label: 'Epic' },
      { id: '52', label: 'EA Store' },
    ]
  }, [stores])

  const filteredDeals = useMemo(() => {
    return filterAndSortDeals(allDeals, {
      q: debouncedQuery,
      store,
      minDiscount,
      maxPrice,
      lowestOnly,
      sort,
    })
  }, [allDeals, debouncedQuery, store, minDiscount, maxPrice, lowestOnly, sort])

  useEffect(() => {
    setVisibleCount(24)
  }, [store, minDiscount, sort, debouncedQuery, lowestOnly, maxPrice])

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
      maxPrice < MAX_PRICE_CAP
  )

  function handleResetFilters() {
    setStore('')
    setMinDiscount('0')
    setSort('deals')
    setSearchQuery('')
    setDebouncedQuery('')
    setLowestOnly(false)
    setMaxPrice(MAX_PRICE_CAP)
  }

  return (
    <section className="deals-page-redesign" aria-label="India PC Game Deals">
      <header className="deals-header">
        <div className="deals-header__titles">
          <span className="lr-section-heading__kicker">INDIA PC STORE DEALS</span>
          <div className="deals-header__title-row">
            <h1>
              Game <strong>Deals</strong>
            </h1>
            <span className="deals-count-badge">
              {loading ? 'Loading...' : `${filteredDeals.length} deals`}
            </span>
            {updatedLabel && (
              <span className="deals-updated-label">{updatedLabel}</span>
            )}
          </div>
          {isStale && (
            <p className="deals-stale-warning" role="status">
              Prices may be older than 3 hours.
            </p>
          )}
        </div>

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

      <div className="deals-filters-container">
        <div className="deals-filter-row deals-filter-row--stores" role="group" aria-label="Filter by Store">
          <button
            type="button"
            className={`deals-chip ${!store ? 'is-active' : ''}`}
            onClick={() => setStore('')}
          >
            All
          </button>
          {storeChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className={`deals-chip ${store === chip.id ? 'is-active' : ''}`}
              onClick={() => setStore(store === chip.id ? '' : chip.id)}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="deals-filter-row deals-filter-row--controls">
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

          <button
            type="button"
            className={`deals-chip deals-chip--lowest ${lowestOnly ? 'is-active' : ''}`}
            onClick={() => setLowestOnly(!lowestOnly)}
            aria-pressed={lowestOnly}
            title="Filter by games at their lowest recorded price"
          >
            <FlameIcon /> Lowest ever
          </button>

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
              <option value="expiry">Ending soon</option>
            </select>
          </div>

          <button
            type="button"
            className={`deals-more-btn ${moreFiltersOpen ? 'is-open' : ''}`}
            onClick={() => setMoreFiltersOpen(!moreFiltersOpen)}
            aria-expanded={moreFiltersOpen}
          >
            More filters <ChevronDownIcon />
          </button>

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

        {moreFiltersOpen && (
          <div className="deals-more-panel" role="region" aria-label="Additional filters">
            <div className="deals-filter-field">
              <label className="deals-range-label" htmlFor="deals-max-price">
                Max Price:{' '}
                <strong>
                  {maxPrice >= MAX_PRICE_CAP ? `${formatDealPrice(MAX_PRICE_CAP)}+` : formatDealPrice(maxPrice)}
                </strong>
              </label>
              <input
                id="deals-max-price"
                type="range"
                min="0"
                max={MAX_PRICE_CAP}
                step="250"
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="deals-range-slider"
              />
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="deals-error-box" role="alert">
          <p>Could not load deals. Check your connection and try again.</p>
          <button
            type="button"
            onClick={reload}
            className="deals-retry-btn"
          >
            Retry
          </button>
        </div>
      )}

      <div className="deals-grid-redesign" role="feed" aria-busy={loading}>
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
          : visibleDeals.map((deal) => (
              <DealCard
                key={deal.itadId}
                deal={deal}
                getGameActions={getGameActions}
              />
            ))}
      </div>

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
