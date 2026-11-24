import SafeImage from './SafeImage'
import {
  formatStoreName,
  STORE_NAMES,
  formatDealPrice,
  getDealFlag,
} from '../lib/dealsData'

function FlameIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="12"
      height="12"
      fill="currentColor"
      className="deal-card__flag-icon"
      aria-hidden="true"
    >
      <path d="M12 2c-.5 2.5-2.5 4.5-4.5 6-2 1.5-3.5 4-3.5 7 0 4.4 3.6 8 8 8s8-3.6 8-8c0-3.5-2-6.5-4-8.5-.5 2-1.5 3.5-3 4.5C13 8 13.5 4.5 12 2z" />
    </svg>
  )
}

function HeartIcon({ active }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="deal-card__action-svg"
      aria-hidden="true"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

function CheckIcon({ active }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? '2.5' : '2'}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="deal-card__action-svg"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function PcIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="deal-card__pc-icon"
      aria-hidden="true"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  )
}

export default function DealCard({
  deal,
  storeName,
  getGameActions,
  lowestPrice = null,
  lowestLoading = false,
  currency = 'USD',
  inrRate = null,
}) {
  if (!deal || !deal.dealID) return null

  const resolvedStore =
    storeName ||
    STORE_NAMES[String(deal.storeID)] ||
    formatStoreName(deal.storeName) ||
    'PC Store'

  const discount = Math.round(Number(deal.savings || 0))
  const salePrice = Number(deal.salePrice || 0)
  const normalPrice = Number(deal.normalPrice || 0)
  const dealRating = Number(deal.dealRating || 0)
  const steamRating = Number(deal.steamRatingPercent || 0)
  const metacritic = Number(deal.metacriticScore || 0)

  // Flag logic (lowest ever or great deal)
  const flag = getDealFlag(salePrice, lowestPrice, dealRating, discount)

  // Wishlist & Owned actions
  const actions =
    typeof getGameActions === 'function'
      ? getGameActions({
          title: deal.title || 'Game',
          platform: resolvedStore,
          image: deal.thumb,
          source: 'deal',
          sourceId: deal.dealID,
        })
      : { owned: false, wishlisted: false, onToggleOwned: () => {}, onToggleWishlist: () => {} }

  const redirectUrl = `https://www.cheapshark.com/redirect?dealID=${deal.dealID}`

  return (
    <article className="deal-card-redesign">
      {/* 16:9 Media with SafeImage */}
      <div className="deal-card__media">
        <SafeImage
          steamAppID={deal.steamAppID}
          src={deal.thumb}
          alt={deal.title}
          className="deal-card__image"
          fallbackText={deal.title?.slice(0, 1)}
        />

        {/* Top-Left: Discount Badge */}
        {discount > 0 && (
          <span className="deal-card__badge-discount">-{discount}%</span>
        )}

        {/* Top-Right: Wishlist Heart */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            actions.onToggleWishlist()
          }}
          className={`deal-card__heart-btn ${actions.wishlisted ? 'is-active' : ''}`}
          aria-label={actions.wishlisted ? `Remove ${deal.title} from wishlist` : `Add ${deal.title} to wishlist`}
          title={actions.wishlisted ? 'In Wishlist' : 'Add to Wishlist'}
        >
          <HeartIcon active={actions.wishlisted} />
        </button>

        {/* Bottom-Left: Lowest Ever or Great Deal Flag */}
        {flag === 'lowest' && (
          <span className="deal-card__flag deal-card__flag--lowest">
            <FlameIcon /> Lowest ever
          </span>
        )}
        {flag === 'great' && (
          <span className="deal-card__flag deal-card__flag--great">
            Great deal
          </span>
        )}
      </div>

      {/* Body: Title, Store, Ratings, Price, Lowest info, Actions */}
      <div className="deal-card__body">
        <h3 className="deal-card__title" title={deal.title}>
          {deal.title}
        </h3>

        {/* Meta Row: PC icon, Store chip, and Rating */}
        <div className="deal-card__meta-row">
          <div className="deal-card__platform-store">
            <PcIcon />
            <span className="deal-card__store-chip">{resolvedStore}</span>
          </div>
          <div className="deal-card__rating-box">
            {steamRating > 0 ? (
              <span
                className="deal-card__rating deal-card__rating--steam"
                title={`Steam positive reviews: ${steamRating}%`}
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
          </div>
        </div>

        {/* Prices Row */}
        <div className="deal-card__prices-row">
          <strong className="deal-card__sale-price">
            {formatDealPrice(salePrice, currency, inrRate)}
          </strong>
          {normalPrice > salePrice && (
            <del className="deal-card__old-price">
              {formatDealPrice(normalPrice, currency, inrRate)}
            </del>
          )}
        </div>

        {/* Lowest Ever Historical Line */}
        <div className="deal-card__lowest-line">
          {lowestPrice != null && Number.isFinite(Number(lowestPrice)) ? (
            <span>Lowest ever {formatDealPrice(lowestPrice, currency, inrRate)}</span>
          ) : lowestLoading ? (
            <span className="deal-card__lowest-muted">Checking lowest price...</span>
          ) : (
            <span className="deal-card__lowest-muted">Lowest price not available</span>
          )}
        </div>

        {/* Bottom Actions Row */}
        <div className="deal-card__actions-row">
          <a
            href={redirectUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="deal-card__cta-btn"
          >
            Get deal
          </a>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              actions.onToggleOwned()
            }}
            className={`deal-card__owned-btn ${actions.owned ? 'is-active' : ''}`}
            aria-label={actions.owned ? `Mark ${deal.title} as not owned` : `Mark ${deal.title} as owned`}
            title={actions.owned ? 'Owned in Library' : 'I own this'}
          >
            <CheckIcon active={actions.owned} />
          </button>
        </div>
      </div>
    </article>
  )
}
