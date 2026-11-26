import { Component, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  PcIcon,
  PlayStationIcon,
  XboxIcon,
  SwitchIcon,
  HeartIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '../components/icons'
import { fetchRawgGames, searchGamesMulti, hasRawgKey } from '../lib/discoverApi'
import { cleanNewsText, fetchNewsSnapshot, formatNewsRelativeTime } from '../lib/newsHelpers'
import GameActions from '../components/GameActions'
import TopDeals from '../components/TopDeals'
import PopularGamesSection from '../components/PopularGamesSection'
import ComingSoonSection from '../components/ComingSoonSection'
import SafeImage from '../components/SafeImage'
import {
  formatStoreName,
  formatDealPrice,
  formatDealExpiry,
  getDealImageUrl,
  selectHeroDeals,
  useDeals,
} from '../lib/dealsData'
import { cleanTitle, isMobile, mergeFreeSources, normalizeStore } from '../lib/freeGames'
import { wishRadarArt } from '../assets/art'

const SKELETON_ITEMS = Array.from({ length: 12 }, (_, i) => i)

function dateString(date) {
  return date.toISOString().slice(0, 10)
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
  const str = String(endDate)
  const cleanDate = str.includes('T') ? str : str.replace(' ', 'T') + 'Z'
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
      <PcIcon key="pc" size={16} strokeWidth={1.8} className="platform-icon" title="PC" aria-label="PC" />
    )
  }
  if (hasPS) {
    icons.push(
      <PlayStationIcon key="ps" size={16} className="platform-icon" title="PlayStation" aria-label="PlayStation" />
    )
  }
  if (hasXbox) {
    icons.push(
      <XboxIcon key="xbox" size={16} className="platform-icon" title="Xbox" aria-label="Xbox" />
    )
  }
  if (hasNintendo) {
    icons.push(
      <SwitchIcon key="nintendo" size={16} className="platform-icon" title="Nintendo" aria-label="Nintendo" />
    )
  }

  return <>{icons.slice(0, 3)}</>
}

const GameTile = memo(function GameTile({ game, badge, getGameActions }) {
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
        rel="noopener noreferrer"
        aria-label={`View ${game.name} on RAWG`}
      >
        <div className="search-tile__media">
          <SafeImage
            src={game.background_image}
            alt={game.name}
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
          <HeartIcon size={16} active={actions.wishlisted} />
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
          <CheckIcon size={16} strokeWidth={2.4} />
        </button>
      </div>
    </article>
  )
})

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
          {SKELETON_ITEMS.map((i) => (
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

const NewsTile = memo(function NewsTile({ article }) {
  const [imageFailed, setImageFailed] = useState(false)

  return (
    <article className={`news-card ${article.image ? '' : 'is-no-image'}`}>
      {article.image && !imageFailed ? (
        <img
          src={article.image}
          alt={article.title}
          loading="lazy"
          className="news-image"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="news-image-fallback" role="img" aria-label="No image available">RADAR</div>
      )}
      <div className="news-copy">
        <div className="news-meta">
          <span>{article.source || 'Gaming news'}</span>
          <span>{formatNewsDate(article.publishedAt)}</span>
        </div>
        <h3>{article.title}</h3>
        {article.summary && <p>{article.summary}</p>}
        <a href={article.link} target="_blank" rel="noopener noreferrer" className="news-link">
          Read story <span aria-hidden="true">-&gt;</span>
        </a>
      </div>
    </article>
  )
})

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
          <div className="lr-art-fallback">WISHRADAR</div>
          <div className="home-hero-overlay" />
          <div className="home-hero-copy">
            <span className="lr-badge lr-badge--lime">WISHRADAR</span>
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

      const heroDeals = selectHeroDeals(deals, 3)
      if (!Array.isArray(heroDeals) || heroDeals.length === 0) return []

      const slides = []
      let nextDealIdx = 0

      const makeDealSlide = (deal, idPrefix = 'deal') => {
        if (!deal || typeof deal !== 'object' || !deal.title) return null
        const dealID = String(deal.itadId || idPrefix)
        const store = formatStoreName(deal.shop?.name || 'PC Store')
        const salePrice = Number(deal.price || 0)
        const regularPrice = Number(deal.regular || 0)
        const savings = Math.max(0, Math.round(Number(deal.cut || 0)))

        return {
          id: `${idPrefix}-${dealID}`,
          type: 'deal',
          title: deal.title,
          imageUrl: getDealImageUrl(deal) || '',
          steamAppID: deal.steamAppId ? String(deal.steamAppId) : null,
          badgeText: 'TOP DEAL',
          subtitle: store,
          countdownEnd: deal.expiry || '',
          price: {
            sale: Number.isFinite(salePrice) ? salePrice : 0,
            regular: Number.isFinite(regularPrice) ? regularPrice : 0,
            savings: Number.isFinite(savings) ? savings : 0,
          },
          actionLabel: 'View deal',
          actionUrl: deal.url || '#',
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
      const activeFreeGames = freeGames.filter((game) => {
        if (!game || typeof game !== 'object' || !game.title) return false
        const thumb = game.image || game.thumbnail
        return Boolean(thumb && thumb.trim())
      })

      const chosenFree = activeFreeGames[0]
      if (chosenFree && chosenFree.title) {
        const cleanedFreeTitle = cleanTitle(chosenFree.title)
        const freeStore = normalizeStore(chosenFree)
        slides.push({
          id: `free-${chosenFree.id || 'giveaway'}`,
          type: 'free',
          title: cleanedFreeTitle,
          imageUrl: chosenFree.image || chosenFree.thumbnail || '',
          badgeText: 'FREE NOW',
          subtitle: freeStore !== 'Other' ? `${freeStore} · PC` : (chosenFree.platforms || 'PC / DRM-Free'),
          countdownEnd: chosenFree.end_date || chosenFree.endDate || '',
          actionLabel: 'Claim now',
          actionUrl: chosenFree.open_giveaway_url || chosenFree.url || chosenFree.gamerpower_url || 'https://www.gamerpower.com',
          isExternal: true,
          store: freeStore !== 'Other' ? freeStore : 'Giveaway',
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
  }, [deals, freeGames, upcomingGames, now])

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
                                {formatDealPrice(slide.price.sale)}
                              </strong>
                              {slide.price.regular > slide.price.sale && (
                                <del className="home-hero-old-price">
                                  {formatDealPrice(slide.price.regular)}
                                </del>
                              )}
                              {slide.store && (
                                <span className="home-hero-store-chip">
                                  {slide.store}
                                </span>
                              )}
                              {slide.countdownEnd && formatDealExpiry(slide.countdownEnd, now) && (
                                <span className="home-hero-countdown">
                                  {formatDealExpiry(slide.countdownEnd, now)}
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
                  <ChevronLeftIcon size={16} strokeWidth={2.4} />
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
                  <ChevronRightIcon size={16} strokeWidth={2.4} />
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
        deals={deals}
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
          {wishRadarArt.promo.src ? <img src={wishRadarArt.promo.src} alt={wishRadarArt.promo.alt} loading="lazy" /> : <span className="home-promo-radar" aria-hidden="true" />}
          <span><small>WISHRADAR ALERTS</small><strong>Connect Telegram, never miss a free game</strong><em>Connect Telegram</em></span>
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
    free: itadFreeGames,
    loading: dealsLoading,
    error: dealsError,
  } = useDeals()

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
  const [gamerPowerGames, setGamerPowerGames] = useState([])
  const [epicCurrentGames, setEpicCurrentGames] = useState([])
  const [upcomingGames, setUpcomingGames] = useState([])

  const freeGames = useMemo(() => {
    return mergeFreeSources({
      epicItems: epicCurrentGames,
      gamerPowerItems: gamerPowerGames,
      itadFreeItems: itadFreeGames,
    })
  }, [epicCurrentGames, gamerPowerGames, itadFreeGames])

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
    window.addEventListener('wishradar-shell-search', handleShellSearch)
    return () => window.removeEventListener('wishradar-shell-search', handleShellSearch)
  }, [searchGames])

  useEffect(() => {
    let cancelled = false

    async function loadSectionCounts() {
      const requests = [
        ['free', '/data/gamerpower-free-games.json', 'games'],
        ['always', '/data/always-free-games.json', 'games'],
        ['coming', '/data/epic-free-games.json', 'upcoming'],
      ]

      const counts = { deals: deals.length }
      let gpGames = []
      let epicCurrent = []
      let epicUpcoming = []
      await Promise.all(requests.map(async ([key, url, field]) => {
        try {
          const response = await fetch(url)
          if (!response.ok) return
          const data = await response.json()
          counts[key] = Array.isArray(data[field]) ? data[field].length : 0
          if (key === 'free') gpGames = Array.isArray(data.games) ? data.games : []
          if (key === 'coming') {
            epicCurrent = Array.isArray(data.current) ? data.current : []
            epicUpcoming = Array.isArray(data.upcoming) ? data.upcoming : []
          }
        } catch {
          counts[key] = 0
        }
      }))

      if (!cancelled) {
        setSectionCounts((current) => ({ ...current, ...counts, deals: deals.length }))
        setGamerPowerGames(gpGames)
        setEpicCurrentGames(epicCurrent)
        setUpcomingGames(epicUpcoming)
      }
    }

    loadSectionCounts()
    return () => {
      cancelled = true
    }
  }, [deals.length])

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
