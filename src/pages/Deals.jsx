import { useEffect, useMemo, useState } from 'react'
import GameActions from '../components/GameActions'
import cachedFetch from '../lib/cachedFetch'

const BASE = 'https://www.cheapshark.com'

function SkeletonCard() {
  return (
    <div className="lr-skeleton deals-skeleton" aria-hidden="true" />
  )
}

function formatPrice(amount, currency, inrRate) {
  const value = Number(amount)
  if (!Number.isFinite(value)) return '-'
  const displayValue = currency === 'INR' && inrRate ? value * inrRate : value
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency === 'INR' && inrRate ? 'INR' : 'USD', maximumFractionDigits: 2 }).format(displayValue)
}

function DealCard({ deal, storeName, getGameActions, currency, inrRate, onGameOpen }) {
  const discount = Math.round(Number(deal.savings))
  const historicalLow = Number(deal.lowestPrice ?? deal.lowest_price ?? deal.historicalLow)
  const isHistoricalLow = Number.isFinite(historicalLow) && Math.abs(Number(deal.salePrice) - historicalLow) < 0.005
  const image = deal.thumb
  const actions = getGameActions({
    title: deal.title,
    platform: storeName,
    image,
    source: 'deal',
    sourceId: deal.dealID,
  })
  return (
    <article className="lr-game-card deals-card" onClick={() => onGameOpen(deal.title)}>
      {image ? (
        <img
          src={image}
          alt={deal.title}
          loading="lazy"
          decoding="async"
          onError={(e) => {
            if (e.currentTarget.src !== deal.thumb) e.currentTarget.src = deal.thumb
          }}
          className="lr-game-card__image"
        />
      ) : (
        <div className="lr-art-fallback">DEAL</div>
      )}
      <div className="lr-game-card__body deals-card__body">
        <div className="deals-card__badges">
          {discount >= 5 && <span className="lr-badge lr-badge--lime">-{discount}%</span>}
          {isHistoricalLow && <span className="lr-badge">Lowest price ever</span>}
          {Number(deal.metacriticScore) > 0 && (
            <span className="lr-badge">Metacritic {deal.metacriticScore}</span>
          )}
        </div>
        <h2 className="deals-card__title">{deal.title}</h2>
        <p className="deals-card__store">
          {storeName}
        </p>
        <div className="deals-card__prices">
          <span className="old-price">
            {formatPrice(deal.normalPrice, currency, inrRate)}
          </span>
          <span className="sale-price">
            {formatPrice(deal.salePrice, currency, inrRate)}
          </span>
        </div>
        <div onClick={(event) => event.stopPropagation()}><GameActions {...actions} /></div>
        <a
          href={`${BASE}/redirect?dealID=${deal.dealID}`}
          onClick={(event) => event.stopPropagation()}
          target="_blank"
          rel="noreferrer"
          className="lr-button lr-button--secondary deals-card__cta"
        >
          Get deal <span aria-hidden="true">→</span>
        </a>
      </div>
    </article>
  )
}

const selectClass =
  'filter-select'

export default function Deals({ getGameActions, onAvailabilityChange, onGameOpen }) {
  const [stores, setStores] = useState([])
  const [store, setStore] = useState('')
  const [maxPrice, setMaxPrice] = useState(100)
  const [minDiscount, setMinDiscount] = useState('20')
  const [showExtras, setShowExtras] = useState(false)
  const [currency, setCurrency] = useState('USD')
  const [inrRate, setInrRate] = useState(null)
  const [sort, setSort] = useState('Savings')
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  // load the store list once
  useEffect(() => {
    fetch('/data/cheapshark-deals.json')
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((snapshot) => {
        if (Array.isArray(snapshot.stores)) setStores(snapshot.stores)
      })
      .catch(() => {
        cachedFetch(`${BASE}/api/1.0/stores`)
          .then((list) => setStores(list.filter((s) => Number(s.isActive) === 1)))
          .catch(() => {})
      })
  }, [])

  useEffect(() => {
    const cacheKey = 'lootradar_usd_inr_rate'
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null')
      if (cached && Date.now() - cached.time < 24 * 60 * 60 * 1000 && Number(cached.rate) > 0) {
        setInrRate(Number(cached.rate))
        return undefined
      }
    } catch {}
    let cancelled = false
    fetch('https://open.er-api.com/v6/latest/USD')
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => {
        const rate = Number(data?.rates?.INR)
        if (!cancelled && rate > 0) {
          setInrRate(rate)
          try { localStorage.setItem(cacheKey, JSON.stringify({ time: Date.now(), rate })) } catch {}
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
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
        let data = null
        if (!store) {
          try {
            const snapshotResponse = await fetch('/data/cheapshark-deals.json')
            if (snapshotResponse.ok) {
              const snapshot = await snapshotResponse.json()
              data = Array.isArray(snapshot.deals) ? snapshot.deals : null
            }
          } catch {
            data = null
          }
        }
        if (!data) data = await cachedFetch(`${BASE}/api/1.0/deals?${p}`)
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
    () => deals.filter((d) => {
      const isExtra = /(\bdlc\b|downloadable content|upgrade|supporter|bundle|\bpack\b)/i.test(d.title || '')
      return Number(d.savings) >= Number(minDiscount) && Number(d.salePrice) <= Number(maxPrice) && (showExtras || !isExtra)
    }),
    [deals, minDiscount, maxPrice, showExtras]
  )

  useEffect(() => {
    onAvailabilityChange(shown)
  }, [onAvailabilityChange, shown])

  return (
    <section className="deals-redesign">
      <header className="redesign-page-header">
        <div>
          <span className="lr-section-heading__kicker">PC STORE DEALS</span>
          <h1>Game <strong>Deals</strong></h1>
        </div>
        <span className="lr-badge">{shown.length} deals</span>
      </header>
      <div className="deals-filter-grid" aria-label="Filter deals">
        <select className={selectClass} value={store} onChange={(e) => setStore(e.target.value)}>
          <option value="">All stores</option>
          {stores.map((s) => (
            <option key={s.storeID} value={s.storeID}>
              {s.storeName}
            </option>
          ))}
        </select>

        <label className="deals-price-range">Under ${maxPrice} USD
          <input type="range" min="5" max="100" step="5" value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} />
        </label>

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

      <div className="deals-display-controls">
        <label className="settings-toggle"><input type="checkbox" checked={showExtras} onChange={(event) => setShowExtras(event.target.checked)} /> Show DLC/Extras</label>
        <div className="deals-currency-switch" aria-label="Display currency"><button type="button" className={currency === 'USD' ? 'is-selected' : ''} onClick={() => setCurrency('USD')}>USD</button><button type="button" className={currency === 'INR' ? 'is-selected' : ''} onClick={() => setCurrency('INR')}>INR</button></div>
      </div>

      <p className="currency-note deals-currency-note">Prices are supplied by CheapShark in USD{currency === 'INR' && inrRate ? ', converted for display using ExchangeRate-API (cached for 24 hours).' : '.'}</p>

      {error && (
        <div className="inline-error" role="alert">
          {error}{' '}
          <button onClick={() => setReload((n) => n + 1)} className="underline">
            Retry
          </button>
        </div>
      )}

      <div className="game-grid deals-grid">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
          : shown.map((d) => (
              <DealCard
                key={d.dealID}
                deal={d}
                storeName={storeName(d.storeID)}
                getGameActions={getGameActions}
                currency={currency}
                inrRate={inrRate}
                onGameOpen={onGameOpen}
              />
            ))}
      </div>

      {!loading && !error && shown.length === 0 && (
        <p className="empty-state">
          No deals match these filters. Try a higher price or lower discount.
        </p>
      )}
    </section>
  )
}
