import { useEffect, useMemo, useRef, useState } from 'react'
import SafeImage from './SafeImage.jsx'
import { fetchRawgGames, hasRawgKey } from '../lib/discoverApi.js'
import { titleKey } from '../lib/wishlistAlerts.js'
import { formatDealPrice, matchDealForGame } from '../lib/dealsData.js'

// Platform ID filters for RAWG
const PLATFORM_CHIPS = [
  { label: 'All', value: 'All', id: '' },
  { label: 'PC', value: 'PC', id: '4' },
  { label: 'PlayStation', value: 'PlayStation', id: '187,18' },
  { label: 'Xbox', value: 'Xbox', id: '186,1' },
]

// ─── Inline Platform SVG Icons ────────────────────────────────────────────────
function PcIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="PC"
      title="PC"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  )
}

function PsIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-label="PlayStation"
      title="PlayStation"
    >
      <path d="M8.5 4.5c.3 0 .7.1 1 .2l7.2 2.7c1.3.5 2.3 1.6 2.3 3.1 0 1.7-1.3 3.1-3 3.1H14v6.9c0 .8-.7 1.5-1.5 1.5s-1.5-.7-1.5-1.5V13.6H9c-2.8 0-5-2.2-5-5s2.2-5 5-5h-.5zm5.5 6.1h2c.6 0 1-.4 1-1 0-.5-.4-.9-.9-1l-2.1-.8v2.8zm-5.5-3.1c-1.1 0-2 .9-2 2s.9 2 2 2h2V7.5h-2z" />
    </svg>
  )
}

function XboxIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="Xbox"
      title="Xbox"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m8.5 6 7 12M15.5 6l-7 12" />
    </svg>
  )
}

function HeartIcon({ filled }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  )
}

function StarIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

function ChevronLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

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

  const rawgUrl = game.slug
    ? `https://rawg.io/games/${game.slug}`
    : `https://rawg.io/games/${game.id}`

  return (
    <article className="popular-game-card" data-testid="popular-game-card">
      {/* 16:9 Media with SafeImage */}
      <div className="popular-game-card__art">
        <SafeImage
          src={game.background_image}
          alt={game.name}
          className="popular-game-card__img"
          fallbackText={game.name?.slice(0, 1)}
        />

        {/* Rank Number Badge Top-Left */}
        <span className="popular-game-card__rank">#{rank}</span>

        {/* Lime Price Badge for matched PC deals */}
        {dealMatch && Number(dealMatch.cut) > 0 && (
          <span className="popular-game-card__price-badge">
            -{Math.round(Number(dealMatch.cut))}%{' '}
            <span className="popular-game-card__price-val">
              {formatDealPrice(dealMatch.price)}
            </span>
          </span>
        )}

        {/* Wishlist Heart Top-Right */}
        <button
          type="button"
          className={`popular-game-card__heart ${actions.wishlisted ? 'is-active' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            actions.onToggleWishlist()
          }}
          aria-label={actions.wishlisted ? `Remove ${game.name} from wishlist` : `Add ${game.name} to wishlist`}
          title={actions.wishlisted ? 'Saved to Wishlist' : 'Add to Wishlist'}
        >
          <HeartIcon filled={actions.wishlisted} />
        </button>
      </div>

      {/* Body */}
      <div className="popular-game-card__body">
        <h3 className="popular-game-card__title" title={game.name}>
          <a
            href={rawgUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="popular-game-card__link"
          >
            {game.name}
          </a>
        </h3>

        {/* Meta Line: Star Rating + Genre */}
        <div className="popular-game-card__meta">
          {ratingVal && (
            <span className="popular-game-card__rating">
              <StarIcon /> {ratingVal}
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
          <span className="popular-games-section__kicker">TRENDING</span>
          <h2 id="popular-games-heading">
            Popular <strong>Games</strong>
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
                className={`popular-games-section__chip ${platform === chip.value ? 'is-active' : ''}`}
                onClick={() => setPlatform(chip.value)}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Desktop Arrow Buttons */}
          <div className="popular-games-section__arrows">
            <button
              type="button"
              className="popular-games-section__arrow"
              onClick={() => scroll('prev')}
              aria-label="Scroll left"
            >
              <ChevronLeftIcon />
            </button>
            <button
              type="button"
              className="popular-games-section__arrow"
              onClick={() => scroll('next')}
              aria-label="Scroll right"
            >
              <ChevronRightIcon />
            </button>
          </div>

          {/* View All */}
          <button
            type="button"
            className="lr-button lr-button--ghost popular-games-section__view-all"
            onClick={() => onNavigate('search')}
          >
            View All
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
            />
          ))}
        </div>
      )}
    </section>
  )
}
