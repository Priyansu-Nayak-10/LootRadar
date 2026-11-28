import { memo, useEffect, useMemo, useRef, useState } from 'react'
import SafeImage from './SafeImage.jsx'
import { rawgImage } from '../lib/rawgImage.js'
import { useNow } from '../lib/nowStore.js'
import TimeLeft from './TimeLeft.jsx'
import PlatformIcons from './PlatformIcons.jsx'
import { fetchRawgGames, hasRawgKey } from '../lib/discoverApi.js'
import { loadSnapshot } from '../lib/snapshots.js'
import { cleanTitle, dedupeKey, formatStartsIn } from '../lib/freeGames.js'
import { formatDealPrice, matchDealForGame } from '../lib/dealsData.js'
import {
  HeartIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from './icons'

// ─── Platform Icons Component ────────────────────────────────────────────────
function ComingSoonPlatformIcons({ item }) {
  const isGiveaway = item.type === 'giveaway'
  const platforms = useMemo(
    () => (isGiveaway ? ['pc'] : [...(item.parent_platforms || []), ...(item.platforms || [])]),
    [isGiveaway, item.parent_platforms, item.platforms]
  )

  return (
    <div className="coming-game-card__platform-icons" aria-label="Available platforms">
      <PlatformIcons platforms={platforms} size={16} />
    </div>
  )
}

// ─── Coming Soon Card ────────────────────────────────────────────────────────
const ComingSoonCardItem = memo(function ComingSoonCardItem({
  item,
  deals = [],
  now,
  getGameActions,
}) {
  const isGiveaway = item.type === 'giveaway'
  const title = cleanTitle(item.title || item.name)
  const dealMatch = useMemo(() => {
    if (isGiveaway) return null
    return matchDealForGame({ title }, deals)
  }, [isGiveaway, title, deals])

  const actions = getGameActions({
    title,
    platform: isGiveaway ? 'Epic Games' : 'Multiplatform',
    image: item.image || item.background_image,
    source: isGiveaway ? 'epic-upcoming' : 'rawg-upcoming',
    sourceId: item.id,
  })

  // Format date display
  const dateText = useMemo(() => {
    if (isGiveaway && item.startDate) {
      try {
        const d = new Date(item.startDate)
        const formatted = new Intl.DateTimeFormat(undefined, {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          timeZoneName: 'short',
        }).format(d)
        return `Starts ${formatted}`
      } catch {
        return 'Starting soon'
      }
    }

    if (item.released) {
      try {
        const d = new Date(`${item.released}T00:00:00`)
        const isCurrentYear = d.getFullYear() === new Date().getFullYear()
        return new Intl.DateTimeFormat(undefined, {
          month: 'short',
          day: 'numeric',
          year: isCurrentYear ? undefined : 'numeric',
        }).format(d)
      } catch {
        return item.released
      }
    }

    return 'Coming soon'
  }, [isGiveaway, item.startDate, item.released])

  // Giveaway Countdown
  const countdownText = useMemo(() => {
    if (!isGiveaway || !item.startDate) return null
    const text = formatStartsIn(item.startDate, now)
    return text.replace(/^Starts\s+/i, '')
  }, [isGiveaway, item.startDate, now])

  const openUrl = isGiveaway
    ? item.slug && !/^[0-9a-f-]{30,}$/i.test(item.slug)
      ? `https://store.epicgames.com/p/${item.slug}`
      : `https://store.epicgames.com/browse?q=${encodeURIComponent(title)}`
    : item.slug
      ? `https://rawg.io/games/${item.slug}`
      : `https://rawg.io/games/${item.id}`

  return (
    <article className="coming-game-card" data-testid="coming-soon-card">
      <div className="coming-game-card__art">
        <SafeImage
          src={rawgImage(item.image || item.background_image, 420)}
          alt={title}
          className="coming-game-card__img"
          fallbackText={title.slice(0, 1)}
        />
      </div>

      {/* Top row: badge + wishlist heart */}
      <div className="coming-game-card__tags">
        {isGiveaway ? (
          <span className="wr-badge wr-badge--free">Free soon</span>
        ) : (
          <span className="wr-badge wr-badge--release">Release</span>
        )}

        <button
          type="button"
          className={`wr-icon-btn wr-icon-btn--sm wr-icon-btn--round ${actions.wishlisted ? 'is-on' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            actions.onToggleWishlist()
          }}
          aria-pressed={Boolean(actions.wishlisted)}
          aria-label={actions.wishlisted ? `Remove ${title} from wishlist` : `Add ${title} to wishlist`}
          title={actions.wishlisted ? 'Saved to Wishlist' : 'Add to Wishlist'}
        >
          <HeartIcon />
        </button>
      </div>

      <div className="coming-game-card__body">
        <h3 className="wr-title" title={title}>
          <a
            href={openUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="coming-game-card__link"
          >
            {title}
          </a>
        </h3>

        <div className="coming-game-card__date-row">
          <div className="coming-game-card__date" title={dateText}>
            {dateText}
          </div>
          {dealMatch && Number(dealMatch.cut) > 0 && (
            <span className="wr-badge wr-badge--discount coming-game-card__price-badge">
              -{Math.round(Number(dealMatch.cut))}% {formatDealPrice(dealMatch.price)}
            </span>
          )}
        </div>

        <div className="coming-game-card__footer">
          <ComingSoonPlatformIcons item={item} />
          {countdownText && (
            <TimeLeft
              tone="calm"
              endDate={item.startDate}
              label={countdownText}
              now={now}
            />
          )}
        </div>
      </div>
    </article>
  )
})

// ─── Main Section Component ──────────────────────────────────────────────────
export default function ComingSoonSection({
  deals = [],
  getGameActions = () => ({ owned: false, wishlisted: false, onToggleWishlist: () => {}, onToggleOwned: () => {} }),
  onNavigate = () => {},
}) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const now = useNow()

  const sectionRef = useRef(null)
  const scrollRowRef = useRef(null)

  // Lazy loading observer
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

  // Load Epic giveaways & RAWG upcoming releases
  useEffect(() => {
    if (!isVisible) return

    let cancelled = false

    const loadData = async () => {
      setLoading(true)
      let epicUpcoming = []
      let rawgUpcoming = []

      // 1 & 2. Fetch Epic snapshot and RAWG upcoming releases (+90 days) in parallel
      const today = new Date()
      const in90Days = new Date(today.getTime() + 90 * 86400000)
      const dateStr = `${today.toISOString().slice(0, 10)},${in90Days.toISOString().slice(0, 10)}`

      const rawgPromise = hasRawgKey
        ? fetchRawgGames(
            {
              dates: dateStr,
              ordering: '-added',
              platforms: '4,187,186,1,18',
              page_size: '12',
              exclude_additions: 'true',
            },
            'upcoming_releases_v2',
            12 * 3600 * 1000
          )
        : Promise.resolve(null)

      const [epicRes, rawgRes] = await Promise.allSettled([
        loadSnapshot('epic-free-games'),
        rawgPromise,
      ])

      if (epicRes.status === 'fulfilled' && Array.isArray(epicRes.value?.upcoming)) {
        epicUpcoming = epicRes.value.upcoming.map((item) => ({
          ...item,
          type: 'giveaway',
          sortTime: item.startDate ? new Date(item.startDate).getTime() : Infinity,
        }))
      }

      if (rawgRes.status === 'fulfilled' && Array.isArray(rawgRes.value?.results)) {
        rawgUpcoming = rawgRes.value.results.map((item) => ({
          ...item,
          type: 'release',
          title: item.name,
          image: item.background_image,
          sortTime: item.released ? new Date(`${item.released}T00:00:00`).getTime() : Infinity,
        }))
      }

      // 3. Merge, dedupe by titleKey, drop items without image, sort ascending by date
      const combined = [...epicUpcoming, ...rawgUpcoming]
      const seen = new Set()
      const merged = []

      for (const item of combined) {
        const title = item.title || item.name
        const img = item.image || item.background_image
        if (!title || !img) continue
        const k = dedupeKey(title)
        if (seen.has(k)) continue
        seen.add(k)
        merged.push(item)
      }

      // Sort by date ascending
      merged.sort((a, b) => a.sortTime - b.sortTime)
      const finalItems = merged.slice(0, 10)

      if (!cancelled) {
        setItems(finalItems)
        setLoading(false)
      }
    }

    loadData()

    return () => {
      cancelled = true
    }
  }, [isVisible])

  // Horizontal scroll
  const scroll = (direction) => {
    if (!scrollRowRef.current) return
    const container = scrollRowRef.current
    const scrollAmount = container.clientWidth * 0.75
    container.scrollBy({
      left: direction === 'next' ? scrollAmount : -scrollAmount,
      behavior: 'smooth',
    })
  }

  // Hide the whole section if there is nothing to show after loading
  if (!loading && items.length === 0 && isVisible) {
    return null
  }

  return (
    <section
      className="coming-soon-section"
      ref={sectionRef}
      aria-labelledby="coming-soon-heading"
    >
      <header className="coming-soon-section__header">
        <div className="coming-soon-section__header-left">
          <span className="coming-soon-section__kicker">Upcoming</span>
          <h2 id="coming-soon-heading" className="coming-soon-section__title">
            Coming <em>Soon</em>
          </h2>
          <p className="coming-soon-section__sub">Upcoming giveaways &amp; releases</p>
        </div>

        <div className="coming-soon-section__controls">
          <div className="coming-soon-section__arrows">
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

          <button
            type="button"
            className="coming-soon-section__view-all"
            onClick={() => onNavigate('free')}
          >
            View all
          </button>
        </div>
      </header>

      {/* Skeletons on mount and while loading */}
      {(loading || !isVisible) && items.length === 0 && (
        <div className="coming-soon-section__row" aria-busy="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="popular-game-card-skeleton lr-skeleton" />
          ))}
        </div>
      )}

      {/* Scrollable Game Cards */}
      {items.length > 0 && (
        <div className="coming-soon-section__row" ref={scrollRowRef}>
          {items.map((item) => (
            <ComingSoonCardItem
              key={item.id || item.slug}
              item={item}
              deals={deals}
              now={now}
              getGameActions={getGameActions}
            />
          ))}
        </div>
      )}
    </section>
  )
}
