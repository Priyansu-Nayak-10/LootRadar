import { useEffect, useMemo, useState } from 'react'
import GameActions from '../components/GameActions'
import cachedFetch from '../lib/cachedFetch'

const BASE = 'https://www.cheapshark.com'

function SkeletonCard() {
  return (
    <div className="skeleton-card" aria-hidden="true">
      <div className="skeleton-image" />
      <div className="skeleton-lines">
        <div className="skeleton-line" />
        <div className="skeleton-line" />
        <div className="skeleton-line" />
      </div>
    </div>
  )
}

function formatUsd(amount) {
  const value = Number(amount)
  if (!Number.isFinite(value)) return '-'
  return `$${value.toFixed(2)} USD`
}

function DealCard({ deal, storeName, getGameActions }) {
  const discount = Math.round(Number(deal.savings))
  const image = deal.steamAppID
    ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${deal.steamAppID}/header.jpg`
    : deal.thumb
  const actions = getGameActions({
    title: deal.title,
    platform: storeName,
    image,
    source: 'deal',
    sourceId: deal.dealID,
  })
  return (
    <article className="game-card">
      <img
        src={image}
        alt={deal.title}
        loading="lazy"
        onError={(e) => {
          if (e.currentTarget.src !== deal.thumb) e.currentTarget.src = deal.thumb
        }}
        className="game-card-image"
      />
      <div className="game-card-content">
        <h2 className="game-title">{deal.title}</h2>
        <p className="game-platform">
          {storeName}
          {Number(deal.metacriticScore) > 0 && (
            <span className="metacritic-badge">
              Metacritic {deal.metacriticScore}
            </span>
          )}
        </p>
        <div className="game-price-row">
          <span className="discount-pill">
            -{discount}%
          </span>
          <span className="old-price">
            {formatUsd(deal.normalPrice)}
          </span>
          <span className="sale-price">
            {formatUsd(deal.salePrice)}
          </span>
        </div>
        <GameActions {...actions} />
        <a
          href={`${BASE}/redirect?dealID=${deal.dealID}`}
          target="_blank"
          rel="noreferrer"
          className="game-card-cta"
        >
          Get deal <span aria-hidden="true">-&gt;</span>
        </a>
      </div>
    </article>
  )
}

const selectClass =
  'filter-select'

export default function Deals({ getGameActions, onAvailabilityChange }) {
  const [stores, setStores] = useState([])
  const [store, setStore] = useState('')
  const [maxPrice, setMaxPrice] = useState('15')
  const [minDiscount, setMinDiscount] = useState('0')
  const [sort, setSort] = useState('Savings')
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  // load the store list once
  useEffect(() => {
    cachedFetch(`${BASE}/api/1.0/stores`)
      .then((list) => setStores(list.filter((s) => Number(s.isActive) === 1)))
      .catch(() => {})
  }, [])

  // load deals whenever a filter changes
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      const p = new URLSearchParams({
        onSale: '1',
        pageSize: '60',
        sortBy: sort,
        desc: sort === 'Price' ? '0' : '1',
        upperPrice: maxPrice,
      })
      if (store) p.set('storeID', store)
      try {
        const data = await cachedFetch(`${BASE}/api/1.0/deals?${p}`)
        if (!cancelled) setDeals(Array.isArray(data) ? data : [])
      } catch {
        if (!cancelled)
          setError('Could not load deals. Check your internet and try again.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [store, maxPrice, sort, reload])

  const storeName = (id) =>
    stores.find((s) => s.storeID === id)?.storeName || 'Store'

  const shown = useMemo(
    () => deals.filter((d) => Number(d.savings) >= Number(minDiscount)),
    [deals, minDiscount]
  )

  useEffect(() => {
    onAvailabilityChange(shown)
  }, [onAvailabilityChange, shown])

  return (
    <div>
      <div className="filter-toolbar" aria-label="Filter deals">
        <select className={selectClass} value={store} onChange={(e) => setStore(e.target.value)}>
          <option value="">All stores</option>
          {stores.map((s) => (
            <option key={s.storeID} value={s.storeID}>
              {s.storeName}
            </option>
          ))}
        </select>

        <select className={selectClass} value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)}>
          {[5, 10, 15, 30, 60, 100].map((p) => (
            <option key={p} value={p}>
              Under ${p} USD
            </option>
          ))}
        </select>

        <select className={selectClass} value={minDiscount} onChange={(e) => setMinDiscount(e.target.value)}>
          <option value="0">Any discount</option>
          <option value="25">25% off or more</option>
          <option value="50">50% off or more</option>
          <option value="75">75% off or more</option>
        </select>

        <select className={selectClass} value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="Savings">Biggest discount</option>
          <option value="Price">Lowest price</option>
          <option value="Deal Rating">Best deal rating</option>
          <option value="Metacritic">Top rated</option>
        </select>
      </div>

      <p className="currency-note">Prices are shown in USD, as supplied by CheapShark.</p>

      {error && (
        <div className="inline-error" role="alert">
          {error}{' '}
          <button onClick={() => setReload((n) => n + 1)} className="underline">
            Retry
          </button>
        </div>
      )}

      <div className="game-grid">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
          : shown.map((d) => (
              <DealCard
                key={d.dealID}
                deal={d}
                storeName={storeName(d.storeID)}
                getGameActions={getGameActions}
              />
            ))}
      </div>

      {!loading && !error && shown.length === 0 && (
        <p className="empty-state">
          No deals match these filters. Try a higher price or lower discount.
        </p>
      )}
    </div>
  )
}
