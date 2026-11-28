import { Suspense, lazy, useCallback, useEffect, useRef, useState, useMemo } from 'react'
import Footer from './components/Footer'
import useLocalStorage from './hooks/useLocalStorage'
import { hasSupabaseConfig, supabase } from './lib/supabase'
import SafeImage from './components/SafeImage'
import ErrorBoundary from './components/ErrorBoundary'
import { useDeals } from './lib/dealsData'
import { loadSnapshot } from './lib/snapshots'
import HeaderSearch from './components/HeaderSearch'
import {
  RadarMarkIcon,
  BellIcon,
  CompassIcon,
  GiftIcon,
  TagIcon,
  LibraryIcon,
  HeartIcon,
  NewspaperIcon,
  AccountIcon,
} from './components/icons'
import './App.css'
import './styles/cardSystem.css'

// Route-level code-splitting: lazy load pages and heavy overlays
const loadGameDetailModal = () => import('./components/GameDetailModal')
const GameDetailModal = lazy(loadGameDetailModal)
const Discover = lazy(() => import('./pages/Discover'))
const FreeNow = lazy(() => import('./pages/FreeNow'))
const Deals = lazy(() => import('./pages/Deals'))
const Wishlist = lazy(() => import('./pages/Wishlist'))
const News = lazy(() => import('./pages/News'))
const Account = lazy(() => import('./pages/Account'))
const Library = lazy(() => import('./pages/Library'))

function RouteFallback() {
  const [showSpinner, setShowSpinner] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(() => setShowSpinner(true), 150)
    return () => window.clearTimeout(id)
  }, [])
  return (
    <div className="lr-page-loader" role="status" aria-label="Loading page">
      {showSpinner && <div className="lr-page-loader__spinner" />}
    </div>
  )
}

const NOOP = () => {}

const TABS = [
  { id: 'discover', label: 'Home' },
  { id: 'free', label: 'Free Now' },
  { id: 'deals', label: 'Deals' },
  { id: 'news', label: 'News' },
  { id: 'wishlist', label: 'Wishlist' },
]

const TAB_ICON_COMPONENTS = {
  free: GiftIcon,
  discover: CompassIcon,
  deals: TagIcon,
  library: LibraryIcon,
  wishlist: HeartIcon,
  news: NewspaperIcon,
  account: AccountIcon,
}

function titleKey(title = '') {
  return String(title || '').trim().toLocaleLowerCase()
}

function mergeSavedGames(localGames, databaseRows, listType, keepLocalOnly = true) {
  const localMap = new Map()

  if (Array.isArray(localGames)) {
    for (const game of localGames) {
      if (!game) continue
      const title = game.title || game.name
      if (!title) continue
      localMap.set(titleKey(title), { ...game, title, notify: game.notify !== false })
    }
  }

  const merged = keepLocalOnly ? new Map(localMap) : new Map()

  if (Array.isArray(databaseRows)) {
    for (const row of databaseRows) {
      if (!row || row.list_type !== listType || !row.title) continue
      const key = titleKey(row.title)
      const existing = localMap.get(key)
      merged.set(key, {
        title: row.title,
        platform: row.platform || '',
        image: row.image || '',
        notes: row.notes || '',
        source: row.source || '',
        sourceId: row.source_id || '',
        notify: row.notify !== false,
        lastAlertedAt: row.last_alerted_at || null,
        lastAlertedDiscount: row.last_alerted_discount ?? null,
        lastAlertedPrice: row.last_alerted_price ?? null,
        addedAt: existing?.addedAt || (row.created_at ? new Date(row.created_at).getTime() : undefined),
      })
    }
  }

  return [...merged.values()]
}

function toDatabaseRow(game, listType, userId) {
  const title = game?.title || game?.name || ''
  return {
    user_id: userId,
    list_type: listType,
    title,
    platform: game?.platform || '',
    image: game?.image || game?.background_image || game?.thumbnail || '',
    notes: game?.notes || '',
    source: game?.source || '',
    source_id: game?.sourceId || game?.source_id || '',
    notify: game?.notify !== false,
  }
}

export default function App() {
  const [tab, setTab] = useState('discover')
  const [ownedGames, setOwnedGames] = useLocalStorage('wishradar_library', [])
  const [wishlist, setWishlist] = useLocalStorage('wishradar_wishlist', [])
  const [availableFreeGames, setAvailableFreeGames] = useState([])
  const [session, setSession] = useState(null)
  const [submittedSearch, setSubmittedSearch] = useState('')
  const [submittedCategory, setSubmittedCategory] = useState('All')
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [syncError, setSyncError] = useState(false)
  const [syncingLists, setSyncingLists] = useState(false)

  // Game detail modal state
  const [selectedGameForModal, setSelectedGameForModal] = useState(null)
  const gameModalTriggerRef = useRef(null)

  const handleOpenGameDetail = useCallback((game, triggerEl) => {
    if (triggerEl) {
      gameModalTriggerRef.current = triggerEl
    }
    setSelectedGameForModal(game)
  }, [])

  const handleCloseGameDetail = useCallback(() => {
    setSelectedGameForModal(null)
  }, [])

  // Preload GameDetailModal chunk on idle or on first hover/focus of a game card
  useEffect(() => {
    let preloaded = false
    const preload = () => {
      if (preloaded) return
      preloaded = true
      loadGameDetailModal()
      document.removeEventListener('pointerover', onCardInteract, true)
      document.removeEventListener('focusin', onCardInteract, true)
    }
    const onCardInteract = (event) => {
      if (
        event.target?.closest?.(
          '.wr-card, .deal-card-redesign, .popular-game-card, .coming-game-card, .search-game-card, .free-card, .wishlist-card, .library-card'
        )
      ) {
        preload()
      }
    }
    document.addEventListener('pointerover', onCardInteract, true)
    document.addEventListener('focusin', onCardInteract, true)

    let idleId
    let timerId
    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(preload, { timeout: 2500 })
    } else {
      timerId = window.setTimeout(preload, 2000)
    }

    return () => {
      document.removeEventListener('pointerover', onCardInteract, true)
      document.removeEventListener('focusin', onCardInteract, true)
      if (idleId !== undefined && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId)
      }
      if (timerId !== undefined) {
        window.clearTimeout(timerId)
      }
    }
  }, [])

  // Static snapshot sources for offer resolution
  const { deals } = useDeals()
  const [staticFreeGames, setStaticFreeGames] = useState({ freeGames: [], alwaysFree: [] })

  useEffect(() => {
    let cancelled = false
    async function loadSnapshots() {
      try {
        const [epicRes, alwaysRes] = await Promise.allSettled([
          loadSnapshot('epic-free-games'),
          loadSnapshot('always-free-games'),
        ])
        let freeList = []
        let alwaysList = []
        if (epicRes.status === 'fulfilled' && epicRes.value) {
          if (Array.isArray(epicRes.value.current)) freeList = epicRes.value.current
        }
        if (alwaysRes.status === 'fulfilled' && alwaysRes.value) {
          if (Array.isArray(alwaysRes.value.games)) alwaysList = alwaysRes.value.games
        }
        if (!cancelled) {
          setStaticFreeGames({ freeGames: freeList, alwaysFree: alwaysList })
        }
      } catch {
        // Graceful fallback
      }
    }
    loadSnapshots()
    return () => {
      cancelled = true
    }
  }, [])

  const modalSources = useMemo(() => ({
    freeGames: staticFreeGames.freeGames,
    alwaysFree: staticFreeGames.alwaysFree,
    deals: deals || [],
  }), [staticFreeGames, deals])

  const [freeTab, setFreeTab] = useState('claim')
  const activeNavTab = TABS.some((item) => item.id === tab) ? tab : undefined

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) return undefined

    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session || !supabase) return undefined

    let cancelled = false

    async function syncSavedGames() {
      if (!cancelled) setSyncingLists(true)
      try {
        const { data: rows, error } = await supabase
          .from('saved_games')
          .select('*')
          .eq('user_id', session.user.id)

        if (error) throw error

        let localLibrary = []
        let localWishlist = []
        try {
          localLibrary = JSON.parse(window.localStorage.getItem('wishradar_library') || '[]')
          localWishlist = JSON.parse(window.localStorage.getItem('wishradar_wishlist') || '[]')
        } catch {
          // Keep database rows when local JSON is unavailable or invalid.
        }

        const databaseRows = Array.isArray(rows) ? rows : []
        const syncMarkerKey = `wishradar_synced_${session.user.id}`
        let isFirstSync = false
        try {
          isFirstSync = window.localStorage.getItem(syncMarkerKey) !== 'true'
        } catch {
          // If storage is blocked, default to false (treat Supabase as source of truth)
        }

        if (isFirstSync) {
          const mergedLibrary = mergeSavedGames(localLibrary, databaseRows, 'library', true)
          const mergedWishlist = mergeSavedGames(localWishlist, databaseRows, 'wishlist', true)

          if (!cancelled) {
            setOwnedGames(mergedLibrary)
            setWishlist(mergedWishlist)
          }

          const migrationRows = [
            ...mergedLibrary.map((game) => toDatabaseRow(game, 'library', session.user.id)),
            ...mergedWishlist.map((game) => toDatabaseRow(game, 'wishlist', session.user.id)),
          ]
          if (migrationRows.length > 0) {
            const { error: upsertError } = await supabase
              .from('saved_games')
              .upsert(migrationRows, { onConflict: 'user_id,list_type,title_key' })
            if (upsertError) throw upsertError
          }

          try {
            window.localStorage.setItem(syncMarkerKey, 'true')
          } catch {}
        } else {
          const cloudLibrary = mergeSavedGames(localLibrary, databaseRows, 'library', false)
          const cloudWishlist = mergeSavedGames(localWishlist, databaseRows, 'wishlist', false)

          if (!cancelled) {
            setOwnedGames(cloudLibrary)
            setWishlist(cloudWishlist)
          }
        }
      } catch (error) {
        console.error('Could not sync saved games:', error.message)
      } finally {
        if (!cancelled) setSyncingLists(false)
      }
    }

    syncSavedGames()
    return () => {
      cancelled = true
    }
  }, [session, setOwnedGames, setWishlist])

  useEffect(() => {
    const knownTabs = [
      'discover', 'free', 'deals', 'library', 'wishlist', 'news', 'account', 'search',
    ]
    function readRoute() {
      const pathTab = window.location.pathname.replace(/^\/+|\/+$/g, '')
      const rawHash = window.location.hash.split('&')[0].replace(/^#\/?/, '').split('=')[0]
      const hashTab = rawHash.replace(/^\/+|\/+$/g, '')
      const route = pathTab || hashTab || 'discover'

      if (route === 'coming' || route === 'always') {
        const nextFreeTab = route
        setFreeTab(nextFreeTab)
        setTab('free')
        document.title = 'Free Games | WishRadar'
        window.history.replaceState({}, '', `/free?tab=${nextFreeTab}`)
        return
      }

      if (route === 'signin' || route === 'signup') {
        setTab('account')
        document.title = 'Account | WishRadar'
        window.history.replaceState({}, '', '/account')
        return
      }

      const freeTabQuery = new URLSearchParams(window.location.search).get('tab')
      setFreeTab(
        route === 'free' && ['claim', 'coming', 'always'].includes(freeTabQuery)
          ? freeTabQuery
          : 'claim'
      )

      if (route === 'search') {
        const params = new URLSearchParams(window.location.search)
        const q = params.get('q') || ''
        const platform = params.get('platform') || 'All'
        if (q.trim()) {
          setSubmittedSearch(q)
          setSubmittedCategory(platform)
          setTab('search')
          document.title = `Search: ${q} | WishRadar`
          return
        }
      } else {
        setSubmittedSearch('')
      }
      setTab(knownTabs.includes(route) ? route : 'not-found')

      const routeTitles = {
        discover: 'WishRadar | Your Game Intelligence',
        free: 'Free Games | WishRadar',
        deals: 'Game Deals | WishRadar',
        library: 'Library | WishRadar',
        wishlist: 'Wishlist | WishRadar',
        news: 'Gaming News | WishRadar',
        account: 'Account | WishRadar',
        search: 'Search | WishRadar',
        'not-found': 'Page Not Found | WishRadar',
      }
      document.title = routeTitles[route] || (knownTabs.includes(route) ? 'WishRadar' : 'Page Not Found | WishRadar')
    }
    readRoute()
    window.addEventListener('hashchange', readRoute)
    window.addEventListener('popstate', readRoute)
    return () => {
      window.removeEventListener('hashchange', readRoute)
      window.removeEventListener('popstate', readRoute)
    }
  }, [])

  function navigateTab(nextTab) {
    setAccountMenuOpen(false)
    if (nextTab === 'free') setFreeTab('claim')
    if (nextTab === 'discover') setSubmittedSearch('')
    const isTabChange = nextTab !== tab
    setTab(nextTab)
    if (isTabChange && typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: 'auto' })
    }
    const titles = {
      discover: 'WishRadar | Your Game Intelligence',
      free: 'Free Games | WishRadar',
      deals: 'Game Deals | WishRadar',
      library: 'Library | WishRadar',
      wishlist: 'Wishlist | WishRadar',
      news: 'Gaming News | WishRadar',
      account: 'Account | WishRadar',
      search: 'Search | WishRadar',
    }
    document.title = titles[nextTab] || 'WishRadar'
    window.history.pushState({}, '', nextTab === 'discover' ? '/' : `/${nextTab}`)
  }

  function navigateFreeTab(nextFreeTab) {
    setFreeTab(nextFreeTab)
    setTab('free')
    document.title = 'Free Games | WishRadar'
    window.history.pushState({}, '', nextFreeTab === 'claim' ? '/free' : `/free?tab=${nextFreeTab}`)
  }

  const executeShellSearch = useCallback((queryToUse, categoryToUse = submittedCategory) => {
    const query = (queryToUse !== undefined ? queryToUse : submittedSearch).trim()
    const category = categoryToUse || 'All'
    if (query) {
      setSubmittedSearch(query)
      setSubmittedCategory(category)
      setTab('search')
      document.title = `Search: ${query} | WishRadar`
      window.history.pushState({}, '', `/search?q=${encodeURIComponent(query)}&platform=${encodeURIComponent(category)}`)
      window.dispatchEvent(new CustomEvent('wishradar-shell-search', {
        detail: { query, category },
      }))
    } else {
      navigateTab('discover')
    }
  }, [submittedSearch, submittedCategory])

  async function signOut() {
    try {
      window.localStorage.removeItem('wishradar_library')
      window.localStorage.removeItem('wishradar_wishlist')
    } catch {}
    setOwnedGames([])
    setWishlist([])
    if (!supabase) return
    await supabase.auth.signOut()
  }

  async function handleShellSignOut() {
    setAccountMenuOpen(false)
    await signOut()
    navigateTab('account')
  }

  function gameIsSaved(games, title) {
    if (!Array.isArray(games) || !title) return false
    const targetKey = titleKey(title)
    if (!targetKey) return false
    return games.some((game) => game && titleKey(game.title || game.name) === targetKey)
  }

  const saveActions = useCallback((game) => {
    const rawTitle = game?.title || game?.name || ''
    return {
      owned: gameIsSaved(ownedGames, rawTitle),
      wishlisted: gameIsSaved(wishlist, rawTitle),
      onToggleOwned: () => toggleSavedGame('library', ownedGames, setOwnedGames, game),
      onToggleWishlist: () => toggleSavedGame('wishlist', wishlist, setWishlist, game),
    }
  }, [ownedGames, wishlist, session])

  function syncedSetter(listType, setLocalGames) {
    return (updater) => {
      setLocalGames((currentGames) => {
        const nextGames =
          typeof updater === 'function' ? updater(currentGames) : updater

        if (session && supabase) {
          queueMicrotask(async () => {
            const currentKeys = new Set(
              currentGames.map((game) => titleKey(game.title))
            )
            const nextKeys = new Set(
              nextGames.map((game) => titleKey(game.title))
            )
            const removedKeys = [...currentKeys].filter((key) => !nextKeys.has(key))

            try {
              if (nextGames.length > 0) {
                const rows = nextGames.map((game) =>
                  toDatabaseRow(game, listType, session.user.id)
                )
                const { error } = await supabase
                  .from('saved_games')
                  .upsert(rows, { onConflict: 'user_id,list_type,title_key' })
                if (error) throw error
              }

              for (const removedKey of removedKeys) {
                const { error } = await supabase
                  .from('saved_games')
                  .delete()
                  .eq('user_id', session.user.id)
                  .eq('list_type', listType)
                  .eq('title_key', removedKey)
                if (error) throw error
              }
            } catch (error) {
              console.error('Could not sync saved games:', error.message)
              setSyncError(true)
            }
          })
        }

        return nextGames
      })
    }
  }

  async function toggleSavedGame(listType, currentGames, setGames, game) {
    const alreadySaved = currentGames.some(
      (saved) => titleKey(saved.title) === titleKey(game.title)
    )
    const nextGames = alreadySaved
      ? currentGames.filter((saved) => titleKey(saved.title) !== titleKey(game.title))
      : [...currentGames, { ...game, addedAt: game.addedAt || Date.now() }]

    setGames(nextGames)

    if (!session || !supabase) return

    try {
      if (alreadySaved) {
        const { error } = await supabase
          .from('saved_games')
          .delete()
          .eq('user_id', session.user.id)
          .eq('list_type', listType)
          .eq('title_key', titleKey(game.title))
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('saved_games')
          .upsert([toDatabaseRow(game, listType, session.user.id)], {
            onConflict: 'user_id,list_type,title_key',
          })
        if (error) throw error
      }
    } catch (error) {
      console.error('Could not update saved game:', error.message)
      setSyncError(true)
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header" id="top">
        <div className="header-inner">
          <div className="header-top">
            <a
              className="brand"
              href="/"
              onClick={(event) => {
                event.preventDefault()
                navigateTab('discover')
              }}
              aria-label="WishRadar home"
            >
              <span className="brand-mark" aria-hidden="true">
                <RadarMarkIcon size={24} />
              </span>
              <span className="brand-copy">
                <span className="brand-name">Wish<em>Radar</em></span>
                <span className="brand-caption">YOUR GAME INTELLIGENCE</span>
              </span>
            </a>
            <HeaderSearch
              submittedQuery={submittedSearch}
              submittedCategory={submittedCategory}
              onSearchSubmit={executeShellSearch}
              onSelectGame={handleOpenGameDetail}
            />
            <div className="shell-actions">
              <button
                type="button"
                className="wr-icon-btn wr-icon-btn--round shell-bell"
                aria-label="Notifications: no new alerts"
                title="Notifications"
              >
                <BellIcon size={20} />
              </button>
              {session ? (
                <div className="shell-account-menu">
                  <button
                    type="button"
                    className="shell-avatar"
                    aria-label="Open account menu"
                    aria-expanded={accountMenuOpen}
                    aria-controls="account-navigation-menu"
                    onClick={() => setAccountMenuOpen((open) => !open)}
                  >
                    {session.user.email?.trim().slice(0, 1).toUpperCase() || 'A'}
                  </button>
                  {accountMenuOpen && (
                    <div className="shell-account-dropdown" id="account-navigation-menu" role="menu">
                      <button type="button" role="menuitem" onClick={() => navigateTab('account')}>Profile &amp; Account</button>
                      <button type="button" role="menuitem" onClick={() => navigateTab('library')}>My Library ({ownedGames.length})</button>
                      <button type="button" role="menuitem" onClick={() => navigateTab('account')}>Connect Telegram</button>
                      <div className="shell-owned-games" role="group" aria-label="Owned games"><strong>Recent Owned ({ownedGames.length})</strong>{ownedGames.length ? ownedGames.slice(0, 4).map((game) => <span key={game.title}>{game.title}</span>) : <span>No owned games yet</span>}</div>
                      <button type="button" role="menuitem" onClick={() => navigateTab('news')}>News</button>
                      <span className="shell-account-dropdown__divider" role="separator" />
                      <button type="button" role="menuitem" className="shell-account-dropdown__signout" onClick={handleShellSignOut}>Sign out</button>
                    </div>
                  )}
                </div>
              ) : (
                <button type="button" className="wr-cta shell-sign-in" onClick={() => navigateTab('account')}>
                  Sign in
                </button>
              )}
            </div>
          </div>

        </div>
      </header>

      {syncError && (
        <div
          className="sync-error-banner"
          role="status"
          style={{
            position: 'fixed',
            top: '88px',
            right: '20px',
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '10px 14px',
            background: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: '14px',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
            color: 'var(--text)',
            fontSize: '13px',
            maxWidth: 'min(420px, calc(100vw - 32px))',
            boxSizing: 'border-box',
          }}
        >
          <span>Couldn&apos;t sync to your account. Your changes are saved on this device.</span>
          <button
            type="button"
            className="lr-button lr-button--ghost"
            style={{ minHeight: '28px', padding: '0 10px', fontSize: '12px' }}
            onClick={() => setSyncError(false)}
            aria-label="Dismiss sync warning"
          >
            Dismiss
          </button>
        </div>
      )}

      <main className="main-content">
        <ErrorBoundary key={tab}>
          <div key={tab} className="lr-page-enter">
            <Suspense fallback={<RouteFallback />}>
            {tab === 'free' && (
              <FreeNow
                library={ownedGames}
                getGameActions={saveActions}
                onAvailabilityChange={setAvailableFreeGames}
                activeTab={freeTab}
                onTabChange={navigateFreeTab}
                onGameOpen={NOOP}
                session={session}
                onNavigate={navigateTab}
              />
            )}
            {(tab === 'discover' || tab === 'search') && (
              <Discover
                library={ownedGames}
                wishlist={wishlist}
                session={session}
                getGameActions={saveActions}
                onNavigate={navigateTab}
                isSearchPage={tab === 'search'}
                searchQuery={submittedSearch}
                searchCategory={submittedCategory}
                onSearchChange={(q, cat) => {
                  setSubmittedSearch(q)
                  if (cat) setSubmittedCategory(cat)
                }}
                onOpenGameDetail={handleOpenGameDetail}
              />
            )}
            {tab === 'deals' && (
              <Deals getGameActions={saveActions} />
            )}
            {tab === 'library' && (
              <Library
                games={ownedGames}
                syncing={syncingLists}
                onAdd={(game) => toggleSavedGame('library', ownedGames, setOwnedGames, game)}
                onRemove={(title) => toggleSavedGame('library', ownedGames, setOwnedGames, { title })}
                onNavigate={navigateTab}
              />
            )}
            {tab === 'wishlist' && (
              <Wishlist
                games={wishlist}
                syncing={syncingLists}
                setGames={syncedSetter('wishlist', setWishlist)}
                ownedGames={ownedGames}
                freeGames={availableFreeGames}
                session={session}
                onNavigate={navigateTab}
              />
            )}
            {tab === 'news' && <News />}
            {tab === 'account' && (
              <Account
                session={session}
                onSignOut={signOut}
              />
            )}
            {tab === 'not-found' && (
              <section className="not-found-redesign" role="alert">
                <div className="lr-art-fallback" aria-hidden="true">404</div>
                <span className="lr-section-heading__kicker">RADAR LOST THE SIGNAL</span>
                <h1>Page <strong>Not Found</strong></h1>
                <p>That WishRadar page does not exist or the link may be outdated.</p>
                <button type="button" className="lr-button" onClick={() => navigateTab('discover')}>
                  Back to Home
                </button>
              </section>
            )}
            </Suspense>
          </div>
        </ErrorBoundary>
      </main>

      <Footer onNavigate={navigateTab} onNavigateFreeTab={navigateFreeTab} />

      {tab !== 'not-found' && !(tab === 'account' && !session) && tab !== 'signin' && tab !== 'signup' && <nav className="bottom-nav" aria-label="Main navigation">
        {TABS.map((t) => {
          const NavIcon = TAB_ICON_COMPONENTS[t.id] || CompassIcon
          const isActive = activeNavTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => navigateTab(t.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`nav-item ${isActive ? 'is-active' : ''}`}
            >
              <NavIcon
                className="nav-icon"
                size={22}
                strokeWidth={isActive ? 2 : 1.75}
              />
              <span className="nav-label">{t.label}</span>
              {t.id === 'wishlist' && wishlist.length > 0 && (
                <span className="nav-count" aria-label={`${wishlist.length} wishlisted games`}>
                  {wishlist.length}
                </span>
              )}
            </button>
          )
        })}
      </nav>}

      {selectedGameForModal && (
        <Suspense fallback={null}>
          <GameDetailModal
            game={selectedGameForModal}
            onClose={handleCloseGameDetail}
            triggerRef={gameModalTriggerRef}
            getGameActions={saveActions}
            sources={modalSources}
          />
        </Suspense>
      )}
    </div>
  )
}
