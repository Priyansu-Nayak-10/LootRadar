import { useEffect, useMemo, useRef, useState } from 'react'
import SafeImage from './SafeImage.jsx'
import { fetchRawgGames, hasRawgKey } from '../lib/discoverApi.js'
import { titleKey } from '../lib/wishlistAlerts.js'
import { formatDealPrice, matchDealForGame } from '../lib/dealsData.js'
import {
  PcIcon,
  PlayStationIcon as PsIcon,
  XboxIcon,
  HeartIcon,
  StarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from './icons'

// Platform ID filters for RAWG
const PLATFORM_CHIPS = [
  { label: 'All', value: 'All', id: '' },
  { label: 'PC', value: 'PC', id: '4' },
  { label: 'PlayStation', value: 'PlayStation', id: '187,18' },
  { label: 'Xbox', value: 'Xbox', id: '186,1' },
]

function SetupHint() {
  return (
    <div className="api-setup-hint">
      <strong>Turn on game discovery</strong>
      <p>
        RAWG provides search, popularity, release dates, and game genres. Create a free personal API key,
        then add it to your local environment file.
      </p>
      <ol>
        <li>
          Get a key at <a href="https://rawg.io/apidocs" target="_blank" rel="noopener noreferrer">rawg.io/apidocs</a>.
        </li>
        <li>Create <code>.env.local</code> in the project folder.</li>
        <li>Add <code>VITE_RAWG_API_KEY=your_key_here</code> and restart <code>npm run dev</code>.</li>
      </ol>
      <small>Free plan: up to 20,000 requests per month for personal projects; link back to RAWG where its data is shown.</small>
    </div>
  )
}

// ─── Platform Icons Component ────────────────────────────────────────────────
function GamePlatformIcons({ game }) {
  const haystack = useMemo(() => {
    const list = []
    if (Array.isArray(game.parent_platforms)) {
      for (const p of game.parent_platforms) {
        if (p?.platform?.slug) list.push(p.platform.slug.toLowerCase())
        if (p?.platform?.name) list.push(p.platform.name.toLowerCase())
      }
    }
    if (Array.isArray(game.platforms)) {
      for (const p of game.platforms) {
        if (p?.platform?.slug) list.push(p.platform.slug.toLowerCase())
        if (p?.platform?.name) list.push(p.platform.name.toLowerCase())
      }
    }
    return list.join(' ')
  }, [game])

  const hasPc = haystack.includes('pc') || haystack.includes('windows')
  const hasPs = haystack.includes('playstation') || haystack.includes('ps')
  const hasXbox = haystack.includes('xbox')

  return (
    <div className="popular-game-card__platform-icons" aria-label="Available platforms">
      {hasPc && <PcIcon />}
      {hasPs && <PsIcon />}
      {hasXbox && <XboxIcon />}
    </div>
  )
}

// ─── Popular Game Card ────────────────────────────────────────────────────────
function PopularGameCard({
  game,
  rank,
  deals,
  getGameActions,
  onOpenGameDetail,
}) {
  const actions = getGameActions({
    title: game.name,
    platform: 'Multiplatform',
    image: game.background_image,
    source: 'rawg-popular',
    sourceId: game.id,
  })

  // Match ITAD deal by normalized title (edition-safe) or steamAppId
  const dealMatch = useMemo(() => {
    return matchDealForGame(game, deals)
  }, [deals, game])

  const genreName = game.genres?.[0]?.name || 'Action'
  const ratingVal = game.rating ? game.rating.toFixed(1) : null

  return (
    <article className="popular-game-card" data-testid="popular-game-card">
      {/* Full-bleed Media with SafeImage */}
      <div
        className="popular-game-card__art"
        role="button"
        tabIndex={0}
        onClick={(e) => onOpenGameDetail?.(game, e.currentTarget)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onOpenGameDetail?.(game, e.currentTarget)
          }
        }}
        style={{ cursor: 'pointer' }}
        aria-label={`View details for ${game.name}`}
      >
        <SafeImage
          src={game.background_image}
          alt={game.name}
          className="popular-game-card__img"
          fallbackText={game.name?.slice(0, 1)}
        />
      </div>

      {/* Top Row: Rank, Price Badge, Wishlist Heart */}
      <div className="popular-game-card__tags">
        <span className="wr-badge wr-badge--rank">#{rank}</span>

        {dealMatch && Number(dealMatch.cut) > 0 && (
          <span className="wr-badge wr-badge--discount popular-game-card__price-badge">
            -{Math.round(Number(dealMatch.cut))}% {formatDealPrice(dealMatch.price)}
          </span>
        )}

        <button
          type="button"
          className={`wr-icon-btn wr-icon-btn--sm wr-icon-btn--round ${actions.wishlisted ? 'is-on' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            actions.onToggleWishlist()
          }}
          aria-pressed={Boolean(actions.wishlisted)}
          aria-label={actions.wishlisted ? `Remove ${game.name} from wishlist` : `Add ${game.name} to wishlist`}
          title={actions.wishlisted ? 'Saved to Wishlist' : 'Add to Wishlist'}
        >
          <HeartIcon />
        </button>
      </div>

      {/* Body */}
      <div className="popular-game-card__body">
        <h3 className="wr-title" title={game.name}>
          <button
            type="button"
            className="popular-game-card__link popular-game-card__link-btn"
            onClick={(e) => {
              e.stopPropagation()
              onOpenGameDetail?.(game, e.currentTarget)
            }}
          >
            {game.name}
          </button>
        </h3>

        {/* Meta Line: Star Rating + Genre */}
        <div className="popular-game-card__meta">
          {ratingVal && (
            <span className="popular-game-card__rating">
              <StarIcon size={16} /> {ratingVal}
            </span>
          )}
          {ratingVal && <span className="popular-game-card__dot">·</span>}
          <span className="popular-game-card__genre">{genreName}</span>
        </div>

        {/* Footer: Platform Icons */}
        <div className="popular-game-card__footer">
          <GamePlatformIcons game={game} />
        </div>
      </div>
    </article>
  )
}

// ─── Main Section Component ──────────────────────────────────────────────────
export default function PopularGamesSection({
  deals = [],
  getGameActions = () => ({ owned: false, wishlisted: false, onToggleWishlist: () => {}, onToggleOwned: () => {} }),
  onNavigate = () => {},
  onOpenGameDetail,
}) {
  const [platform, setPlatform] = useState('All')
  const [gamesByPlatform, setGamesByPlatform] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isVisible, setIsVisible] = useState(false)

  const sectionRef = useRef(null)
  const scrollRowRef = useRef(null)

  // Lazy loading via IntersectionObserver
  useEffect(() => {
    if (!sectionRef.current || isVisible) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '300px' }
    )
    observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [isVisible])

  // Fetch games when visible and platform changes
  useEffect(() => {
    if (!isVisible || !hasRawgKey) return

    // If already loaded in state, don't refetch
    if (gamesByPlatform[platform]?.length > 0) return

    let cancelled = false
    const activeChip = PLATFORM_CHIPS.find((c) => c.value === platform) || PLATFORM_CHIPS[0]

    const loadGames = async () => {
      setLoading(true)
      setError('')
      try {
        const params = {
          ordering: '-added',
          page_size: '12',
          exclude_additions: 'true',
        }
        if (activeChip.id) {
          params.platforms = activeChip.id
        }

        const cacheLabel = `popular_v2_${platform.toLowerCase()}`
        const res = await fetchRawgGames(params, cacheLabel)
        const rawList = Array.isArray(res?.results) ? res.results : []

        // Drop items without images & dedupe by normalized title
        const seen = new Set()
        const cleaned = []
        for (const item of rawList) {
          if (!item || !item.name || !item.background_image) continue
          const k = titleKey(item.name)
          if (seen.has(k)) continue
          seen.add(k)
          cleaned.push(item)
          if (cleaned.length >= 12) break
        }

        if (!cancelled) {
          setGamesByPlatform((prev) => ({
            ...prev,
            [platform]: cleaned,
          }))
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Could not load popular games.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadGames()

    return () => {
      cancelled = true
    }
  }, [isVisible, platform, gamesByPlatform])

  // Horizontal scroll navigation
  const scroll = (direction) => {
    if (!scrollRowRef.current) return
    const container = scrollRowRef.current
    const scrollAmount = container.clientWidth * 0.75
    container.scrollBy({
      left: direction === 'next' ? scrollAmount : -scrollAmount,
      behavior: 'smooth',
    })
  }

  const currentList = gamesByPlatform[platform] || []

  const handleRetry = () => {
    setGamesByPlatform((prev) => ({ ...prev, [platform]: undefined }))
  }

  return (
    <section
      className="popular-games-section"
      ref={sectionRef}
      aria-labelledby="popular-games-heading"
    >
      <header className="popular-games-section__header">
        <div className="popular-games-section__header-left">
          <span className="popular-games-section__kicker">Trending</span>
          <h2 id="popular-games-heading" className="popular-games-section__title">
            Popular <em>Games</em>
          </h2>
          <p className="popular-games-section__sub">Most added to collections</p>
        </div>

        <div className="popular-games-section__controls">
          {/* Platform Filter Chips */}
          <div className="popular-games-section__chips" role="group" aria-label="Filter by platform">
            {PLATFORM_CHIPS.map((chip) => (
              <button
                key={chip.value}
                type="button"
                className={`wr-chip ${platform === chip.value ? 'is-active' : ''}`}
                onClick={() => setPlatform(chip.value)}
                aria-pressed={platform === chip.value}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Desktop Arrow Buttons */}
          <div className="popular-games-section__arrows">
            <button
              type="button"
              className="wr-icon-btn wr-icon-btn--round"
              onClick={() => scroll('prev')}
              aria-label="Scroll left"
            >
              <ChevronLeftIcon />
            </button>
            <button
              type="button"
              className="wr-icon-btn wr-icon-btn--round"
              onClick={() => scroll('next')}
              aria-label="Scroll right"
            >
              <ChevronRightIcon />
            </button>
          </div>

          {/* View All */}
          <button
            type="button"
            className="popular-games-section__view-all"
            onClick={() => onNavigate('search')}
          >
            View all
          </button>
        </div>
      </header>

      {/* Setup Hint if RAWG API key is not configured */}
      {!hasRawgKey && <SetupHint />}

      {/* Skeletons while loading */}
      {hasRawgKey && loading && currentList.length === 0 && (
        <div className="popular-games-section__row" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="popular-game-card-skeleton lr-skeleton" />
          ))}
        </div>
      )}

      {/* Error State */}
      {hasRawgKey && error && currentList.length === 0 && (
        <div className="popular-games-section__message">
          <p>{error}</p>
          <button
            type="button"
            className="lr-button lr-button--secondary"
            onClick={handleRetry}
          >
            Retry
          </button>
        </div>
      )}

      {/* Scrollable Game Cards */}
      {hasRawgKey && currentList.length > 0 && (
        <div className="popular-games-section__row" ref={scrollRowRef}>
          {currentList.map((game, idx) => (
            <PopularGameCard
              key={game.id}
              game={game}
              rank={idx + 1}
              deals={deals}
              getGameActions={getGameActions}
              onOpenGameDetail={onOpenGameDetail}
            />
          ))}
        </div>
      )}
    </section>
  )
}
