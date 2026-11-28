import SafeImage from './SafeImage'
import TimeLeft from './TimeLeft'
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

      {/* Top row: discount badge, record/new-low badge, wishlist heart */}
      <div className="deal-card__tags">
        {discount > 0 && (
          <span className="wr-badge wr-badge--discount">-{discount}%</span>
        )}
        {deal.isLowestEver ? (
          <span
            className="wr-badge wr-badge--record"
            title="Lowest ever"
            aria-label="Lowest ever"
          >
            <FlameIcon gradient={false} size={12} />
            <span className="deal-card__flag-text">Lowest ever</span>
          </span>
        ) : deal.isNewLow ? (
          <span
            className="wr-badge wr-badge--accent"
            title="New low"
            aria-label="New low"
          >
            <span className="deal-card__flag-text">New low</span>
          </span>
        ) : null}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            actions.onToggleWishlist()
          }}
          className={`wr-icon-btn wr-icon-btn--round wr-icon-btn--sm ${actions.wishlisted ? 'is-on' : ''}`}
          aria-pressed={Boolean(actions.wishlisted)}
          aria-label={actions.wishlisted ? `Remove ${deal.title} from wishlist` : `Add ${deal.title} to wishlist`}
          title={actions.wishlisted ? 'In Wishlist' : 'Add to Wishlist'}
        >
          <HeartIcon />
        </button>
      </div>

      {/* Overlay content over the bottom fade */}
      <div className="deal-card__body">
        <h3 className="wr-title" title={deal.title}>
          {displayTitle}
        </h3>

        <div className="deal-card__meta-row">
          <span className="wr-store-chip">
            <StoreIcon store={resolvedStore} size={14} />
            {resolvedStore}
          </span>
          {expiryLabel ? (
            <TimeLeft endDate={deal.expiry} label={expiryLabel} />
          ) : null}
        </div>

        <div className="deal-card__prices-row">
          <strong className="wr-price-sale">
            {formatDealPrice(salePrice)}
          </strong>
          {regularPrice > salePrice && (
            <del className="wr-price-old">
              {formatDealPrice(regularPrice)}
            </del>
          )}
        </div>

        <div className="deal-card__actions-row">
          <a
            href={deal.url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="wr-cta"
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
            className={`wr-icon-btn ${actions.owned ? 'is-on' : ''}`}
            aria-pressed={Boolean(actions.owned)}
            aria-label={actions.owned ? `Remove ${deal.title} from owned` : `Mark ${deal.title} as owned`}
            title={actions.owned ? 'Owned in Library' : 'I own this'}
          >
            <CheckIcon />
          </button>
        </div>
      </div>
    </article>
  )
}
