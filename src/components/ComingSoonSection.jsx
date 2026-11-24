import { useEffect, useMemo, useRef, useState } from 'react'
import SafeImage from './SafeImage.jsx'
import { fetchRawgGames, hasRawgKey } from '../lib/discoverApi.js'
import { titleKey } from '../lib/wishlistAlerts.js'
import { cleanTitle, formatStartsIn } from '../lib/freeGames.js'

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

// ─── Platform Icons Component ────────────────────────────────────────────────
function ComingSoonPlatformIcons({ item }) {
  const isGiveaway = item.type === 'giveaway'

  const haystack = useMemo(() => {
    if (isGiveaway) return ''
    const list = []
    if (Array.isArray(item.parent_platforms)) {
      for (const p of item.parent_platforms) {
        if (p?.platform?.slug) list.push(p.platform.slug.toLowerCase())
        if (p?.platform?.name) list.push(p.platform.name.toLowerCase())
      }
    }
    if (Array.isArray(item.platforms)) {
      for (const p of item.platforms) {
        if (p?.platform?.slug) list.push(p.platform.slug.toLowerCase())
        if (p?.platform?.name) list.push(p.platform.name.toLowerCase())
      }
    }
    return list.join(' ')
  }, [item, isGiveaway])

  if (isGiveaway) {
    return (
      <div className="coming-game-card__platform-icons" aria-label="Available platforms">
        <PcIcon />
      </div>
    )
  }

  const hasPc = haystack.includes('pc') || haystack.includes('windows')
  const hasPs = haystack.includes('playstation') || haystack.includes('ps')
  const hasXbox = haystack.includes('xbox')

  return (
    <div className="coming-game-card__platform-icons" aria-label="Available platforms">
      {hasPc && <PcIcon />}
      {hasPs && <PsIcon />}
      {hasXbox && <XboxIcon />}
    </div>
  )
}

// ─── Coming Soon Card ────────────────────────────────────────────────────────
function ComingSoonCardItem({
  item,
  now,
  getGameActions,
}) {
  const isGiveaway = item.type === 'giveaway'
  const title = cleanTitle(item.title || item.name)

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
          src={item.image || item.background_image}
          alt={title}
          className="coming-game-card__img"
          fallbackText={title.slice(0, 1)}
        />

        {/* Type Badge: FREE SOON (lime) or RELEASE */}
        {isGiveaway ? (
          <span className="coming-game-card__badge coming-game-card__badge--free">
            FREE SOON
          </span>
        ) : (
          <span className="coming-game-card__badge coming-game-card__badge--release">
            RELEASE
          </span>
        )}

        {/* Countdown badge for giveaways */}
        {countdownText && (
          <span className="coming-game-card__countdown" title={dateText}>
            {countdownText}
          </span>
        )}

        {/* Wishlist Heart Top-Right */}
        <button
          type="button"
          className={`coming-game-card__heart ${actions.wishlisted ? 'is-active' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            actions.onToggleWishlist()
          }}
          aria-label={actions.wishlisted ? `Remove ${title} from wishlist` : `Add ${title} to wishlist`}
          title={actions.wishlisted ? 'Saved to Wishlist' : 'Add to Wishlist'}
        >
          <HeartIcon filled={actions.wishlisted} />
        </button>
      </div>

      <div className="coming-game-card__body">
        <h3 className="coming-game-card__title" title={title}>
          <a
            href={openUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="coming-game-card__link"
          >
            {title}
          </a>
        </h3>

        <div className="coming-game-card__date" title={dateText}>
          {dateText}
        </div>

        <div className="coming-game-card__footer">
          <ComingSoonPlatformIcons item={item} />
        </div>
      </div>
    </article>
  )
}

// ─── Main Section Component ──────────────────────────────────────────────────
export default function ComingSoonSection({
  getGameActions = () => ({ owned: false, wishlisted: false, onToggleWishlist: () => {}, onToggleOwned: () => {} }),
  onNavigate = () => {},
}) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [now, setNow] = useState(Date.now())

  const sectionRef = useRef(null)
  const scrollRowRef = useRef(null)

  // Update clock every minute
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(id)
  }, [])

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

      // 1. Fetch Epic upcoming snapshot
      try {
        const epicRes = await fetch('/data/epic-free-games.json')
        if (epicRes.ok) {
          const data = await epicRes.json()
          if (Array.isArray(data?.upcoming)) {
            epicUpcoming = data.upcoming.map((item) => ({
              ...item,
              type: 'giveaway',
              sortTime: item.startDate ? new Date(item.startDate).getTime() : Infinity,
            }))
          }
        }
      } catch {
        // ignore
      }

      // 2. Fetch RAWG upcoming games (+90 days) if RAWG key exists
      if (hasRawgKey) {
        try {
          const today = new Date()
          const in90Days = new Date(today.getTime() + 90 * 86400000)
          const dateStr = `${today.toISOString().slice(0, 10)},${in90Days.toISOString().slice(0, 10)}`

          const params = {
            dates: dateStr,
            ordering: '-added',
            platforms: '4,187,186,1,18',
            page_size: '12',
            exclude_additions: 'true',
          }

          const res = await fetchRawgGames(params, 'upcoming_releases_v2', 12 * 3600 * 1000)
          const rawList = Array.isArray(res?.results) ? res.results : []

          rawgUpcoming = rawList.map((item) => ({
            ...item,
            type: 'release',
            title: item.name,
            image: item.background_image,
            sortTime: item.released ? new Date(`${item.released}T00:00:00`).getTime() : Infinity,
          }))
        } catch {
          // ignore RAWG upcoming error
        }
      }

      // 3. Merge, dedupe by titleKey, drop items without image, sort ascending by date
      const combined = [...epicUpcoming, ...rawgUpcoming]
      const seen = new Set()
      const merged = []

      for (const item of combined) {
        const title = item.title || item.name
        const img = item.image || item.background_image
        if (!title || !img) continue
        const k = titleKey(title)
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
          <span className="coming-soon-section__kicker">UPCOMING</span>
          <h2 id="coming-soon-heading">
            Coming <strong>Soon</strong>
          </h2>
          <p className="coming-soon-section__sub">Upcoming giveaways & releases</p>
        </div>

        <div className="coming-soon-section__controls">
          <div className="coming-soon-section__arrows">
            <button
              type="button"
              className="coming-soon-section__arrow"
              onClick={() => scroll('prev')}
              aria-label="Scroll left"
            >
              <ChevronLeftIcon />
            </button>
            <button
              type="button"
              className="coming-soon-section__arrow"
              onClick={() => scroll('next')}
              aria-label="Scroll right"
            >
              <ChevronRightIcon />
            </button>
          </div>

          <button
            type="button"
            className="lr-button lr-button--ghost coming-soon-section__view-all"
            onClick={() => onNavigate('free')}
          >
            View All
          </button>
        </div>
      </header>

      {/* Skeletons while loading */}
      {loading && items.length === 0 && (
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
              now={now}
              getGameActions={getGameActions}
            />
          ))}
        </div>
      )}
    </section>
  )
}
