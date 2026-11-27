import { useEffect, useMemo, useState } from 'react'
import SafeImage from '../components/SafeImage.jsx'
import { supabase } from '../lib/supabase.js'
import {
  cleanTitle,
  isMobile,
  normalizeStore,
  isActive,
  formatTimeLeft,
  formatStartsIn,
  parseEndDate,
  formatWorthInr,
  mergeFreeSources,
  sortFreeGames,
  parseFreeParams,
  serializeFreeParams,
} from '../lib/freeGames.js'

const GAMERPOWER_API = 'https://www.gamerpower.com/api/giveaways?type=game'
const CACHE_KEY = 'wishradar_free_v3'
const CACHE_MS = 10 * 60 * 1000 // 10 minutes

const STORE_CHIPS = [
  { label: 'All', value: 'all' },
  { label: 'Epic', value: 'epic' },
  { label: 'Steam', value: 'steam' },
  { label: 'EA Store', value: 'ea store' },
  { label: 'GOG', value: 'gog' },
  { label: 'itch.io', value: 'itch.io' },
  { label: 'Prime/Amazon', value: 'prime/amazon' },
]

const SORT_OPTIONS = [
  { label: 'Ending soon', value: 'ending' },
  { label: 'Highest value', value: 'value' },
  { label: 'Recently added', value: 'recent' },
]

import {
  ExternalLinkIcon,
  CheckIcon,
  HeartIcon,
  SendIcon as TelegramIcon,
  PcIcon as PcPlatformIcon,
  GamepadIcon as ConsolePlatformIcon,
  RotateCcwIcon,
  StoreIcon,
} from '../components/icons'

// ─── FreeCard (Claim Now) ────────────────────────────────────────────────────
function FreeCard({ game, now, getGameActions, onGameOpen }) {
  const rawTitle = game.title || game.name || 'Free Game'
  const title = cleanTitle(rawTitle) || 'Free Game'
  const store = normalizeStore(game)
  const isConsole = /(playstation|ps4|ps5|xbox)/i.test(game.platforms || '')

  const timeLeft = formatTimeLeft(game.end_date || game.endDate, now)

  const actions = getGameActions({
    title,
    platform: game.platforms || 'PC',
    image: game.image || game.thumbnail,
    source: 'free',
    sourceId: game.id,
  })

  const claimUrl =
    game.open_giveaway_url ||
    (game.slug ? `https://store.epicgames.com/p/${game.slug}` : '') ||
    game.gamerpower_url ||
    '#'

  const worthFormatted = formatWorthInr(game.worth || game.worthInr)

  return (
    <article
      className="free-card free-card--claim"
      onClick={() => onGameOpen?.(title)}
      data-testid="free-card"
    >
      {/* Background Image covering entire card */}
      <div className="free-card__media">
        <SafeImage
          steamAppID={game.steamAppId}
          src={game.image || game.thumbnail}
          alt={title}
          className="free-card__img"
          fallbackText={title.slice(0, 1)}
        />
      </div>

      {/* Dark gradient fade over bottom of image */}
      <div className="free-card__fade" aria-hidden="true" />

      {/* Top-left: Green FREE badge */}
      <span className="free-card__badge-free">FREE</span>

      {/* Top-right: Solid red countdown pill */}
      <span className="free-card__countdown-chip">
        {timeLeft.text}
      </span>

      {/* Overlay content over bottom fade */}
      <div className="free-card__body">
        <h3 className="free-card__title" title={title}>
          {title}
        </h3>

        <div className="free-card__meta-row">
          <div className="free-card__platform-store">
            <span className="free-card__store-chip">
              {isConsole ? <ConsolePlatformIcon size={13} /> : <PcPlatformIcon size={14} />}
              {store}
            </span>
          </div>
          {worthFormatted ? (
            <del className="free-card__worth">Worth {worthFormatted}</del>
          ) : (
            <span className="free-card__worth-empty" aria-hidden="true" />
          )}
        </div>

        {/* Actions */}
        <div className="free-card__actions" onClick={(e) => e.stopPropagation()}>
          <a
            href={claimUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="lr-button free-card__claim-btn"
          >
            Claim now <ExternalLinkIcon size={14} />
          </a>

          <button
            type="button"
            className={`free-card__owned-btn ${actions.owned ? 'is-owned' : ''}`}
            onClick={(e) => {
              e.preventDefault()
              actions.onToggleOwned()
            }}
            aria-label={actions.owned ? `Marked as owned: ${title}` : `Mark ${title} as owned`}
            title={actions.owned ? 'Claimed / In your library' : 'I claimed this'}
          >
            <CheckIcon />
          </button>
        </div>
      </div>
    </article>
  )
}

// ─── Coming Soon Card ────────────────────────────────────────────────────────
function ComingSoonCard({ game, now, getGameActions, onGameOpen }) {
  const title = cleanTitle(game.title)
  const actions = getGameActions({
    title,
    platform: 'Epic Games',
    image: game.image,
    source: 'free-coming',
    sourceId: game.id,
  })

  const startsIn = formatStartsIn(game.startDate, now)

  const formatExactDate = (dateStr) => {
    if (!dateStr) return ''
    try {
      const d = new Date(dateStr)
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      })
    } catch {
      return dateStr
    }
  }

  const epicUrl =
    game.slug && !/^[0-9a-f-]{30,}$/i.test(game.slug)
      ? `https://store.epicgames.com/p/${game.slug}`
      : `https://store.epicgames.com/browse?q=${encodeURIComponent(title)}`

  return (
    <article
      className="free-card free-card--coming"
      onClick={() => onGameOpen?.(title)}
    >
      <div className="free-card__media">
        <SafeImage
          src={game.image}
          alt={title}
          className="free-card__img"
          fallbackText={title.slice(0, 1)}
        />
        <span className="free-card__badge-upcoming">UPCOMING</span>
        <span className="free-card__countdown-chip free-card__countdown-chip--starts">
          {startsIn}
        </span>

        {/* Top-right Wishlist heart */}
        <button
          type="button"
          className={`free-card__heart-btn ${actions.wishlisted ? 'is-wishlisted' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            actions.onToggleWishlist()
          }}
          aria-label={actions.wishlisted ? `Wishlisted ${title}` : `Add ${title} to wishlist`}
          title={actions.wishlisted ? 'Saved to Wishlist' : 'Add to Wishlist'}
        >
          <HeartIcon filled={actions.wishlisted} />
        </button>
      </div>

      <div className="free-card__body">
        <h3 className="free-card__title" title={title}>
          {title}
        </h3>

        <div className="free-card__meta-row">
          <span className="free-card__store-chip">
            <PcPlatformIcon /> Epic Games
          </span>
        </div>

        <div className="free-card__date-range">
          <span>Starts {formatExactDate(game.startDate)}</span>
          {game.endDate && <span className="free-card__date-sub">Ends {formatExactDate(game.endDate)}</span>}
        </div>

        {game.description && (
          <p className="free-card__desc" title={game.description}>
            {game.description}
          </p>
        )}

        <div className="free-card__actions" onClick={(e) => e.stopPropagation()}>
          <a
            href={epicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="lr-button free-card__claim-btn free-card__claim-btn--secondary"
          >
            View on Epic <ExternalLinkIcon />
          </a>
        </div>
      </div>
    </article>
  )
}

// ─── Always Free Card ────────────────────────────────────────────────────────
function AlwaysFreeCard({ game, onGameOpen }) {
  const playUrl = game.gameUrl || game.profileUrl || '#'

  return (
    <article
      className="free-card free-card--always"
      onClick={() => onGameOpen?.(game.title)}
    >
      <div className="free-card__media">
        <SafeImage
          src={game.thumbnail}
          alt={game.title}
          className="free-card__img"
          fallbackText={game.title?.slice(0, 1)}
        />
        <span className="free-card__badge-always">Always free</span>
      </div>

      <div className="free-card__body">
        <h3 className="free-card__title" title={game.title}>
          {game.title}
        </h3>

        <div className="free-card__meta-row">
          <span className="free-card__store-chip">
            <PcPlatformIcon /> {game.platform || 'PC'}
          </span>
          {game.genre && <span className="free-card__genre-chip">{game.genre}</span>}
        </div>

        {game.description && (
          <p className="free-card__desc" title={game.description}>
            {game.description}
          </p>
        )}

        <div className="free-card__actions" onClick={(e) => e.stopPropagation()}>
          <a
            href={playUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="lr-button free-card__claim-btn"
          >
            Play now <ExternalLinkIcon />
          </a>
        </div>
      </div>
    </article>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────────────
function FreeCardSkeleton() {
  return (
    <div className="free-card-skeleton" aria-hidden="true">
      <div className="free-card-skeleton__media" />
      <div className="free-card-skeleton__body">
        <div className="free-card-skeleton__title" />
        <div className="free-card-skeleton__meta" />
        <div className="free-card-skeleton__btn" />
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────
function titleKey(title = '') {
  return String(title).trim().toLocaleLowerCase()
}

export default function FreeNow({
  library = [],
  getGameActions = () => ({ owned: false, wishlisted: false, onToggleOwned: () => {}, onToggleWishlist: () => {} }),
  onAvailabilityChange = () => {},
  activeTab = 'claim',
  onTabChange,
  onGameOpen = () => {},
  session = null,
  onNavigate = () => {},
}) {
  // Sync URL query state
  const initialParams = useMemo(() => parseFreeParams(window.location.search), [])
  const [tab, setTab] = useState(activeTab || initialParams.tab)
  const [store, setStore] = useState(initialParams.store)
  const [sort, setSort] = useState(initialParams.sort)

  const [games, setGames] = useState([])
  const [comingGames, setComingGames] = useState([])
  const [alwaysGames, setAlwaysGames] = useState([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showOwned, setShowOwned] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [lastUpdated, setLastUpdated] = useState(null)

  // Always Free pagination & filter
  const [alwaysPage, setAlwaysPage] = useState(1)
  const [alwaysSearch, setAlwaysSearch] = useState('')
  const [alwaysGenre, setAlwaysGenre] = useState('all')

  // Telegram strip state
  const [telegramConnected, setTelegramConnected] = useState(false)
  const [telegramDismissed, setTelegramDismissed] = useState(() => {
    try {
      return localStorage.getItem('wishradar_free_telegram_dismissed') === 'true'
    } catch {
      return false
    }
  })

  // Synchronize internal tab with external prop activeTab if provided
  useEffect(() => {
    if (activeTab && activeTab !== tab) {
      setTab(activeTab)
    }
  }, [activeTab])

  // Update countdown clock every 60 seconds
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(id)
  }, [])

  // Sync URL search params
  const updateUrlParams = (newTab, newStore, newSort) => {
    const qs = serializeFreeParams({ tab: newTab, store: newStore, sort: newSort })
    const path = window.location.pathname
    window.history.replaceState({}, '', qs ? `${path}${qs}` : path)
  }

  const handleTabSelect = (nextTab) => {
    setTab(nextTab)
    onTabChange?.(nextTab)
    updateUrlParams(nextTab, store, sort)
  }

  const handleStoreSelect = (newStore) => {
    setStore(newStore)
    updateUrlParams(tab, newStore, sort)
  }

  const handleSortSelect = (newSort) => {
    setSort(newSort)
    updateUrlParams(tab, store, newSort)
  }

  // Telegram connection check
  useEffect(() => {
    let cancelled = false
    if (!session || !supabase) {
      setTelegramConnected(false)
      return undefined
    }

    supabase
      .from('telegram_connections')
      .select('user_id')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setTelegramConnected(Boolean(data))
      })
      .catch(() => {
        if (!cancelled) setTelegramConnected(false)
      })

    return () => {
      cancelled = true
    }
  }, [session])

  const dismissTelegram = () => {
    setTelegramDismissed(true)
    try {
      localStorage.setItem('wishradar_free_telegram_dismissed', 'true')
    } catch {
      // ignore
    }
  }

  // ─── Data Loading: Stale-While-Revalidate ────────────────────────────────────
  const loadData = async () => {
    setLoading(true)
    setError('')

    let initialList = []
    let epicList = []
    let epicUpcoming = []
    let alwaysList = []
    let itadFreeList = []
    let snapshotTimestamp = null

    // 1. Instant render from local snapshots
    try {
      const [gpSnapshotRes, epicSnapshotRes, itadSnapshotRes, alwaysRes] = await Promise.allSettled([
        fetch('/data/gamerpower-free-games.json'),
        fetch('/data/epic-free-games.json'),
        fetch('/data/itad-deals.json'),
        fetch('/data/always-free-games.json'),
      ])

      if (gpSnapshotRes.status === 'fulfilled' && gpSnapshotRes.value.ok) {
        const gpData = await gpSnapshotRes.value.json()
        if (Array.isArray(gpData.games)) initialList = gpData.games
        if (gpData.generatedAt) snapshotTimestamp = new Date(gpData.generatedAt).getTime()
      }

      if (epicSnapshotRes.status === 'fulfilled' && epicSnapshotRes.value.ok) {
        const epicData = await epicSnapshotRes.value.json()
        if (Array.isArray(epicData.current)) epicList = epicData.current
        if (Array.isArray(epicData.upcoming)) {
          epicUpcoming = epicData.upcoming
          setComingGames(epicUpcoming)
        }
      }

      if (itadSnapshotRes.status === 'fulfilled' && itadSnapshotRes.value.ok) {
        const itadData = await itadSnapshotRes.value.json()
        if (Array.isArray(itadData.free)) itadFreeList = itadData.free
      }

      if (alwaysRes.status === 'fulfilled' && alwaysRes.value.ok) {
        const alwaysData = await alwaysRes.value.json()
        if (Array.isArray(alwaysData.games)) {
          alwaysList = alwaysData.games
          setAlwaysGames(alwaysList)
        }
      }

      // Merge & clean instant snapshot
      const mergedInitial = mergeFreeSources({
        epicItems: epicList,
        gamerPowerItems: initialList,
        itadFreeItems: itadFreeList,
      })
      if (mergedInitial.length > 0) {
        setGames(mergedInitial)
        onAvailabilityChange(mergedInitial)
        if (snapshotTimestamp) setLastUpdated(snapshotTimestamp)
        setLoading(false)
      }
    } catch {
      // ignore snapshot error, fallback to cache / live fetch
    }

    // 2. Check 10-min sessionStorage cache
    try {
      const cached = sessionStorage.getItem(CACHE_KEY)
      if (cached) {
        const { time, data, epicUpcoming: cachedUpcoming, alwaysList: cachedAlways } = JSON.parse(cached)
        if (
          time &&
          Date.now() - time < CACHE_MS &&
          Array.isArray(data) &&
          data.length > 0 &&
          Array.isArray(cachedUpcoming) &&
          Array.isArray(cachedAlways)
        ) {
          setGames(data)
          onAvailabilityChange(data)
          setLastUpdated(time)
          setComingGames(cachedUpcoming)
          setAlwaysGames(cachedAlways)
          setLoading(false)
          return
        }
      }
    } catch {
      // ignore cache parse issues
    }

    // 3. Background / live refresh from GamerPower API
    try {
      const res = await fetch(GAMERPOWER_API)
      if (!res.ok) throw new Error(`Live API error: ${res.status}`)
      const liveData = await res.json()
      const liveList = Array.isArray(liveData) ? liveData : []

      if (liveList.length > 0) {
        const combined = mergeFreeSources({
          epicItems: epicList,
          gamerPowerItems: liveList,
          itadFreeItems: itadFreeList,
        })
        setGames(combined)
        onAvailabilityChange(combined)
        const nowMs = Date.now()
        setLastUpdated(nowMs)

        try {
          sessionStorage.setItem(
            CACHE_KEY,
            JSON.stringify({
              time: nowMs,
              data: combined,
              epicUpcoming,
              alwaysList,
            })
          )
        } catch {
          // ignore cache writing error
        }
      }
    } catch {
      // If we don't even have snapshot data, display error state
      if (initialList.length === 0 && games.length === 0) {
        setError('Could not load free games right now. Check your internet connection.')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // ─── Filter & Sort Claim Games ──────────────────────────────────────────────
  const ownedTitles = useMemo(() => {
    const set = new Set()
    for (const game of library) {
      if (game?.title) set.add(titleKey(game.title))
    }
    return set
  }, [library])

  const activeClaimGames = useMemo(() => {
    return games.filter((game) => isActive(game, now) && !isMobile(game))
  }, [games, now])

  const filteredClaimGames = useMemo(() => {
    let result = activeClaimGames

    // Store filter
    if (store !== 'all') {
      result = result.filter((g) => normalizeStore(g).toLowerCase() === store.toLowerCase())
    }

    // Hide owned unless showOwned is toggled
    if (!showOwned) {
      result = result.filter((g) => {
        const title = cleanTitle(g.title)
        if (library.length > 0) {
          return !ownedTitles.has(titleKey(title))
        }
        const act = getGameActions({
          title,
          platform: g.platforms || 'PC',
          image: g.thumbnail || g.image,
          source: 'free',
          sourceId: g.id,
        })
        return !act.owned
      })
    }

    // Sort
    return sortFreeGames(result, sort, now)
  }, [activeClaimGames, store, showOwned, sort, now, library.length, ownedTitles, getGameActions])

  // Count owned games that are hidden
  const hiddenOwnedCount = useMemo(() => {
    return activeClaimGames.filter((g) => {
      const title = cleanTitle(g.title)
      if (library.length > 0) {
        return ownedTitles.has(titleKey(title))
      }
      const act = getGameActions({
        title,
        platform: g.platforms || 'PC',
        image: g.thumbnail || g.image,
        source: 'free',
        sourceId: g.id,
      })
      return act.owned
    }).length
  }, [activeClaimGames, library.length, ownedTitles, getGameActions])

  // ─── Always Free Filter & Pagination ────────────────────────────────────────
  const alwaysGenresList = useMemo(() => {
    const set = new Set()
    for (const g of alwaysGames) {
      if (g.genre) set.add(g.genre)
    }
    return ['all', ...Array.from(set).sort()]
  }, [alwaysGames])

  const filteredAlwaysGames = useMemo(() => {
    let list = alwaysGames
    if (alwaysSearch.trim()) {
      const q = alwaysSearch.toLowerCase().trim()
      list = list.filter((g) => g.title?.toLowerCase().includes(q))
    }
    if (alwaysGenre !== 'all') {
      list = list.filter((g) => g.genre?.toLowerCase() === alwaysGenre.toLowerCase())
    }
    return list
  }, [alwaysGames, alwaysSearch, alwaysGenre])

  const visibleAlwaysGames = useMemo(() => {
    return filteredAlwaysGames.slice(0, alwaysPage * 24)
  }, [filteredAlwaysGames, alwaysPage])

  // Dynamic header titles
  const tabTitles = {
    claim: 'Claim Now',
    coming: 'Coming Soon',
    always: 'Always Free',
  }
  const currentTitle = tabTitles[tab] || 'Claim Now'
  const titleParts = currentTitle.split(' ')

  const tabCounts = {
    claim: filteredClaimGames.length,
    coming: comingGames.length,
    always: filteredAlwaysGames.length,
  }

  // Format "Updated X min ago"
  const formattedUpdatedAgo = useMemo(() => {
    if (!lastUpdated) return null
    const diffMin = Math.max(0, Math.floor((now - lastUpdated) / 60000))
    if (diffMin === 0) return 'Updated just now'
    if (diffMin === 1) return 'Updated 1 min ago'
    if (diffMin < 60) return `Updated ${diffMin} min ago`
    const hours = Math.floor(diffMin / 60)
    return `Updated ${hours}h ago`
  }, [lastUpdated, now])

  return (
    <section className="free-page-redesign" data-testid="free-page">
      {/* ─── Header ─── */}
      <header className="free-header">
        <div className="free-header__titles">
          <span className="lr-section-heading__kicker">LIMITED-TIME OFFERS</span>
          <div className="free-header__title-row">
            <h1>
              {titleParts[0]} <strong>{titleParts.slice(1).join(' ')}</strong>
            </h1>
            <span className="free-count-badge">{tabCounts[tab]} games</span>
          </div>
        </div>

        {formattedUpdatedAgo && (
          <span className="free-updated-pill">{formattedUpdatedAgo}</span>
        )}
      </header>

      {/* ─── Navigation Tabs ─── */}
      <div className="free-tabs" role="tablist" aria-label="Free games categories">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'claim'}
          className={`free-tab ${tab === 'claim' ? 'is-active' : ''}`}
          onClick={() => handleTabSelect('claim')}
        >
          Claim Now
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'coming'}
          className={`free-tab ${tab === 'coming' ? 'is-active' : ''}`}
          onClick={() => handleTabSelect('coming')}
        >
          Coming Soon
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'always'}
          className={`free-tab ${tab === 'always' ? 'is-active' : ''}`}
          onClick={() => handleTabSelect('always')}
        >
          Always Free
        </button>
      </div>

      {/* ─── Slim Telegram Strip ─── */}
      {!telegramConnected && !telegramDismissed && (
        <aside className="free-telegram-strip" aria-label="Telegram alerts notice">
          <div className="free-telegram-strip__left">
            <span className="free-telegram-strip__icon">
              <TelegramIcon />
            </span>
            <span className="free-telegram-strip__text">
              Get free-game alerts straight to Telegram so you never miss a giveaway.
            </span>
          </div>
          <div className="free-telegram-strip__actions">
            <button
              type="button"
              className="free-telegram-strip__btn"
              onClick={() => onNavigate('account')}
            >
              Connect Telegram
            </button>
            <button
              type="button"
              className="free-telegram-strip__close"
              onClick={dismissTelegram}
              aria-label="Dismiss Telegram prompt"
            >
              ✕
            </button>
          </div>
        </aside>
      )}

      {/* ─── TAB 1: CLAIM NOW ─── */}
      {tab === 'claim' && (
        <>
          {/* Toolbar: Store Chips, Sort & Owned Toggle */}
          <div className="free-toolbar">
            <div className="free-filter-row free-filter-row--stores">
              {STORE_CHIPS.map((chip) => (
                <button
                  key={chip.value}
                  type="button"
                  className={`free-chip ${store === chip.value ? 'is-active' : ''}`}
                  onClick={() => handleStoreSelect(chip.value)}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            <div className="free-filter-row free-filter-row--controls">
              {/* Sort Menu */}
              <div className="free-sort-wrapper">
                <select
                  className="free-select"
                  value={sort}
                  onChange={(e) => handleSortSelect(e.target.value)}
                  aria-label="Sort free games"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Owned Games Hidden / Show Line */}
              {hiddenOwnedCount > 0 && (
                <div className="free-owned-toggle-line">
                  <span>{hiddenOwnedCount} owned {hiddenOwnedCount === 1 ? 'game' : 'games'} hidden</span>
                  <button
                    type="button"
                    className="free-owned-toggle-btn"
                    onClick={() => setShowOwned(!showOwned)}
                    aria-pressed={showOwned}
                  >
                    {showOwned ? 'Hide' : 'Show'}
                  </button>
                </div>
              )}

              {/* Reset Claim Filters Button */}
              {(store !== 'all' || sort !== 'ending' || showOwned) && (
                <button
                  type="button"
                  className="free-active-reset-btn"
                  onClick={() => {
                    handleStoreSelect('all')
                    handleSortSelect('ending')
                    setShowOwned(false)
                  }}
                  title="Reset filters to default"
                >
                  <RotateCcwIcon size={12} strokeWidth={2.5} />
                  Reset filters
                </button>
              )}
            </div>
          </div>

          {/* Error State */}
          {error && (
            <div className="free-error-box" role="alert">
              <p>{error}</p>
              <button type="button" onClick={loadData} className="free-retry-btn">
                Retry
              </button>
            </div>
          )}

          {/* Grid or Skeletons */}
          {loading && games.length === 0 ? (
            <div className="free-grid">
              {Array.from({ length: 8 }).map((_, i) => (
                <FreeCardSkeleton key={i} />
              ))}
            </div>
          ) : filteredClaimGames.length > 0 ? (
            <div className="free-grid">
              {filteredClaimGames.map((game) => (
                <FreeCard
                  key={game.id || game.title}
                  game={game}
                  now={now}
                  getGameActions={getGameActions}
                  onGameOpen={onGameOpen}
                />
              ))}
            </div>
          ) : (
            !loading &&
            !error && (
              <div className="free-empty-state">
                <h3 className="free-empty-title">No free games in this filter</h3>
                <p className="free-empty-desc">
                  Try switching store chips to &ldquo;All&rdquo; or reveal your owned games.
                </p>
                <button
                  type="button"
                  className="free-reset-btn"
                  onClick={() => {
                    handleStoreSelect('all')
                    setShowOwned(true)
                  }}
                >
                  Reset filters
                </button>
              </div>
            )
          )}
        </>
      )}

      {/* ─── TAB 2: COMING SOON ─── */}
      {tab === 'coming' && (
        <>
          {comingGames.length > 0 ? (
            <div className="free-grid free-grid--coming">
              {comingGames.map((game) => (
                <ComingSoonCard
                  key={game.id || game.title}
                  game={game}
                  now={now}
                  getGameActions={getGameActions}
                  onGameOpen={onGameOpen}
                />
              ))}
            </div>
          ) : (
            <div className="free-empty-state">
              <h3 className="free-empty-title">No upcoming giveaways confirmed</h3>
              <p className="free-empty-desc">
                Epic Games announces upcoming free games weekly. Check back on Thursday!
              </p>
            </div>
          )}
        </>
      )}

      {/* ─── TAB 3: ALWAYS FREE ─── */}
      {tab === 'always' && (
        <>
          {/* Always Free Search & Genre Toolbar */}
          <div className="free-toolbar free-toolbar--always">
            <div className="free-search-box">
              <input
                type="text"
                className="free-search-input"
                placeholder="Search always-free titles..."
                value={alwaysSearch}
                onChange={(e) => {
                  setAlwaysSearch(e.target.value)
                  setAlwaysPage(1)
                }}
              />
              {alwaysSearch && (
                <button
                  type="button"
                  className="free-search-clear"
                  onClick={() => setAlwaysSearch('')}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="free-genre-wrapper">
              <select
                className="free-select"
                value={alwaysGenre}
                onChange={(e) => {
                  setAlwaysGenre(e.target.value)
                  setAlwaysPage(1)
                }}
                aria-label="Filter by genre"
              >
                {alwaysGenresList.map((g) => (
                  <option key={g} value={g}>
                    {g === 'all' ? 'All Genres' : g}
                  </option>
                ))}
              </select>
            </div>

            {Boolean(alwaysSearch.trim() || alwaysGenre !== 'all') && (
              <button
                type="button"
                className="free-active-reset-btn"
                onClick={() => {
                  setAlwaysSearch('')
                  setAlwaysGenre('all')
                  setAlwaysPage(1)
                }}
                title="Reset filters"
              >
                Reset filters
              </button>
            )}
          </div>

          {visibleAlwaysGames.length > 0 ? (
            <>
              <div className="free-grid free-grid--always">
                {visibleAlwaysGames.map((game) => (
                  <AlwaysFreeCard
                    key={game.id || game.title}
                    game={game}
                    onGameOpen={onGameOpen}
                  />
                ))}
              </div>

              {visibleAlwaysGames.length < filteredAlwaysGames.length && (
                <div className="free-pagination">
                  <button
                    type="button"
                    className="free-load-more-btn"
                    onClick={() => setAlwaysPage((p) => p + 1)}
                  >
                    Show more (+24)
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="free-empty-state">
              <h3 className="free-empty-title">No always-free games found</h3>
              <p className="free-empty-desc">
                Try searching for a different title or resetting the genre filter.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  )
}
