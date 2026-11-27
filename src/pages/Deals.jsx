import { useEffect, useMemo, useState, useRef } from 'react'
import DealCard from '../components/DealCard'
import {
  FlameIcon,
  SearchIcon,
  ChevronDownIcon,
  RotateCcwIcon,
} from '../components/icons'
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
    errorMessage,
    reload,
  } = useDeals()

  const searchTimerRef = useRef(null)
  useEffect(() => () => clearTimeout(searchTimerRef.current), [])

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

  const headerSubtitle = [
    updatedLabel,
    isStale ? 'Prices may be out of date.' : '',
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <section className="deals-page-redesign" aria-label="India PC Game Deals">
      <header className="deals-header">
        <div className="deals-header__titles">
          <span className="lr-section-heading__kicker">India PC store deals</span>
          <div className="deals-header__title-row">
            <h1>
              Game <em>Deals</em>
            </h1>
            <span className="deals-count-badge">
              {loading ? 'Loading...' : `${filteredDeals.length} deals`}
            </span>
          </div>
          {headerSubtitle && (
            <p className="deals-header__sub" role={isStale ? 'status' : undefined}>
              {headerSubtitle}
            </p>
          )}
        </div>

        <div className="deals-search-box">
          <SearchIcon size={20} className="deals-search-icon" />
          <input
            type="search"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search deals by title…"
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
        <div className="deals-filter-row" role="toolbar" aria-label="Deal filters">
          <button
            type="button"
            className={`wr-chip ${!store ? 'is-active' : ''}`}
            onClick={() => setStore('')}
            aria-pressed={!store}
          >
            All
          </button>
          {storeChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className={`wr-chip ${store === chip.id ? 'is-active' : ''}`}
              onClick={() => setStore(store === chip.id ? '' : chip.id)}
              aria-pressed={store === chip.id}
            >
              {chip.label}
            </button>
          ))}

          <span className="deals-filter-spacer" aria-hidden="true" />

          <button
            type="button"
            className={`wr-chip ${minDiscount === '0' ? 'is-active' : ''}`}
            onClick={() => setMinDiscount('0')}
            aria-pressed={minDiscount === '0'}
          >
            Any
          </button>
          <button
            type="button"
            className={`wr-chip ${minDiscount === '25' ? 'is-active' : ''}`}
            onClick={() => setMinDiscount(minDiscount === '25' ? '0' : '25')}
            aria-pressed={minDiscount === '25'}
          >
            25%+
          </button>
          <button
            type="button"
            className={`wr-chip ${minDiscount === '50' ? 'is-active' : ''}`}
            onClick={() => setMinDiscount(minDiscount === '50' ? '0' : '50')}
            aria-pressed={minDiscount === '50'}
          >
            50%+
          </button>
          <button
            type="button"
            className={`wr-chip ${minDiscount === '75' ? 'is-active' : ''}`}
            onClick={() => setMinDiscount(minDiscount === '75' ? '0' : '75')}
            aria-pressed={minDiscount === '75'}
          >
            75%+
          </button>

          <button
            type="button"
            className={`wr-chip deals-chip--lowest ${lowestOnly ? 'is-active' : ''}`}
            onClick={() => setLowestOnly(!lowestOnly)}
            aria-pressed={lowestOnly}
            title="Filter by games at their lowest recorded price"
          >
            <FlameIcon size={14} /> Lowest ever
          </button>

          <div className="deals-sort-wrapper">
            <select
              className="wr-chip deals-sort-select"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Sort deals"
            >
              <option value="deals">Best deals</option>
              <option value="savings">Biggest discount</option>
              <option value="price">Lowest price</option>
              <option value="expiry">Ending soon</option>
            </select>
            <ChevronDownIcon size={16} className="deals-sort-chevron" />
          </div>

          <button
            type="button"
            className={`deals-more-btn ${moreFiltersOpen ? 'is-open' : ''}`}
            onClick={() => setMoreFiltersOpen(!moreFiltersOpen)}
            aria-expanded={moreFiltersOpen}
            aria-controls="deals-more-filters-panel"
          >
            More filters <ChevronDownIcon size={16} />
          </button>

          {isFiltered && (
            <button
              type="button"
              className="deals-active-reset-btn"
              onClick={handleResetFilters}
              title="Reset all filters to default"
            >
              <RotateCcwIcon size={12} strokeWidth={2.5} />
              Reset filters
            </button>
          )}
        </div>

        {moreFiltersOpen && (
          <div
            id="deals-more-filters-panel"
            className="deals-more-panel"
            role="region"
            aria-label="Additional filters"
          >
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
          <p>{errorMessage || 'Could not load deals. Check your connection and try again.'}</p>
          <button
            type="button"
            onClick={reload}
            className="deals-retry-btn"
            aria-label="Retry loading deals"
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
            className="wr-cta wr-cta--secondary deals-load-more-btn"
            onClick={() => setVisibleCount((prev) => prev + 24)}
          >
            Load more deals ({Math.max(0, filteredDeals.length - visibleCount)} remaining)
          </button>
        </div>
      )}
    </section>
  )
}
