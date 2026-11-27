import SafeImage from './SafeImage'
import {
  formatStoreName,
  formatDealPrice,
  formatDealExpiry,
  formatDealTitle,
} from '../lib/dealsData'
import {
  FlameIcon,
  HeartIcon,
  CheckIcon,
  PcIcon,
  StoreIcon,
} from './icons'

export default function DealCard({
  deal,
  getGameActions,
}) {
  if (!deal || !deal.itadId) return null

  const resolvedStore = formatStoreName(deal.shop?.name || 'PC Store')
  const discount = Math.round(Number(deal.cut || 0))
  const salePrice = Number(deal.price || 0)
  const regularPrice = Number(deal.regular || 0)
  const expiryLabel = formatDealExpiry(deal.expiry)
  const displayTitle = formatDealTitle(deal.title) || deal.title || 'Game'

  const actions =
    typeof getGameActions === 'function'
      ? getGameActions({
          title: deal.title || 'Game',
          platform: resolvedStore,
          image: deal.image,
          source: 'deal',
          sourceId: deal.itadId,
          url: deal.url,
        })
      : { owned: false, wishlisted: false, onToggleOwned: () => {}, onToggleWishlist: () => {} }

  return (
    <article className="deal-card-redesign" data-testid="deal-card">
      {/* Background Image covering entire card */}
      <div className="deal-card__media">
        <SafeImage
          steamAppID={deal.steamAppId}
          src={deal.image}
          alt={displayTitle}
          className="deal-card__image"
          fallbackText={displayTitle.slice(0, 1)}
        />
      </div>

      {/* Dark gradient fade over bottom of image */}
      <div className="deal-card__fade" aria-hidden="true" />

      {/* Top-left: green discount badge */}
      {discount > 0 && (
        <span className="deal-card__badge-discount">-{discount}%</span>
      )}

      {/* Top-right: wishlist heart button */}
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

      {/* Overlay content over the bottom fade */}
      <div className="deal-card__body">
        {deal.isLowestEver ? (
          <div className="deal-card__badge-row">
            <span className="deal-card__flag deal-card__flag--lowest">
              <FlameIcon gradient={false} size={13} /> Lowest ever
            </span>
          </div>
        ) : deal.isNewLow ? (
          <div className="deal-card__badge-row">
            <span className="deal-card__flag deal-card__flag--great">
              New low
            </span>
          </div>
        ) : null}

        <h3 className="deal-card__title" title={deal.title}>
          {displayTitle}
        </h3>

        <div className="deal-card__meta-row">
          <div className="deal-card__platform-store">
            <PcIcon size={14} className="deal-card__pc-icon" />
            <span className="deal-card__store-chip">
              <StoreIcon store={resolvedStore} size={13} />
              {resolvedStore}
            </span>
          </div>
          {expiryLabel && (
            <span className="deal-card__expiry">{expiryLabel}</span>
          )}
        </div>

        <div className="deal-card__prices-row">
          <strong className="deal-card__sale-price">
            {formatDealPrice(salePrice)}
          </strong>
          {regularPrice > salePrice && (
            <del className="deal-card__old-price">
              {formatDealPrice(regularPrice)}
            </del>
          )}
        </div>

        <div className="deal-card__actions-row">
          <a
            href={deal.url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="deal-card__cta-btn"
            onClick={(e) => {
              if (!deal.url || deal.url === '#') e.preventDefault()
            }}
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
