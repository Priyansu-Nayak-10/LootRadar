import { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchRawgGames, searchGamesMulti, hasRawgKey } from '../lib/discoverApi'
import { cleanNewsText, fetchNewsSnapshot, formatNewsRelativeTime } from '../lib/newsHelpers'
import GameActions from '../components/GameActions'
import TopDeals from '../components/TopDeals'
import PopularGamesSection from '../components/PopularGamesSection'
import ComingSoonSection from '../components/ComingSoonSection'
import SafeImage from '../components/SafeImage'
import {
  STORE_NAMES,
  formatStoreName,
  money,
  getDealImageUrl,
  selectHeroDeals,
  useTopDeals,
} from '../lib/dealsData'
import { cleanTitle, isMobile } from '../lib/freeGames'
import { lootRadarArt } from '../assets/art'

function dateString(date) {
  return date.toISOString().slice(0, 10)
}

function getDateRange(daysBack, daysAhead) {
  const today = new Date()
  const start = new Date(today)
  const end = new Date(today)
  start.setDate(start.getDate() - daysBack)
  end.setDate(end.getDate() + daysAhead)
  return `${dateString(start)},${dateString(end)}`
}

function formatDate(value) {
  if (!value || value === 'TBA') return 'Release date TBA'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return 'Release date TBA'
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function formatNewsDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
  }).format(date)
}

function formatRelativeTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000))
  if (minutes < 60) return `${minutes || 1}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatCountdown(endDate, now) {
  if (!endDate || endDate === 'N/A') return 'Limited Time'
  const cleanDate = endDate.includes('T') ? endDate : endDate.replace(' ', 'T') + 'Z'
  const end = new Date(cleanDate).getTime()
  if (Number.isNaN(end)) return 'Limited Time'
  const diff = end - (now || Date.now())
  if (diff <= 0) return 'Ended'
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  if (days > 0) return `${days}d ${hours}h left`
  if (hours > 0) return `${hours}h ${mins}m left`
  return `${mins}m left`
}

function PlatformIcons({ platforms }) {
  if (!Array.isArray(platforms)) return null
  const slugs = platforms.map((p) => (p.platform?.slug || p.platform?.name || '').toLowerCase())

  const icons = []
  const hasPC = slugs.some((s) => s.includes('pc') || s.includes('windows') || s.includes('linux') || s.includes('mac'))
  const hasPS = slugs.some((s) => s.includes('playstation') || s.includes('ps'))
  const hasXbox = slugs.some((s) => s.includes('xbox'))
  const hasNintendo = slugs.some((s) => s.includes('nintendo') || s.includes('switch') || s.includes('wii'))

  if (hasPC) {
    icons.push(
      <svg key="pc" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="platform-icon" title="PC" aria-label="PC">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    )
  }
  if (hasPS) {
    icons.push(
      <svg key="ps" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="platform-icon" title="PlayStation" aria-label="PlayStation">
        <rect x="2" y="6" width="20" height="12" rx="4" />
        <path d="M6 12h4m-2-2v4m7-3h.01m2.99 2h.01" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (hasXbox) {
    icons.push(
      <svg key="xbox" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="platform-icon" title="Xbox" aria-label="Xbox">
        <circle cx="12" cy="12" r="9" />
        <path d="m8.5 8.5 7 7m0-7-7 7" strokeLinecap="round" />
      </svg>
    )
  }
  if (hasNintendo) {
    icons.push(
      <svg key="nintendo" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="platform-icon" title="Nintendo" aria-label="Nintendo">
        <rect x="5" y="4" width="6" height="16" rx="3" />
        <rect x="13" y="4" width="6" height="16" rx="3" />
        <circle cx="8" cy="8" r="1" fill="currentColor" />
        <circle cx="16" cy="14" r="1" fill="currentColor" />
      </svg>
    )
  }

  return <>{icons.slice(0, 3)}</>
}

function GameTile({ game, badge, getGameActions }) {
  const platformNames = (game.platforms || [])
    .map((item) => item.platform?.name)
    .filter(Boolean)
    .slice(0, 3)
    .join(', ')

  const actions = getGameActions ? getGameActions({
    title: game.name,
    platform: platformNames || 'Multiple platforms',
    image: game.background_image,
    source: 'catalog',
    sourceId: game.id,
  }) : { owned: false, wishlisted: false, onToggleOwned: () => {}, onToggleWishlist: () => {} }

  const releaseYear = game.released ? game.released.slice(0, 4) : ''

  return (
    <article className="search-game-card">
      <a
        className="search-tile__main-link"
        href={`https://rawg.io/games/${game.slug}`}
        target="_blank"
        rel="noreferrer"
        aria-label={`View ${game.name} on RAWG`}
      >
        <div className="search-tile__media">
          <SafeImage
            src={game.background_image}
            alt=""
            loading="lazy"
            className="search-tile__image"
          />
          {badge && <span className="discovery-image-badge">{badge}</span>}
        </div>
        <div className="search-tile__content">
          <div className="search-tile__meta">
            {releaseYear && <span className="search-tile__year">{releaseYear}</span>}
            {releaseYear && Number(game.rating) > 0 && <span className="search-tile__sep">·</span>}
            {Number(game.rating) > 0 && (
              <span className="search-tile__rating">
                <span aria-hidden="true">★</span> {Number(game.rating).toFixed(1)}
              </span>
            )}
            <div className="search-tile__platforms" aria-label="Platforms">
              <PlatformIcons platforms={game.platforms} />
            </div>
          </div>
          <h3 className="search-tile__title" title={game.name}>
            {game.name}
          </h3>
          <div className="search-tile__genres">
            {(game.genres || []).slice(0, 2).map((genre) => (
              <span key={genre.id || genre.name} className="search-tile__genre-chip">
                {genre.name}
              </span>
            ))}
          </div>
        </div>
      </a>
      <div className="search-tile__actions">
        <button
          type="button"
          className={`search-tile__action-btn search-tile__action-btn--wishlist ${actions.wishlisted ? 'is-active' : ''}`}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            actions.onToggleWishlist()
          }}
          aria-label={actions.wishlisted ? `Remove ${game.name} from wishlist` : `Add ${game.name} to wishlist`}
          title={actions.wishlisted ? 'In wishlist' : 'Add to wishlist'}
        >
          <svg viewBox="0 0 24 24" fill={actions.wishlisted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
          </svg>
        </button>
        <button
          type="button"
          className={`search-tile__action-btn search-tile__action-btn--owned ${actions.owned ? 'is-active' : ''}`}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            actions.onToggleOwned()
          }}
          aria-label={actions.owned ? `Remove ${game.name} from library` : `Mark ${game.name} as owned`}
          title={actions.owned ? 'In library' : 'Mark as owned'}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </article>
  )
}

const SUGGESTED_SEARCHES = ['Spider-Man', 'Grand Theft Auto V', 'Elden Ring']
const SEARCH_PLATFORMS = ['All', 'PC', 'PlayStation', 'Xbox']

function SearchResultsView({
  searchTerm,
  searchResults,
  searchLoading,
  searchError,
  activePlatform,
  onSelectPlatform,
  onClearSearch,
  onSelectSuggestion,
  onRetry,
  getGameActions,
  hasKey,
}) {
  return (
    <div className="search-results-page">
      {!hasKey && <SetupHint />}

      <div className="search-results-header">
        <div className="search-results-heading">
          <span className="lr-section-heading__kicker">SEARCH RESULTS</span>
          <div className="search-results-title-row">
            <h1>
              Results for <strong>&ldquo;{searchTerm}&rdquo;</strong>
            </h1>
            <button
              type="button"
              className="search-clear-button"
              onClick={onClearSearch}
            >
              Clear search &times;
            </button>
          </div>
          {!searchLoading && !searchError && (
            <p className="search-results-meta">
              {searchResults.length} {searchResults.length === 1 ? 'game' : 'games'} found
              {activePlatform !== 'All' ? ` for ${activePlatform}` : ''}
            </p>
          )}
        </div>

        <div className="search-platform-filters" role="tablist" aria-label="Platform filters">
          {SEARCH_PLATFORMS.map((platform) => (
            <button
              key={platform}
              type="button"
              role="tab"
              aria-selected={activePlatform === platform}
              className={`search-filter-pill ${activePlatform === platform ? 'is-active' : ''}`}
              onClick={() => onSelectPlatform(platform)}
            >
              {platform}
            </button>
          ))}
        </div>
      </div>

      {searchLoading && (
        <div className="search-grid-loading" aria-label="Loading search results">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="search-tile-skeleton lr-skeleton" />
          ))}
        </div>
      )}

      {searchError && (
        <div className="search-error-state" role="alert">
          <p>{searchError}</p>
          <button type="button" className="lr-button" onClick={onRetry}>
            Retry search
          </button>
        </div>
      )}

      {!searchLoading && !searchError && searchResults.length === 0 && (
        <div className="search-empty-state">
          <div className="lr-art-fallback" aria-hidden="true">?</div>
          <h2>No games matched.</h2>
          <p>Try the full title or check the spelling.</p>
          <div className="search-suggestions">
            <span>Popular searches:</span>
            {SUGGESTED_SEARCHES.map((query) => (
              <button
                key={query}
                type="button"
                className="search-suggestion-link"
                onClick={() => onSelectSuggestion(query)}
              >
                {query}
              </button>
            ))}
          </div>
        </div>
      )}

      {!searchLoading && !searchError && searchResults.length > 0 && (
        <div className="search-results-grid">
          {searchResults.map((game) => (
            <GameTile
              key={game.id}
              game={game}
              getGameActions={getGameActions}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function NewsTile({ article }) {
  const [imageFailed, setImageFailed] = useState(false)

  return (
    <article className={`news-card ${article.image ? '' : 'is-no-image'}`}>
      {article.image && !imageFailed ? (
        <img
          src={article.image}
          alt=""
          loading="lazy"
          className="news-image"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="news-image-fallback" aria-hidden="true">RADAR</div>
      )}
      <div className="news-copy">
        <div className="news-meta">
          <span>{article.source || 'Gaming news'}</span>
          <span>{formatNewsDate(article.publishedAt)}</span>
        </div>
        <h3>{article.title}</h3>
        {article.summary && <p>{article.summary}</p>}
        <a href={article.link} target="_blank" rel="noreferrer" className="news-link">
          Read story <span aria-hidden="true">-&gt;</span>
        </a>
      </div>
    </article>
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
          Get a key at <a href="https://rawg.io/apidocs" target="_blank" rel="noreferrer">rawg.io/apidocs</a>.
        </li>
        <li>Create <code>.env.local</code> in the project folder.</li>
        <li>Add <code>VITE_RAWG_API_KEY=your_key_here</code> and restart <code>npm run dev</code>.</li>
      </ol>
      <small>Free plan: up to 20,000 requests per month for personal projects; link back to RAWG where its data is shown.</small>
    </div>
  )
}

function decodeText(value) {
  if (!value || typeof document === 'undefined') return value || ''
  const textArea = document.createElement('textarea')
  textArea.innerHTML = value
  return textArea.value
}

class HeroErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    if (import.meta.env?.DEV) {
      console.error('HeroErrorBoundary caught an error:', error, errorInfo)
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="home-hero-wrap">
          <div className="lr-art-fallback">LOOTRADAR</div>
          <div className="home-hero-overlay" />
          <div className="home-hero-copy">
            <span className="lr-badge lr-badge--lime">LOOTRADAR</span>
            <h1>Featured Gaming Radar</h1>
            <p>Track PC deals, free giveaways, and upcoming game alerts.</p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export function HomeRedesign({
  deals,
  dealsStores,
  dealsLoading,
  dealsError,
  freeGames,
  upcomingGames,
  news,
  newsLoading,
  newsUpdatedAt,
  onNavigate,
  getGameActions,
  searchSubmitted,
  searchLoading,
  searchError,
  searchTerm,
  searchResults,
  hasKey,
  session,
  wishlist = [],
}) {
  const [heroIndex, setHeroIndex] = useState(0)
  const heroCarouselRef = useRef(null)
  const heroIndexRef = useRef(0)
  const [isHovered, setIsHovered] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [isTouching, setIsTouching] = useState(false)
  const [isTabHidden, setIsTabHidden] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [now, setNow] = useState(Date.now())

  const newsPanelRef = useRef(null)
  const [newsPanelHeight, setNewsPanelHeight] = useState(null)

  // Live countdown ticker every 60s
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(id)
  }, [])

  // Listen to prefers-reduced-motion and tab visibility changes
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mediaQuery.matches)
    const handleMotion = (e) => setReducedMotion(e.matches)
    mediaQuery.addEventListener?.('change', handleMotion)

    const handleVisibility = () => {
      setIsTabHidden(document.visibilityState === 'hidden')
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      mediaQuery.removeEventListener?.('change', handleMotion)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  // Build the 5 normalized hero slides: [deal #1, free, deal #2, deal #3, upcoming]
  const heroSlides = useMemo(() => {
    try {
      if (!Array.isArray(deals) || deals.length === 0) return []

      const heroDeals = selectHeroDeals(deals, 5)
      if (!Array.isArray(heroDeals) || heroDeals.length === 0) return []

      const slides = []
      let nextDealIdx = 0

      const makeDealSlide = (deal, idPrefix = 'deal') => {
        if (!deal || typeof deal !== 'object' || !deal.title) return null
        const dealID = String(deal.dealID || idPrefix)
        const rawStore =
          (Array.isArray(dealsStores)
            ? dealsStores.find((s) => String(s?.storeID) === String(deal.storeID))?.storeName
            : null) ||
          STORE_NAMES[String(deal.storeID)] ||
          'PC Store'
        const store = formatStoreName(rawStore)
        const salePrice = Number(deal.salePrice || 0)
        const normalPrice = Number(deal.normalPrice || 0)
        const savings = Math.max(0, Math.round(Number(deal.savings || 0)))

        return {
          id: `${idPrefix}-${dealID}`,
          type: 'deal',
          title: deal.title,
          imageUrl: getDealImageUrl(deal) || deal.thumb || '',
          steamAppID: deal.steamAppID && deal.steamAppID !== '0' && deal.steamAppID !== 'null' ? String(deal.steamAppID) : null,
          badgeText: 'TOP DEAL',
          subtitle: store,
          price: {
            sale: Number.isFinite(salePrice) ? salePrice : 0,
            regular: Number.isFinite(normalPrice) ? normalPrice : 0,
            savings: Number.isFinite(savings) ? savings : 0,
          },
          actionLabel: 'View deal',
          actionUrl: `https://www.cheapshark.com/redirect?dealID=${dealID}`,
          isExternal: true,
          store,
          rawItem: deal,
        }
      }

      // 1. Deal #1
      if (heroDeals[nextDealIdx]) {
        const slide = makeDealSlide(heroDeals[nextDealIdx], 'deal-1')
        if (slide) slides.push(slide)
        nextDealIdx++
      }

      // 2. Free game (or 4th deal fallback)
      const activeFreeGames = (Array.isArray(freeGames) ? freeGames : [])
        .filter((game) => {
          if (!game || typeof game !== 'object' || !game.title) return false
          if (isMobile(game)) return false
          const thumb = game.thumbnail || game.image
          if (!thumb || !thumb.trim()) return false
          const endStr = game.end_date || game.endDate
          if (!endStr || endStr === 'N/A') return true
          const cleanDate = endStr.includes('T') ? endStr : endStr.replace(' ', 'T') + 'Z'
          const end = new Date(cleanDate).getTime()
          return Number.isNaN(end) || end > now
        })
        .sort((a, b) => {
          const parseTime = (dateStr) => {
            if (!dateStr || dateStr === 'N/A') return Infinity
            const clean = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z'
            const t = new Date(clean).getTime()
            return Number.isNaN(t) ? Infinity : t
          }
          return parseTime(a.end_date || a.endDate) - parseTime(b.end_date || b.endDate)
        })

      const chosenFree = activeFreeGames[0]
      if (chosenFree && chosenFree.title) {
        const cleanedFreeTitle = cleanTitle(chosenFree.title)
        slides.push({
          id: `free-${chosenFree.id || 'giveaway'}`,
          type: 'free',
          title: cleanedFreeTitle,
          imageUrl: chosenFree.image || chosenFree.thumbnail || '',
          badgeText: 'FREE NOW',
          subtitle: chosenFree.platforms || 'PC / DRM-Free',
          countdownEnd: chosenFree.end_date || chosenFree.endDate || '',
          actionLabel: 'Claim now',
          actionUrl: chosenFree.open_giveaway_url || chosenFree.gamerpower_url || 'https://www.gamerpower.com',
          isExternal: true,
          store: 'Giveaway',
          rawItem: chosenFree,
        })
      } else if (heroDeals[3]) {
        const slide = makeDealSlide(heroDeals[3], 'deal-fallback-free')
        if (slide) slides.push(slide)
      }

      // 3. Deal #2
      if (heroDeals[nextDealIdx]) {
        const slide = makeDealSlide(heroDeals[nextDealIdx], 'deal-2')
        if (slide) slides.push(slide)
        nextDealIdx++
      }

      // 4. Deal #3
      if (heroDeals[nextDealIdx]) {
        const slide = makeDealSlide(heroDeals[nextDealIdx], 'deal-3')
        if (slide) slides.push(slide)
        nextDealIdx++
      }

      // 5. Upcoming release (or 4th/5th deal fallback)
      const validUpcoming = (Array.isArray(upcomingGames) ? upcomingGames : [])
        .filter((game) => game && typeof game === 'object' && game.title && game.image && game.image.trim())
        .sort((a, b) => {
          const timeA = a.startDate ? new Date(a.startDate).getTime() : Infinity
          const timeB = b.startDate ? new Date(b.startDate).getTime() : Infinity
          return (Number.isNaN(timeA) ? Infinity : timeA) - (Number.isNaN(timeB) ? Infinity : timeB)
        })

      const chosenUpcoming = validUpcoming[0]
      if (chosenUpcoming && chosenUpcoming.title) {
        const releaseStr = formatDate(chosenUpcoming.startDate ? String(chosenUpcoming.startDate).slice(0, 10) : '')
        slides.push({
          id: `upcoming-${chosenUpcoming.id || 'upcoming'}`,
          type: 'upcoming',
          title: chosenUpcoming.title,
          imageUrl: chosenUpcoming.image || '',
          badgeText: 'COMING SOON',
          subtitle: releaseStr ? `Coming ${releaseStr}` : 'Coming Soon',
          actionLabel: 'Add to wishlist',
          actionUrl: chosenUpcoming.slug ? `https://store.epicgames.com/p/${chosenUpcoming.slug}` : 'https://store.epicgames.com',
          isExternal: false,
          store: 'Epic Games Store',
          rawItem: chosenUpcoming,
        })
      } else if (heroDeals[nextDealIdx] || heroDeals[4]) {
        const fallbackDeal = heroDeals[nextDealIdx] || heroDeals[4]
        const slide = makeDealSlide(fallbackDeal, 'deal-fallback-upcoming')
        if (slide) slides.push(slide)
      }

      return slides
    } catch (err) {
      if (import.meta.env?.DEV) {
        console.error('Error normalizing heroSlides:', err)
      }
      return []
    }
  }, [deals, dealsStores, freeGames, upcomingGames, now])

  const isPaused = isHovered || isFocused || isTouching || isTabHidden || reducedMotion

  function goToHero(index) {
    const carousel = heroCarouselRef.current
    if (!carousel || !heroSlides.length) return
    const safeIndex = (index + heroSlides.length) % heroSlides.length
    heroIndexRef.current = safeIndex
    setHeroIndex(safeIndex)
    carousel.scrollTo({
      left: safeIndex * carousel.clientWidth,
      behavior: 'smooth',
    })
  }

  // Autoplay every 6s, loops back to 0 smoothly
  useEffect(() => {
    const carousel = heroCarouselRef.current
    const count = heroSlides.length
    if (!carousel || isPaused || count < 2) return undefined

    const timer = window.setInterval(() => {
      const current = heroIndexRef.current
      const next = (current + 1) % count
      goToHero(next)
    }, 6000)

    return () => window.clearInterval(timer)
  }, [heroSlides.length, isPaused])

  // Sync heroIndex with actual scroll position
  useEffect(() => {
    const carousel = heroCarouselRef.current
    if (!carousel || typeof IntersectionObserver === 'undefined') return undefined

    const slideElements = carousel.querySelectorAll('.home-hero-slide')
    if (!slideElements.length) return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute('data-slide-index'))
            if (!Number.isNaN(index) && heroIndexRef.current !== index) {
              heroIndexRef.current = index
              setHeroIndex(index)
            }
          }
        }
      },
      { root: carousel, threshold: 0.55 }
    )

    slideElements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [heroSlides])

  function handleKeyDown(event) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      goToHero(heroIndex - 1)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      goToHero(heroIndex + 1)
    }
  }

  useEffect(() => {
    const panel = newsPanelRef.current
    if (!panel || typeof ResizeObserver === 'undefined') return undefined

    const syncPanelHeight = () => setNewsPanelHeight(Math.ceil(panel.getBoundingClientRect().height))
    const observer = new ResizeObserver(syncPanelHeight)
    syncPanelHeight()
    observer.observe(panel)
    return () => observer.disconnect()
  }, [])

  const matchedNewsPanelStyle = newsPanelHeight
    ? { '--home-news-panel-height': `${newsPanelHeight}px` }
    : undefined

  return (
    <div className="discover-page home-redesign">
      {!hasKey && <SetupHint />}

      <section className="home-feature-grid">
        <HeroErrorBoundary>
        <div
          className="home-hero-wrap"
          role="region"
          aria-roledescription="carousel"
          aria-label="Featured deals and games"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onFocusCapture={() => setIsFocused(true)}
          onBlurCapture={() => setIsFocused(false)}
          onTouchStart={() => setIsTouching(true)}
          onTouchEnd={() => setIsTouching(false)}
        >
          {dealsError && !heroSlides.length && (
            <p className="discover-error" role="alert">Could not load featured deals right now.</p>
          )}

          {dealsLoading && !heroSlides.length ? (
            <div className="lr-skeleton home-hero-skeleton" />
          ) : heroSlides.length > 0 ? (
            <>
              <div
                className="home-hero-carousel"
                id="home-hero-carousel"
                ref={heroCarouselRef}
              >
                {heroSlides.map((slide, index) => {
                  const isActive = heroIndex === index
                  const upcomingActions =
                    slide.type === 'upcoming' && getGameActions
                      ? getGameActions({
                          title: slide.title,
                          platform: slide.store || 'Epic Games Store',
                          image: slide.imageUrl,
                          source: 'upcoming',
                          sourceId: slide.rawItem?.id || slide.id,
                        })
                      : null

                  return (
                    <article
                      className="home-hero-slide"
                      key={slide.id}
                      data-slide-index={index}
                      role="group"
                      aria-roledescription="slide"
                      aria-label={`${index + 1} of ${heroSlides.length}`}
                      aria-hidden={!isActive}
                    >
                      <SafeImage
                        src={slide.imageUrl}
                        steamAppID={slide.steamAppID}
                        alt={slide.title}
                        loading={index === 0 ? 'eager' : 'lazy'}
                        className="home-hero-bg"
                      />
                      <div className="home-hero-overlay" />
                      <div className="home-hero-copy">
                        <span className="lr-badge lr-badge--lime">
                          {slide.badgeText}
                        </span>
                        <h1>{slide.title}</h1>

                        {slide.type === 'deal' && slide.price && (
                          <div className="home-hero-deal-info">
                            <div className="home-hero-prices">
                              {slide.price.savings > 0 && (
                                <span className="home-hero-discount">
                                  -{slide.price.savings}%
                                </span>
                              )}
                              <strong className="home-hero-sale-price">
                                {money(slide.price.sale)}
                              </strong>
                              {slide.price.regular > slide.price.sale && (
                                <del className="home-hero-old-price">
                                  {money(slide.price.regular)}
                                </del>
                              )}
                              {slide.store && (
                                <span className="home-hero-store-chip">
                                  {slide.store}
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {slide.type === 'free' && (
                          <p className="home-hero-meta">
                            <span className="home-hero-countdown">
                              {formatCountdown(slide.countdownEnd, now)}
                            </span>
                            <span className="home-hero-sep"> {'\u00b7'} </span>
                            <span>{slide.subtitle}</span>
                          </p>
                        )}

                        {slide.type === 'upcoming' && (
                          <p className="home-hero-meta">
                            <span>{slide.subtitle}</span>
                            {slide.store && (
                              <>
                                <span className="home-hero-sep"> {'\u00b7'} </span>
                                <span className="home-hero-store-chip">
                                  {slide.store}
                                </span>
                              </>
                            )}
                          </p>
                        )}

                        <div className="home-hero-action-row">
                          {slide.type === 'deal' && (
                            <a
                              href={slide.actionUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="lr-button"
                              tabIndex={isActive ? 0 : -1}
                            >
                              {slide.actionLabel}
                            </a>
                          )}

                          {slide.type === 'free' && (
                            <a
                              href={slide.actionUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="lr-button"
                              tabIndex={isActive ? 0 : -1}
                            >
                              {slide.actionLabel}
                            </a>
                          )}

                          {slide.type === 'upcoming' && (
                            upcomingActions ? (
                              <button
                                type="button"
                                className={`lr-button ${upcomingActions.wishlisted ? 'is-active' : ''}`}
                                tabIndex={isActive ? 0 : -1}
                                onClick={() => upcomingActions.onToggleWishlist()}
                              >
                                {upcomingActions.wishlisted ? 'In Wishlist' : 'Add to wishlist'}
                              </button>
                            ) : (
                              <a
                                href={slide.actionUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="lr-button"
                                tabIndex={isActive ? 0 : -1}
                              >
                                View details
                              </a>
                            )
                          )}
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>

              <div className="home-hero-controls">
                <button
                  type="button"
                  className="home-hero-arrow home-hero-arrow--prev"
                  aria-label="Previous slide"
                  onClick={() => goToHero(heroIndex - 1)}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>

                <div className="home-hero-dots" role="tablist" aria-label="Choose featured slide">
                  {heroSlides.map((slide, index) => (
                    <button
                      type="button"
                      key={slide.id}
                      role="tab"
                      aria-selected={heroIndex === index}
                      aria-label={`Slide ${index + 1}: ${slide.title}`}
                      className={heroIndex === index ? 'is-active' : ''}
                      onClick={() => goToHero(index)}
                    />
                  ))}
                </div>

                <span className="home-hero-counter" aria-hidden="true">
                  {heroIndex + 1} / {heroSlides.length}
                </span>

                <button
                  type="button"
                  className="home-hero-arrow home-hero-arrow--next"
                  aria-label="Next slide"
                  onClick={() => goToHero(heroIndex + 1)}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              </div>

              <div className="sr-only" aria-live={isPaused ? 'polite' : 'off'}>
                Slide {heroIndex + 1} of {heroSlides.length}: {heroSlides[heroIndex]?.title}
              </div>
            </>
          ) : (
            <div className="lr-skeleton home-hero-skeleton" />
          )}
        </div>
        </HeroErrorBoundary>

        <aside className="home-feature-side home-feature-side--free">
          <section className="home-side-card">
            <div className="lr-section-heading">
              <div className="lr-section-heading__copy">
                <span className="lr-section-heading__kicker">LIMITED TIME</span>
                <h2>Free <strong>Games</strong></h2>
              </div>
              <button type="button" className="lr-button lr-button--ghost" onClick={() => onNavigate('free')}>View All</button>
            </div>
            {(freeGames?.length || 0) > 0 ? (
              <div className="home-feature-free-list">
                {freeGames
                  .filter((game) => !isMobile(game))
                  .slice(0, 5)
                  .map((game) => {
                    const cleaned = cleanTitle(game.title)
                    return (
                      <a
                        key={game.id || cleaned}
                        href={game.open_giveaway_url || game.gamerpower_url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="home-feature-free"
                      >
                        {game.thumbnail || game.image ? (
                          <SafeImage
                            src={game.thumbnail || game.image}
                            alt={cleaned}
                            fallbackText={cleaned.slice(0, 1)}
                          />
                        ) : (
                          <div className="lr-art-fallback">FREE GAME</div>
                        )}
                        <span>
                          <strong>{cleaned}</strong>
                          <small>{formatCountdown(game.end_date || game.endDate, now)}</small>
                        </span>
                      </a>
                    )
                  })}
              </div>
            ) : (
              <div className="lr-skeleton" />
            )}
          </section>
        </aside>
      </section>

      <TopDeals getGameActions={getGameActions} onNavigate={onNavigate} />

      <PopularGamesSection
        deals={deals}
        getGameActions={getGameActions}
        onNavigate={onNavigate}
      />

      <ComingSoonSection
        getGameActions={getGameActions}
        onNavigate={onNavigate}
      />

      <section className="discover-section home-news-grid" ref={newsPanelRef}>
        <div className="lr-section-heading">
          <div className="lr-section-heading__copy">
            <span className="lr-section-heading__kicker">LATEST FROM THE INDUSTRY</span>
            <h2>Latest <strong>News</strong></h2>
          </div>
          <button type="button" className="lr-button lr-button--ghost" onClick={() => onNavigate('news')}>View All</button>
        </div>
        {newsLoading ? (
          <div className="lr-skeleton" />
        ) : (news?.length || 0) > 0 ? (
          <div className="home-news-layout">
            <article className="home-news-feature">
              {news[0].image ? (
                <SafeImage
                  src={news[0].image}
                  alt={cleanNewsText(news[0].title)}
                  fallbackText="RADAR"
                />
              ) : (
                <div className="lr-art-fallback">RADAR</div>
              )}
              <div>
                <span>{news[0].source} {'\u00b7'} {formatNewsRelativeTime(news[0].publishedAt)}</span>
                <h3>{cleanNewsText(news[0].title)}</h3>
                <a href={news[0].link} target="_blank" rel="noopener noreferrer" className="lr-button lr-button--ghost">Read Full Story</a>
              </div>
            </article>
            <div className="home-news-small">
              {news.slice(1, 3).map((article) => {
                const headline = cleanNewsText(article.title)
                return (
                  <article key={article.id || article.link}>
                    {article.image ? (
                      <SafeImage
                        src={article.image}
                        alt={headline}
                        fallbackText="RADAR"
                      />
                    ) : (
                      <div className="lr-art-fallback">RADAR</div>
                    )}
                    <div><span>{article.source} {'\u00b7'} {formatNewsRelativeTime(article.publishedAt)}</span><h3>{headline}</h3></div>
                    <a href={article.link} target="_blank" rel="noopener noreferrer" aria-label={`Read ${headline}`} />
                  </article>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="lr-empty">No recent stories are available.</div>
        )}
      </section>

      {session && (wishlist?.length || 0) > 0 && (
        <section className="home-wishlist-strip">
          <div className="lr-section-heading">
            <div className="lr-section-heading__copy">
              <span className="lr-section-heading__kicker">SAVED FOR LATER</span>
              <h2>Your <strong>Wishlist</strong></h2>
            </div>
            <button type="button" className="lr-button lr-button--ghost" onClick={() => onNavigate('wishlist')}>View All</button>
          </div>
          <div>
            {wishlist.slice(0, 5).map((game) => (
              <button
                type="button"
                className="home-wishlist-item"
                key={game.title}
                onClick={() => onNavigate('wishlist')}
              >
                {game.image ? <img src={game.image} alt="" loading="lazy" /> : <div className="lr-art-fallback">{game.title.slice(0, 1).toUpperCase()}</div>}
                <span>{game.title}</span>
              </button>
            ))}
          </div>
        </section>
      )}
      <section className="home-promo-banner" style={matchedNewsPanelStyle} onClick={() => onNavigate('account')}>
          {lootRadarArt.promo.src ? <img src={lootRadarArt.promo.src} alt={lootRadarArt.promo.alt} loading="lazy" /> : <span className="home-promo-radar" aria-hidden="true" />}
          <span><small>LOOTRADAR ALERTS</small><strong>Connect Telegram, never miss a free game</strong><em>Connect Telegram</em></span>
      </section>
    </div>
  )
}

export default function Discover({
  library,
  wishlist,
  session,
  getGameActions,
  onNavigate,
  isSearchPage = false,
  searchQuery = '',
  searchCategory = 'All',
  onSearchChange,
}) {
  const {
    deals,
    stores: dealsStores,
    loading: dealsLoading,
    error: dealsError,
  } = useTopDeals()

  const [news, setNews] = useState([])
  const [newsUpdatedAt, setNewsUpdatedAt] = useState('')
  const [newsError, setNewsError] = useState('')
  const [newsLoading, setNewsLoading] = useState(true)

  // Search state
  const [searchTerm, setSearchTerm] = useState(searchQuery || '')
  const [activePlatform, setActivePlatform] = useState(searchCategory || 'All')
  const [searchResults, setSearchResults] = useState([])
  const [searchError, setSearchError] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchSubmitted, setSearchSubmitted] = useState(Boolean(isSearchPage && searchQuery))

  const [sectionCounts, setSectionCounts] = useState({
    free: 0,
    deals: 0,
    always: 0,
    coming: 0,
  })
  const [freeGames, setFreeGames] = useState([])
  const [upcomingGames, setUpcomingGames] = useState([])

  async function loadNews() {
    setNewsLoading(true)
    setNewsError('')
    try {
      const data = await fetchNewsSnapshot()
      setNewsUpdatedAt(data.generatedAt || '')
      const stories = Array.isArray(data.articles) ? data.articles : []
      setNews(
        stories
          .filter((article) => !article.sponsored && article.title && article.link)
          .slice(0, 3)
      )
    } catch {
      setNewsError('Gaming news could not load right now. Please try again later.')
    } finally {
      setNewsLoading(false)
    }
  }

  useEffect(() => {
    loadNews()
  }, [])

  const searchGames = useCallback(async (event, queryParam, platformParam) => {
    if (event?.preventDefault) event.preventDefault()
    const query = (queryParam !== undefined ? queryParam : searchTerm).trim()
    const platform = platformParam !== undefined ? platformParam : activePlatform
    if (!query) return

    setSearchSubmitted(true)
    setSearchLoading(true)
    setSearchError('')
    try {
      const results = await searchGamesMulti(query, platform)
      setSearchResults(results)
    } catch (error) {
      setSearchError(error.message?.startsWith('Add your free RAWG')
        ? error.message
        : 'Search could not load. Check your connection and try again.')
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }, [searchTerm, activePlatform])

  // Sync search state with URL / prop changes
  useEffect(() => {
    if (isSearchPage && searchQuery) {
      setSearchTerm(searchQuery)
      setActivePlatform(searchCategory || 'All')
      setSearchSubmitted(true)
      searchGames(null, searchQuery, searchCategory || 'All')
    } else if (!isSearchPage) {
      setSearchSubmitted(false)
      setSearchTerm('')
      setSearchResults([])
      setSearchError('')
    }
  }, [isSearchPage, searchQuery, searchCategory, searchGames])

  // Listen to search events dispatched from global header
  useEffect(() => {
    function handleShellSearch(event) {
      const query = event.detail?.query?.trim()
      const category = event.detail?.category || 'All'
      if (!query) return
      setSearchTerm(query)
      setActivePlatform(category)
      setSearchSubmitted(true)
      searchGames(null, query, category)
    }
    window.addEventListener('lootradar-shell-search', handleShellSearch)
    return () => window.removeEventListener('lootradar-shell-search', handleShellSearch)
  }, [searchGames])

  useEffect(() => {
    let cancelled = false

    async function loadSectionCounts() {
      const requests = [
        ['free', '/data/gamerpower-free-games.json', 'games'],
        ['deals', '/data/cheapshark-deals.json', 'deals'],
        ['always', '/data/always-free-games.json', 'games'],
        ['coming', '/data/epic-free-games.json', 'upcoming'],
      ]

      const counts = {}
      let gamerPowerGames = []
      let epicUpcoming = []
      await Promise.all(requests.map(async ([key, url, field]) => {
        try {
          const response = await fetch(url)
          if (!response.ok) return
          const data = await response.json()
          counts[key] = Array.isArray(data[field]) ? data[field].length : 0
          if (key === 'free') gamerPowerGames = Array.isArray(data.games) ? data.games : []
          if (key === 'coming') epicUpcoming = Array.isArray(data.upcoming) ? data.upcoming : []
        } catch {
          counts[key] = 0
        }
      }))

      if (!cancelled) {
        setSectionCounts((current) => ({ ...current, ...counts }))
        setFreeGames(gamerPowerGames)
        setUpcomingGames(epicUpcoming)
      }
    }

    loadSectionCounts()
    return () => {
      cancelled = true
    }
  }, [])

  function handleSelectPlatform(platform) {
    setActivePlatform(platform)
    if (onSearchChange) onSearchChange(searchTerm, platform)
    window.history.pushState(
      {},
      '',
      `/search?q=${encodeURIComponent(searchTerm)}&platform=${encodeURIComponent(platform)}`
    )
    searchGames(null, searchTerm, platform)
  }

  function handleClearSearch() {
    setSearchSubmitted(false)
    setSearchTerm('')
    setSearchResults([])
    setSearchError('')
    if (onSearchChange) onSearchChange('', 'All')
    onNavigate('discover')
  }

  function handleSelectSuggestion(query) {
    setSearchTerm(query)
    if (onSearchChange) onSearchChange(query, activePlatform)
    window.history.pushState(
      {},
      '',
      `/search?q=${encodeURIComponent(query)}&platform=${encodeURIComponent(activePlatform)}`
    )
    searchGames(null, query, activePlatform)
  }

  if (searchSubmitted || isSearchPage) {
    return (
      <SearchResultsView
        searchTerm={searchTerm}
        searchResults={searchResults}
        searchLoading={searchLoading}
        searchError={searchError}
        activePlatform={activePlatform}
        onSelectPlatform={handleSelectPlatform}
        onClearSearch={handleClearSearch}
        onSelectSuggestion={handleSelectSuggestion}
        onRetry={() => searchGames(null, searchTerm, activePlatform)}
        getGameActions={getGameActions}
        hasKey={hasRawgKey}
      />
    )
  }

  return (
    <HomeRedesign
      deals={deals}
      dealsStores={dealsStores}
      dealsLoading={dealsLoading}
      dealsError={dealsError}
      freeGames={freeGames}
      upcomingGames={upcomingGames}
      news={news}
      newsLoading={newsLoading}
      newsUpdatedAt={newsUpdatedAt}
      onNavigate={onNavigate}
      getGameActions={getGameActions}
      searchSubmitted={false}
      searchLoading={false}
      searchError=""
      searchTerm=""
      searchResults={[]}
      hasKey={hasRawgKey}
      session={session}
      wishlist={wishlist}
    />
  )
}
