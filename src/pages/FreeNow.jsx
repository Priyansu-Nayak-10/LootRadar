import { memo, useEffect, useMemo, useState } from 'react'
import SafeImage from '../components/SafeImage.jsx'
import TimeLeft from '../components/TimeLeft.jsx'
import { supabase } from '../lib/supabase.js'
import { fetchWithTimeout, loadSnapshot } from '../lib/snapshots.js'
import { useNow } from '../lib/nowStore.js'
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

const GAMERPOWER_API = 'https://www.gamerpower.com/api/giveaways'
const CACHE_KEY = 'wishradar_free_v5'
const CACHE_MS = 10 * 60 * 1000 // 10 minutes
const DEFAULT_USD_TO_INR = 93

const CLAIM_TYPE_TABS = [
  { label: 'Games', value: 'games' },
  { label: 'DLC & Loot', value: 'dlc' },
  { label: 'Early Access', value: 'early' },
]

function getClaimTypeBucket(game) {
  const t = String(game?.type || 'Game').toLowerCase()
  if (t.includes('early') || t.includes('beta')) return 'early'
  if (t.includes('dlc') || t.includes('loot') || t === 'other') return 'dlc'
  return 'games'
}

const STORE_CHIPS = [
  { label: 'All', value: 'all' },
  { label: 'Epic', value: 'epic' },
  { label: 'Steam', value: 'steam' },
  { label: 'EA Store', value: 'ea store' },
  { label: 'GOG', value: 'gog' },
  { label: 'itch.io', value: 'itch.io' },
  { label: 'IndieGala', value: 'indiegala' },
  { label: 'STOVE', value: 'stove' },
  { label: 'Meta Quest', value: 'meta quest' },
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
  StoreIcon,
  RotateCcwIcon,
  ChevronDownIcon,
} from '../components/icons'

// ─── FreeCard (Claim Now) ────────────────────────────────────────────────────
const FreeCard = memo(function FreeCard({ game, now, fxRate, getGameActions, onGameOpen }) {
  const rawTitle = game.title || game.name || 'Free Game'
  const title = cleanTitle(rawTitle) || 'Free Game'
  const store = normalizeStore(game)
  const isConsole = /(playstation|ps4|ps5|xbox)/i.test(game.platforms || '')

  const timeLeft = formatTimeLeft(game.end_date || game.endDate, now)
  const isTba = !(game.end_date || game.endDate) || timeLeft.text === 'Time TBA'

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

  const worthFormatted = formatWorthInr(game.worth || game.worthInr, fxRate)

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

      {/* Top row: Free badge, countdown/TBA chip, wishlist heart */}
      <div className="free-card__tags">
        <span className="wr-badge wr-badge--free">Free</span>
        <TimeLeft
          variant="badge"
          endDate={game.end_date || game.endDate}
          label={timeLeft.text}
          now={now}
          className="free-card__time-badge"
        />
        <button
          type="button"
          className={`wr-icon-btn wr-icon-btn--sm wr-icon-btn--round ${actions.wishlisted ? 'is-on' : ''}`}
          aria-pressed={Boolean(actions.wishlisted)}
          aria-label={actions.wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          title={actions.wishlisted ? 'In Wishlist' : 'Add to Wishlist'}
          onClick={(e) => {
            e.stopPropagation()
            actions.onToggleWishlist()
          }}
        >
          <HeartIcon />
        </button>
      </div>

      {/* Overlay content over bottom fade */}
      <div className="free-card__body">
        <h3 className="wr-title" title={title}>
          {title}
        </h3>

        <div className="free-card__meta-row">
          <span className="wr-store-chip">
            <StoreIcon store={store} size={14} />
            {store}
          </span>
          {worthFormatted ? (
            <span className="free-card__worth">
              Worth <strong>{worthFormatted}</strong>
            </span>
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
            className="wr-cta free-card__claim-btn"
          >
            Claim now <ExternalLinkIcon size={14} />
          </a>

          <button
            type="button"
            className={`wr-icon-btn ${actions.owned ? 'is-on' : ''}`}
            onClick={(e) => {
              e.preventDefault()
              actions.onToggleOwned()
            }}
            aria-pressed={Boolean(actions.owned)}
            aria-label={actions.owned ? `Remove ${title} from owned` : `Mark ${title} as owned`}
            title={actions.owned ? 'Claimed / In your library' : 'I claimed this'}
          >
            <CheckIcon />
          </button>
        </div>
      </div>
    </article>
  )
})

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
        <div className="free-card__tags">
          <span className="wr-badge wr-badge--release">Upcoming</span>
          <TimeLeft
            variant="badge"
            tone="calm"
            endDate={game.startDate}
            label={startsIn}
            now={now}
          />

          {/* Top-right Wishlist heart */}
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
      </div>

      <div className="free-card__body">
        <h3 className="wr-title" title={title}>
          {title}
        </h3>

        <div className="free-card__meta-row">
          <span className="wr-store-chip">
            <StoreIcon store="Epic Games" size={14} /> Epic Games
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
            className="wr-cta wr-cta--secondary"
          >
            View on Epic <ExternalLinkIcon size={14} />
          </a>
        </div>
      </div>
    </article>
  )
}

// ─── Always Free Card ────────────────────────────────────────────────────────
const AlwaysFreeCard = memo(function AlwaysFreeCard({ game, onGameOpen }) {
  const playUrl = game.game_url || game.gameUrl || game.profileUrl || '#'
  const description = game.short_description || game.description || ''

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
      </div>

      <div className="free-card__fade" aria-hidden="true" />

      <div className="free-card__tags">
        <span className="wr-badge wr-badge--free">Always free</span>
      </div>

      <div className="free-card__body">
        <h3 className="wr-title" title={game.title}>
          {game.title}
        </h3>

        <div className="free-card__meta-row">
          <span className="wr-store-chip">
            <PcPlatformIcon size={14} /> {game.platform || 'PC'}
          </span>
          {game.genre && <span className="free-card__genre-chip">{game.genre}</span>}
        </div>

        {description && (
          <p className="free-card__desc" title={description}>
            {description}
          </p>
        )}

        <div className="free-card__actions" onClick={(e) => e.stopPropagation()}>
          <a
            href={playUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="wr-cta free-card__claim-btn"
          >
            Play now <ExternalLinkIcon size={14} />
          </a>
        </div>
      </div>
    </article>
  )
})

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
  const [claimType, setClaimType] = useState('games')
  const [store, setStore] = useState(initialParams.store)
  const [sort, setSort] = useState(initialParams.sort)
  const [fxRate, setFxRate] = useState(DEFAULT_USD_TO_INR)

  const [games, setGames] = useState([])
  const [comingGames, setComingGames] = useState([])
  const [alwaysGames, setAlwaysGames] = useState([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showOwned, setShowOwned] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)

  // Always Free pagination & filter
  const [alwaysPage, setAlwaysPage] = useState(1)
  const [alwaysSearch, setAlwaysSearch] = useState('')
  const [alwaysGenre, setAlwaysGenre] = useState('all')
  const [alwaysPlatform, setAlwaysPlatform] = useState('all')

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

  const now = useNow()

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

    // 1. Check 10-min sessionStorage cache BEFORE starting snapshot requests
    try {
      const cached = sessionStorage.getItem(CACHE_KEY)
      if (cached) {
        const { time, data, epicUpcoming: cachedUpcoming, alwaysList: cachedAlways, fxRate: cachedFx } = JSON.parse(cached)
        if (
          time &&
          Date.now() - time < CACHE_MS &&
          Array.isArray(data) &&
          data.length > 0 &&
          Array.isArray(cachedUpcoming) &&
          Array.isArray(cachedAlways)
        ) {
          if (Number.isFinite(cachedFx) && cachedFx > 0) setFxRate(cachedFx)
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

    let initialList = []
    let epicList = []
    let epicUpcoming = []
    let alwaysList = []
    let itadFreeList = []
    let resolvedFx = DEFAULT_USD_TO_INR
    let snapshotTimestamp = null

    // 2. Instant render from shared cached snapshots
    try {
      const [gpSnapshotRes, epicSnapshotRes, itadSnapshotRes, alwaysRes, fxRes] = await Promise.allSettled([
        loadSnapshot('gamerpower-free-games'),
        loadSnapshot('epic-free-games'),
        loadSnapshot('itad-deals'),
        loadSnapshot('always-free-games'),
        loadSnapshot('fx-rates'),
      ])

      if (fxRes.status === 'fulfilled' && fxRes.value) {
        const rate = Number(fxRes.value?.rates?.INR)
        if (Number.isFinite(rate) && rate > 0) {
          resolvedFx = rate
          setFxRate(rate)
        }
      }

      if (gpSnapshotRes.status === 'fulfilled' && gpSnapshotRes.value) {
        const gpData = gpSnapshotRes.value
        if (Array.isArray(gpData.games)) initialList = gpData.games
        if (gpData.generatedAt) snapshotTimestamp = new Date(gpData.generatedAt).getTime()
      }

      if (epicSnapshotRes.status === 'fulfilled' && epicSnapshotRes.value) {
        const epicData = epicSnapshotRes.value
        if (Array.isArray(epicData.current)) epicList = epicData.current
        if (Array.isArray(epicData.upcoming)) {
          epicUpcoming = epicData.upcoming
          setComingGames(epicUpcoming)
        }
      }

      if (itadSnapshotRes.status === 'fulfilled' && itadSnapshotRes.value) {
        const itadData = itadSnapshotRes.value
        if (Array.isArray(itadData.free)) itadFreeList = itadData.free
      }

      if (alwaysRes.status === 'fulfilled' && alwaysRes.value) {
        const alwaysData = alwaysRes.value
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
      // ignore snapshot error, fallback to live fetch
    }

    // 3. Background / live refresh from GamerPower API (12s timeout)
    try {
      const res = await fetchWithTimeout(GAMERPOWER_API)
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
              fxRate: resolvedFx,
            })
          )
        } catch {
          // ignore cache writing error
        }
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[FreeNow] Live GamerPower refresh failed:', err?.message || err)
      }
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

  const typeCounts = useMemo(() => {
    const counts = { games: 0, dlc: 0, early: 0 }
    for (const g of activeClaimGames) {
      counts[getClaimTypeBucket(g)]++
    }
    return counts
  }, [activeClaimGames])

  const claimTabGames = useMemo(() => {
    return activeClaimGames.filter((g) => getClaimTypeBucket(g) === claimType)
  }, [activeClaimGames, claimType])

  const visibleStoreChips = useMemo(() => {
    const counts = {}
    for (const g of claimTabGames) {
      const s = normalizeStore(g).toLowerCase()
      counts[s] = (counts[s] || 0) + 1
    }
    return STORE_CHIPS.filter((chip) => chip.value === 'all' || (counts[chip.value] || 0) > 0)
  }, [claimTabGames])

  useEffect(() => {
    if (!import.meta.env.DEV || activeClaimGames.length === 0) return
    const unmapped = activeClaimGames
      .filter((g) => normalizeStore(g) === 'Other')
      .map((g) => ({ title: g.title, platforms: g.platforms || '' }))
    if (unmapped.length > 0) {
      console.warn('[FreeNow] Titles resolving to store "Other":', unmapped)
    }
  }, [activeClaimGames])

  const filteredClaimGames = useMemo(() => {
    let result = claimTabGames

    // Store filter
    if (store !== 'all') {
      result = result.filter((g) => normalizeStore(g).toLowerCase() === store.toLowerCase())
    }

    // Hide owned unless showOwned is toggled
    if (!showOwned && ownedTitles.size > 0) {
      result = result.filter((g) => !ownedTitles.has(titleKey(cleanTitle(g.title))))
    }

    // Sort
    return sortFreeGames(result, sort, now)
  }, [claimTabGames, store, showOwned, sort, now, ownedTitles])

  // Count owned games that are hidden
  const hiddenOwnedCount = useMemo(() => {
    if (ownedTitles.size === 0) return 0
    return claimTabGames.filter((g) => ownedTitles.has(titleKey(cleanTitle(g.title)))).length
  }, [claimTabGames, ownedTitles])

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
    if (alwaysPlatform !== 'all') {
      list = list.filter((g) => {
        const p = String(g.platform || '').toLowerCase()
        return alwaysPlatform === 'browser' ? p.includes('web browser') : p.includes('pc')
      })
    }
    if (alwaysSearch.trim()) {
      const q = alwaysSearch.toLowerCase().trim()
      list = list.filter((g) => g.title?.toLowerCase().includes(q))
    }
    if (alwaysGenre !== 'all') {
      list = list.filter((g) => g.genre?.toLowerCase() === alwaysGenre.toLowerCase())
    }
    return list
  }, [alwaysGames, alwaysPlatform, alwaysSearch, alwaysGenre])

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
    claim: typeCounts[claimType],
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
          <span className="lr-section-heading__kicker">Free now</span>
          <div className="free-header__title-row">
            <h1>
              {titleParts[0]} <em>{titleParts.slice(1).join(' ')}</em>
            </h1>
            {loading && tabCounts[tab] === 0 ? (
              <span className="lr-skeleton free-count-skeleton" aria-label="Loading count" />
            ) : (
              <span className="free-count-badge">{tabCounts[tab]} games</span>
            )}
          </div>
          {formattedUpdatedAgo && (
            <p className="free-header__sub">{formattedUpdatedAgo}</p>
          )}
        </div>

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
      </header>

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
              className="wr-cta free-telegram-strip__btn"
              onClick={() => onNavigate('account')}
            >
              Connect Telegram
            </button>
            <button
              type="button"
              className="wr-icon-btn wr-icon-btn--sm"
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
          {/* Type Switch + Toolbar: Store Chips, Sort & Owned Toggle */}
          <div className="free-toolbar">
            <div className="free-tabs free-type-tabs" role="tablist" aria-label="Offer type">
              {CLAIM_TYPE_TABS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  role="tab"
                  aria-selected={claimType === t.value}
                  className={`free-tab ${claimType === t.value ? 'is-active' : ''}`}
                  onClick={() => {
                    setClaimType(t.value)
                    handleStoreSelect('all')
                  }}
                >
                  {t.label}
                  {loading && typeCounts[t.value] === 0 ? (
                    <span className="lr-skeleton free-tab-count-skeleton" aria-hidden="true" />
                  ) : (
                    <span className="free-tab__count">{typeCounts[t.value]}</span>
                  )}
                </button>
              ))}
            </div>

            <div className="free-filter-row">
              {visibleStoreChips.map((chip) => (
                <button
                  key={chip.value}
                  type="button"
                  className={`wr-chip ${store === chip.value ? 'is-active' : ''}`}
                  onClick={() => handleStoreSelect(chip.value)}
                >
                  {chip.label}
                </button>
              ))}

              <div className="free-sort-wrapper">
                <select
                  className="wr-chip free-sort-select"
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
                <ChevronDownIcon size={16} className="free-sort-chevron" />
              </div>
            </div>

            {(hiddenOwnedCount > 0 || store !== 'all' || sort !== 'ending' || showOwned) && (
              <div className="free-filter-row free-filter-row--meta">
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
            )}
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
                  fxRate={fxRate}
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
          {loading && comingGames.length === 0 ? (
            <div className="free-grid free-grid--coming" aria-busy="true">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="free-card-skeleton free-card-skeleton--coming" aria-hidden="true">
                  <div className="free-card-skeleton__media" />
                  <div className="free-card-skeleton__body">
                    <div className="free-card-skeleton__title" />
                    <div className="free-card-skeleton__meta" />
                    <div className="free-card-skeleton__btn" />
                  </div>
                </div>
              ))}
            </div>
          ) : comingGames.length > 0 ? (
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

            <div className="free-always-platforms" role="group" aria-label="Filter by platform">
              {[
                { label: 'All', value: 'all' },
                { label: 'PC', value: 'pc' },
                { label: 'Browser', value: 'browser' },
              ].map((p) => (
                <button
                  key={p.value}
                  type="button"
                  className={`wr-chip ${alwaysPlatform === p.value ? 'is-active' : ''}`}
                  aria-pressed={alwaysPlatform === p.value}
                  onClick={() => {
                    setAlwaysPlatform(p.value)
                    setAlwaysPage(1)
                  }}
                >
                  {p.label}
                </button>
              ))}
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

            {Boolean(alwaysSearch.trim() || alwaysGenre !== 'all' || alwaysPlatform !== 'all') && (
              <button
                type="button"
                className="free-active-reset-btn"
                onClick={() => {
                  setAlwaysSearch('')
                  setAlwaysGenre('all')
                  setAlwaysPlatform('all')
                  setAlwaysPage(1)
                }}
                title="Reset filters"
              >
                Reset filters
              </button>
            )}
          </div>

          {loading && alwaysGames.length === 0 ? (
            <div className="free-grid free-grid--always" aria-busy="true">
              {Array.from({ length: 8 }).map((_, i) => (
                <FreeCardSkeleton key={i} />
              ))}
            </div>
          ) : visibleAlwaysGames.length > 0 ? (
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

      <footer className="free-attribution">
        Data:{' '}
        <a href="https://www.gamerpower.com/api-read" target="_blank" rel="noopener noreferrer">
          GamerPower
        </a>{' '}
        &middot;{' '}
        <a href="https://www.freetogame.com/api-doc" target="_blank" rel="noopener noreferrer">
          FreeToGame
        </a>
      </footer>
    </section>
  )
}
