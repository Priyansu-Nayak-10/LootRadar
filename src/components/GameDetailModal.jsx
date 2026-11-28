import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import SafeImage from './SafeImage'
import { rawgImage } from '../lib/rawgImage'
import TimeLeft from './TimeLeft'
import PlatformIcons from './PlatformIcons'
import {
  CloseIcon,
  HeartIcon,
  CheckIcon,
  ExternalLinkIcon,
  FlameIcon,
  StarIcon,
  InfoIcon,
  AlertTriangleIcon,
} from './icons'
import { resolveGameOffer, fetchLiveItadPrice } from '../lib/gameOffer'
import { fetchGameStores, hasRawgKey } from '../lib/discoverApi'
import { canonicalStoreName, normalizeRawgStore, sortStoresByPriority } from '../lib/rawgStores'
import { formatTimeLeft } from '../lib/freeGames'
import { formatDealExpiry } from '../lib/dealsData'

export default function GameDetailModal({
  game,
  onClose,
  triggerRef,
  getGameActions,
  sources = {},
}) {
  const dialogRef = useRef(null)
  const closeBtnRef = useRef(null)

  const [stores, setStores] = useState(() => {
    if (Array.isArray(game?.stores) && game.stores.length > 0) {
      return game.stores.map(normalizeRawgStore).filter(Boolean)
    }
    return []
  })
  const [storesLoading, setStoresLoading] = useState(false)
  const [storesError, setStoresError] = useState(false)

  const [livePrice, setLivePrice] = useState(null)
  const [livePriceLoading, setLivePriceLoading] = useState(false)
  const [livePriceError, setLivePriceError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)
  const [closing, setClosing] = useState(false)
  const closeTimerRef = useRef(null)

  const requestClose = useCallback(() => {
    if (closing) return
    const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      onClose()
      return
    }
    setClosing(true)
    closeTimerRef.current = window.setTimeout(() => {
      onClose()
    }, 140)
  }, [closing, onClose])

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current)
      }
    }
  }, [])

  // 1. Resolve offer with available synchronous sources + RAWG stores
  const offer = useMemo(() => {
    return resolveGameOffer(game, {
      ...sources,
      rawgStores: stores,
      livePrice,
      fetchError: livePriceError,
    })
  }, [game, sources, stores, livePrice, livePriceError])

  // 2. Lazy fetch live ITAD price only if game is not console and not resolved in static sources
  useEffect(() => {
    if (!game) return
    const rawTitle = game.name || game.title || ''
    if (!rawTitle) return

    // If already resolved by Giveaway, Always Free, Deals snapshot, or Console, no need to query live ITAD
    const quickCheck = resolveGameOffer(game, sources)
    if (
      quickCheck.type === 'console' ||
      quickCheck.type === 'free_now' ||
      quickCheck.type === 'always_free' ||
      quickCheck.type === 'deal'
    ) {
      setLivePriceLoading(false)
      return
    }

    let cancelled = false
    const controller = new AbortController()

    async function loadLivePrice() {
      setLivePriceLoading(true)
      setLivePriceError(null)
      try {
        const deal = await fetchLiveItadPrice(rawTitle, controller.signal)
        if (!cancelled) {
          setLivePrice(deal)
          setLivePriceLoading(false)
        }
      } catch (err) {
        if (!cancelled && err.name !== 'AbortError') {
          setLivePriceError(err.message || 'Price lookup failed')
          setLivePriceLoading(false)
        }
      }
    }

    loadLivePrice()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [game, sources, retryCount])

  // 3. Lazy fetch RAWG stores if URLs are missing from list response
  useEffect(() => {
    if (!game?.id) return
    const hasUrls = Array.isArray(game.stores) && game.stores.some((s) => Boolean(s?.url))
    if (hasUrls) {
      setStoresLoading(false)
      setStoresError(false)
      return
    }

    let cancelled = false
    const controller = new AbortController()

    async function loadStores() {
      setStoresLoading(true)
      setStoresError(false)
      try {
        const results = await fetchGameStores(game.id, controller.signal)
        if (!cancelled) {
          if (Array.isArray(results) && results.length > 0) {
            setStores(results)
          }
          setStoresLoading(false)
        }
      } catch (err) {
        if (!cancelled && err?.name !== 'AbortError') {
          setStoresError(true)
          setStoresLoading(false)
        }
      }
    }

    if (hasRawgKey) {
      loadStores()
    } else {
      setStoresLoading(false)
    }

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [game?.id, game?.stores])

  // 4. Combine stores from RAWG and resolved offer store, keeping URLs and priority
  const allStoreChips = useMemo(() => {
    const byName = new Map()
    for (const s of stores) {
      const item = typeof s === 'string' ? { storeId: null, name: canonicalStoreName(s) || s, url: null, key: `name:${s.toLowerCase()}` } : s
      if (!item?.name) continue
      const existing = byName.get(item.name)
      if (!existing || (!existing.url && item.url)) {
        byName.set(item.name, item)
      }
    }
    if (offer?.store && offer.store !== 'Store') {
      const canon = canonicalStoreName(offer.store) || offer.store
      if (!byName.has(canon)) {
        byName.set(canon, { storeId: null, name: offer.store, url: null, key: `offer:${canon.toLowerCase()}` })
      }
    }
    return sortStoresByPriority([...byName.values()], offer?.store)
  }, [stores, offer])

  // 5. Game actions (Wishlist and Owned state)
  const actions = useMemo(() => {
    if (getGameActions && game) {
      return getGameActions(game)
    }
    return {
      owned: false,
      wishlisted: false,
      onToggleOwned: () => {},
      onToggleWishlist: () => {},
    }
  }, [getGameActions, game])

  // 6. Keyboard handling (Escape to close, Focus Trap)
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        requestClose()
        return
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusable.length === 0) return

        const firstElement = focusable[0]
        const lastElement = focusable[focusable.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault()
            lastElement.focus()
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault()
            firstElement.focus()
          }
        }
      }
    },
    [requestClose]
  )

  // 7. Body scroll lock and focus management on mount/unmount
  useEffect(() => {
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Focus close button on open
    if (closeBtnRef.current) {
      closeBtnRef.current.focus()
    }

    // Browser back button close integration
    const handlePopState = () => {
      requestClose()
    }
    const triggerNode = triggerRef?.current
    window.history.pushState({ modal: 'game-detail' }, '')
    window.addEventListener('popstate', handlePopState)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('popstate', handlePopState)

      // Return focus to trigger
      if (triggerNode) {
        triggerNode.focus()
      }
    }
  }, [onClose, triggerRef])

  if (!game) return null

  const title = game.name || game.title || 'Game Details'
  const releaseYear = game.released ? game.released.slice(0, 4) : ''
  const rating = Number(game.rating) > 0 ? Number(game.rating).toFixed(1) : null
  const rawgUrl = game.slug
    ? `https://rawg.io/games/${game.slug}`
    : `https://rawg.io/games/${game.id}`

  const hasPlatforms = Array.isArray(game.platforms) && game.platforms.length > 0
  const isDealOrPrice = offer.type === 'deal' || offer.type === 'price'
  const isFree = offer.type === 'free_now' || offer.type === 'always_free'
  const ctaLabel =
    offer.type === 'free_now'
      ? 'Claim now'
      : offer.ctaText || 'Get deal'

  return (
    <div
      className={`game-modal-backdrop ${closing ? 'is-closing' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose()
      }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className={`game-modal-dialog ${closing ? 'is-closing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-detail-title"
        onKeyDown={handleKeyDown}
      >
        {/* 1. Header Art with Top-Right Controls */}
        <div className="game-modal-art">
          <SafeImage
            src={rawgImage(game.background_image || game.image, 640)}
            alt={title}
            className="game-modal-art__img"
            fallbackText={title.slice(0, 1)}
          />

          <div className="game-modal-art-actions">
            <button
              type="button"
              className={`wr-icon-btn wr-icon-btn--round ${actions.wishlisted ? 'is-on' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                actions.onToggleWishlist()
              }}
              aria-pressed={actions.wishlisted}
              aria-label={actions.wishlisted ? `Remove ${title} from wishlist` : `Add ${title} to wishlist`}
              title={actions.wishlisted ? 'Saved to Wishlist' : 'Add to Wishlist'}
            >
              <HeartIcon size={18} />
            </button>
            <button
              ref={closeBtnRef}
              type="button"
              className="wr-icon-btn wr-icon-btn--round"
              onClick={requestClose}
              aria-label="Close"
            >
              <CloseIcon size={18} />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="game-modal-body">
          {/* 2. Title, Year, Rating, Platforms */}
          <div className="game-modal-header">
            <h2 id="game-detail-title" className="wr-heading">
              {title}
            </h2>

            {(releaseYear || rating || hasPlatforms) && (
              <div className="game-modal-meta">
                {releaseYear && <span className="game-modal-year">{releaseYear}</span>}
                {releaseYear && (rating || hasPlatforms) && (
                  <span className="game-modal-sep" aria-hidden="true">&middot;</span>
                )}
                {rating && (
                  <span className="game-modal-rating" title={`Rating: ${rating}/5`}>
                    <StarIcon size={14} className="game-modal-rating-star" />
                    <span>{rating}</span>
                  </span>
                )}
                {rating && hasPlatforms && (
                  <span className="game-modal-sep" aria-hidden="true">&middot;</span>
                )}
                {hasPlatforms && (
                  <div className="game-modal-platforms" aria-label="Platforms">
                    <PlatformIcons platforms={game.platforms} size={16} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 3. Available On Store Chips */}
          {(storesLoading || storesError || allStoreChips.length > 0) && (
            <div className="game-modal-stores" aria-label="Available on stores">
              <span className="game-modal-stores-label">Available on</span>
              {storesLoading && allStoreChips.length === 0 ? (
                <div className="game-modal-chips-row" aria-busy="true">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="lr-skeleton"
                      style={{ width: 78, height: 28, borderRadius: 999, display: 'inline-block' }}
                    />
                  ))}
                </div>
              ) : allStoreChips.length > 0 ? (
                <div className="game-modal-chips-row">
                  {allStoreChips.map((chip) =>
                    chip.url ? (
                      <a
                        key={chip.key || chip.name}
                        href={chip.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="wr-store-chip wr-store-chip--link"
                      >
                        {chip.name} <ExternalLinkIcon size={12} />
                      </a>
                    ) : (
                      <span key={chip.key || chip.name} className="wr-store-chip">
                        {chip.name}
                      </span>
                    )
                  )}
                </div>
              ) : (
                <p className="game-modal-stores-muted">Store list unavailable</p>
              )}
            </div>
          )}

          {/* 4. Price Panel */}
          <div className="game-modal-price-block">
            {livePriceLoading ? (
              <div className="game-modal-price-skeleton" aria-busy="true" aria-label="Loading price" />
            ) : offer.type === 'console' ? (
              <p className="game-modal-notice-text">
                <InfoIcon size={16} />
                <span>{offer.message}</span>
              </p>
            ) : offer.type === 'error' ? (
              <>
                <p className="game-modal-notice-text game-modal-notice-text--error">
                  <AlertTriangleIcon size={16} />
                  <span>{offer.message}</span>
                </p>
                <button
                  type="button"
                  className="wr-chip game-modal-retry-btn"
                  onClick={() => setRetryCount((c) => c + 1)}
                >
                  Retry
                </button>
              </>
            ) : isDealOrPrice ? (
              <>
                <div className="game-modal-price-left">
                  {(offer.discount > 0 || offer.isLowestEver) && (
                    <div className="game-modal-price-badges">
                      {offer.discount > 0 && (
                        <span className="wr-badge wr-badge--discount">
                          -{offer.discount}%
                        </span>
                      )}
                      {offer.isLowestEver && (
                        <span className="wr-badge wr-badge--record" title="Lowest recorded price in India">
                          <FlameIcon gradient={false} size={13} /> Lowest ever
                        </span>
                      )}
                    </div>
                  )}
                  <div className="game-modal-price-values">
                    <b className="wr-price-sale">{offer.formattedPrice}</b>
                    {offer.formattedRegular && offer.discount > 0 && (
                      <s className="wr-price-old">{offer.formattedRegular}</s>
                    )}
                  </div>
                </div>
                {(offer.store || offer.expiry) && (
                  <div className="game-modal-price-right">
                    {offer.store && <span className="wr-store-chip">{offer.store}</span>}
                    {offer.expiry && (
                      <TimeLeft
                        endDate={offer.expiry}
                        label={formatDealExpiry(offer.expiry) || 'Ending soon'}
                      />
                    )}
                  </div>
                )}
              </>
            ) : isFree ? (
              <>
                <div className="game-modal-price-left">
                  <div className="game-modal-price-values">
                    <span className="game-modal-free-label">Free</span>
                    {offer.formattedRegular && (
                      <s className="wr-price-old">{offer.formattedRegular}</s>
                    )}
                  </div>
                </div>
                {(offer.store || offer.endDate) && (
                  <div className="game-modal-price-right">
                    {offer.store && <span className="wr-store-chip">{offer.store}</span>}
                    {offer.endDate && (
                      <TimeLeft
                        endDate={offer.endDate}
                        label={formatTimeLeft(offer.endDate)?.text || 'Ending soon'}
                      />
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="game-modal-notice-text">
                <InfoIcon size={16} />
                <span>No current price from tracked stores</span>
              </p>
            )}
          </div>

          {/* 5. Primary CTA and Owned Toggle */}
          <div className="game-modal-actions">
            {offer.ctaUrl ? (
              <a
                href={offer.ctaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="wr-cta"
              >
                {ctaLabel} <ExternalLinkIcon size={16} />
              </a>
            ) : (
              <span className="wr-cta wr-cta--disabled" aria-disabled="true">
                No store link available
              </span>
            )}

            <button
              type="button"
              className={`wr-cta wr-cta--secondary game-modal-owned-btn ${
                actions.owned ? 'is-on' : ''
              }`}
              onClick={actions.onToggleOwned}
              aria-pressed={actions.owned}
            >
              <CheckIcon size={16} /> {actions.owned ? 'Owned' : 'I own this'}
            </button>
          </div>

          {/* 6. RAWG Attribution */}
          <footer className="game-modal-footer">
            <a
              href={rawgUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="game-modal-rawg-link"
            >
              Data from RAWG <ExternalLinkIcon size={14} />
            </a>
          </footer>
        </div>
      </div>
    </div>
  )
}
