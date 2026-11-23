import { useMemo, useState } from 'react'
import {
  STORE_NAMES,
  formatStoreName,
  money,
  getDealImageUrl,
  selectTopDeals,
  useTopDeals,
} from '../lib/dealsData'

function DealImage({ deal }) {
  const steamUrl =
    deal.steamAppID && deal.steamAppID !== '0' && deal.steamAppID !== 'null'
      ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${deal.steamAppID}/header.jpg`
      : null

  const [currentSrc, setCurrentSrc] = useState(steamUrl || deal.thumb)
  const [hasError, setHasError] = useState(false)

  const handleError = () => {
    if (currentSrc === steamUrl && deal.thumb) {
      setCurrentSrc(deal.thumb)
    } else {
      setHasError(true)
    }
  }

  if (hasError || !currentSrc) {
    const initial = (deal.title || 'D').trim().charAt(0).toUpperCase()
    return (
      <div className="deal-card__fallback lr-art-fallback" aria-hidden="true">
        {initial}
      </div>
    )
  }

  return (
    <img
      src={currentSrc}
      alt=""
      loading="lazy"
      decoding="async"
      onError={handleError}
      className="deal-card__img"
    />
  )
}

function DealCard({ deal, stores = [], getGameActions }) {
  const storeLabel = useMemo(() => {
    if (!deal) return 'PC Store'
    const raw =
      (Array.isArray(stores)
        ? stores.find((s) => String(s?.storeID) === String(deal.storeID))?.storeName
        : null) ||
      STORE_NAMES[String(deal.storeID)] ||
      'PC Store'
    return formatStoreName(raw)
  }, [deal?.storeID, stores])

  if (!deal || !deal.dealID) return null

  const discount = Math.round(Number(deal.savings || 0))
  const salePrice = Number(deal.salePrice || 0)
  const normalPrice = Number(deal.normalPrice || 0)
  const dealRating = Number(deal.dealRating || 0)
  const steamRating = Number(deal.steamRatingPercent || 0)
  const metacritic = Number(deal.metacriticScore || 0)

  const actions =
    typeof getGameActions === 'function'
      ? getGameActions({
          title: deal.title || 'Game',
          platform: storeLabel,
          image: getDealImageUrl(deal),
          source: 'deal',
          sourceId: deal.dealID,
        })
      : { wishlisted: false, onToggleWishlist: () => {} }

  return (
    <a
      href={`https://www.cheapshark.com/redirect?dealID=${deal.dealID}`}
      target="_blank"
      rel="noopener noreferrer"
      className="deal-card"
    >
      <div className="deal-card__media">
        <DealImage deal={deal} />
        {discount >= 5 && (
          <span className="deal-card__badge deal-card__badge--discount">
            -{discount}%
          </span>
        )}
        <span className="deal-card__badge deal-card__badge--store">
          {storeLabel}
        </span>
        <button
          type="button"
          className={`deal-card__wishlist ${actions.wishlisted ? 'is-active' : ''}`}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            actions.onToggleWishlist()
          }}
          aria-label={`${actions.wishlisted ? 'Remove from' : 'Add to'} wishlist: ${deal.title}`}
          title={actions.wishlisted ? 'In Wishlist' : 'Add to Wishlist'}
        >
          <svg
            viewBox="0 0 24 24"
            width="15"
            height="15"
            fill={actions.wishlisted ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>

      <div className="deal-card__body">
        <h3 className="deal-card__title" title={deal.title}>
          {deal.title}
        </h3>

        <div className="deal-card__prices">
          {salePrice === 0 ? (
            <>
              <span className="deal-card__free">Free</span>
              {normalPrice > 0 && (
                <del className="deal-card__old-price">{money(normalPrice)}</del>
              )}
            </>
          ) : (
            <>
              <strong className="deal-card__sale-price">{money(salePrice)}</strong>
              {normalPrice > salePrice && (
                <del className="deal-card__old-price">{money(normalPrice)}</del>
              )}
            </>
          )}
        </div>

        <div className="deal-card__meta">
          {steamRating > 0 ? (
            <span
              className="deal-card__rating deal-card__rating--steam"
              title={`Steam reviews: ${steamRating}% positive`}
            >
              ★ {steamRating}%
            </span>
          ) : metacritic > 0 ? (
            <span
              className="deal-card__rating deal-card__rating--meta"
              title={`Metacritic score: ${metacritic}`}
            >
              MC {metacritic}
            </span>
          ) : null}

          {dealRating >= 8 && (
            <span
              className="deal-card__chip deal-card__chip--great"
              title={`Deal rating: ${dealRating.toFixed(1)}/10`}
            >
              Great deal
            </span>
          )}
        </div>
      </div>
    </a>
  )
}

export default function TopDeals({ getGameActions, onNavigate }) {
  const { deals, stores, loading, error, reload } = useTopDeals()
  const topDeals = useMemo(() => selectTopDeals(deals), [deals])

  return (
    <section className="top-deals" aria-labelledby="top-deals-heading">
      <header className="lr-section-heading">
        <div className="lr-section-heading__copy">
          <span className="lr-section-heading__kicker">PC SAVINGS</span>
          <h2 id="top-deals-heading">
            Top <strong>Deals</strong>
          </h2>
        </div>
        <button
          type="button"
          className="lr-button lr-button--ghost"
          onClick={() => onNavigate('deals')}
        >
          View All
        </button>
      </header>

      <div className="top-deals__row" aria-busy={loading}>
        {loading &&
          Array.from({ length: 8 }, (_, index) => (
            <div
              className="top-deals__skeleton lr-skeleton"
              key={index}
              aria-hidden="true"
            />
          ))}

        {!loading &&
          topDeals.map((deal) => (
            <DealCard
              key={deal.dealID}
              deal={deal}
              stores={stores}
              getGameActions={getGameActions}
            />
          ))}

        {!loading && (topDeals.length === 0 || error) && (
          <div className="top-deals__empty">
            <p>Could not load PC deals right now.</p>
            <button
              type="button"
              className="lr-button lr-button--secondary"
              onClick={reload}
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
