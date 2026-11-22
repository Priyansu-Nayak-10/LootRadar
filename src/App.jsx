import { useCallback, useEffect, useState } from 'react'
import FreeNow from './pages/FreeNow'
import Discover from './pages/Discover'
import Deals from './pages/Deals'
import Library from './pages/Library'
import Wishlist from './pages/Wishlist'
import Rumors from './pages/Rumors'
import News from './pages/News'
import Account from './pages/Account'
import useLocalStorage from './hooks/useLocalStorage'
import cachedFetch from './lib/cachedFetch'
import { hasSupabaseConfig, supabase } from './lib/supabase'
import './App.css'

const TABS = [
  { id: 'discover', label: 'Home' },
  { id: 'free', label: 'Free Now' },
  { id: 'deals', label: 'Deals' },
  { id: 'wishlist', label: 'Wishlist' },
]

const TAB_ICONS = {
  free: 'M12 3v2m0 14v2m9-9h-2M5 12H3m15.36-6.36-1.42 1.42M7.06 16.94l-1.42 1.42m12.72 0-1.42-1.42M7.06 7.06 5.64 5.64M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  discover: 'M12 3 14.8 9.2 21 12l-6.2 2.8L12 21l-2.8-6.2L3 12l6.2-2.8L12 3Zm0 6v6m-3-3h6',
  deals: 'm20 13-7 7L3 10V3h7l10 10Zm-12-6h.01',
  wishlist: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z',
  news: 'M4 5h16v14H4V5Zm3 4h10M7 13h6M7 16h8',
  account: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0',
}

function titleKey(title) {
  return title.trim().toLocaleLowerCase()
}

function mergeSavedGames(localGames, databaseRows, listType) {
  const merged = new Map()

  for (const game of localGames) {
    merged.set(titleKey(game.title), { ...game })
  }
  for (const row of databaseRows) {
    if (row.list_type !== listType) continue
    merged.set(titleKey(row.title), {
      title: row.title,
      platform: row.platform || '',
      image: row.image || '',
      notes: row.notes || '',
      source: row.source || '',
      sourceId: row.source_id || '',
    })
  }

  return [...merged.values()]
}

function toDatabaseRow(game, listType, userId) {
  return {
    user_id: userId,
    list_type: listType,
    title: game.title,
    platform: game.platform || '',
    image: game.image || '',
    notes: game.notes || '',
    source: game.source || '',
    source_id: game.sourceId || '',
  }
}

export default function App() {
  const [tab, setTab] = useState('discover')
  const [ownedGames, setOwnedGames] = useLocalStorage('lootradar_library', [])
  const [wishlist, setWishlist] = useLocalStorage('lootradar_wishlist', [])
  const [availableFreeGames, setAvailableFreeGames] = useState([])
  const [availableDeals, setAvailableDeals] = useState([])
  const [dealsAvailabilityLoaded, setDealsAvailabilityLoaded] = useState(false)
  const [session, setSession] = useState(null)
  const [shellSearch, setShellSearch] = useState('')
  const [shellCategory, setShellCategory] = useState('All')
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
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
      try {
        const { data: rows, error } = await supabase
          .from('saved_games')
          .select('*')
          .eq('user_id', session.user.id)

        if (error) throw error

        let localLibrary = []
        let localWishlist = []
        try {
          localLibrary = JSON.parse(window.localStorage.getItem('lootradar_library') || '[]')
          localWishlist = JSON.parse(window.localStorage.getItem('lootradar_wishlist') || '[]')
        } catch {
          // Keep database rows when local JSON is unavailable or invalid.
        }

        const databaseRows = Array.isArray(rows) ? rows : []
        const mergedLibrary = mergeSavedGames(localLibrary, databaseRows, 'library')
        const mergedWishlist = mergeSavedGames(localWishlist, databaseRows, 'wishlist')

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
      } catch (error) {
        console.error('Could not sync saved games:', error.message)
      }
    }

    syncSavedGames()
    return () => {
      cancelled = true
    }
  }, [session, setOwnedGames, setWishlist])

  useEffect(() => {
    const knownTabs = [
        'discover', 'free', 'deals', 'library', 'wishlist',
        'always', 'coming', 'rumors', 'news', 'account',
    ]
    function readRoute() {
      const pathTab = window.location.pathname.replace(/^\/+|\/+$/g, '')
      const hashTab = window.location.hash.replace(/^#\/?/, '')
      const route = pathTab || hashTab || 'discover'
      if (route === 'more') {
        window.history.replaceState({}, '', '/')
        setTab('discover')
        return
      }
      if (route === 'coming' || route === 'always') {
        const nextFreeTab = route === 'coming' ? 'coming' : 'always'
        window.history.replaceState({}, '', `/free?tab=${nextFreeTab}`)
        setFreeTab(nextFreeTab)
        setTab('free')
        return
      }
      setFreeTab(route === 'free' && ['coming', 'always'].includes(new URLSearchParams(window.location.search).get('tab')) ? new URLSearchParams(window.location.search).get('tab') : 'claim')
      setTab(knownTabs.includes(route) ? route : 'not-found')
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
    setTab(nextTab)
    window.history.pushState({}, '', nextTab === 'discover' ? '/' : `/${nextTab}`)
  }

  function navigateFreeTab(nextFreeTab) {
    setFreeTab(nextFreeTab)
    setTab('free')
    window.history.pushState({}, '', nextFreeTab === 'claim' ? '/free' : `/free?tab=${nextFreeTab}`)
  }

  function submitShellSearch(event) {
    event.preventDefault()
    const query = shellSearch.trim()
    navigateTab('discover')
    if (query) {
      window.dispatchEvent(new CustomEvent('lootradar-shell-search', {
        detail: { query, category: shellCategory },
      }))
    }
  }

  async function signOut() {
    if (!supabase) return
    await supabase.auth.signOut()
  }

  async function handleShellSignOut() {
    setAccountMenuOpen(false)
    await signOut()
    navigateTab('account')
  }

  const updateAvailableDeals = useCallback((games) => {
    setAvailableDeals(games)
    setDealsAvailabilityLoaded(true)
  }, [])

  useEffect(() => {
    if (tab !== 'wishlist' || dealsAvailabilityLoaded) return undefined

    let cancelled = false
    const params = new URLSearchParams({
      onSale: '1',
      pageSize: '60',
      sortBy: 'Savings',
      desc: '1',
      upperPrice: '15',
    })

    cachedFetch(`https://www.cheapshark.com/api/1.0/deals?${params}`)
      .then((data) => {
        if (!cancelled) updateAvailableDeals(Array.isArray(data) ? data : [])
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setDealsAvailabilityLoaded(true)
      })

    return () => {
      cancelled = true
    }
  }, [tab, dealsAvailabilityLoaded, updateAvailableDeals])

  function gameIsSaved(games, title) {
    return games.some((game) => titleKey(game.title) === titleKey(title))
  }

  function saveActions(game) {
    return {
      owned: gameIsSaved(ownedGames, game.title),
      wishlisted: gameIsSaved(wishlist, game.title),
      onToggleOwned: () => toggleSavedGame('library', ownedGames, setOwnedGames, game),
      onToggleWishlist: () => toggleSavedGame('wishlist', wishlist, setWishlist, game),
    }
  }

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
      : [...currentGames, game]

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
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header" id="top">
        <div className="header-inner">
          <div className="header-top">
            <a className="brand" href="/" aria-label="LootRadar home">
              <span className="brand-mark" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.7">
                  <circle cx="12" cy="12" r="8.5" />
                  <circle cx="12" cy="12" r="4.5" />
                  <path d="m12 12 6.2-6.2M12 3.5v2M3.5 12h2" strokeLinecap="round" />
                  <circle cx="12" cy="12" r="1" fill="currentColor" />
                </svg>
              </span>
              <span className="brand-copy">
                <span className="brand-name">Loot<span>Radar</span></span>
                <span className="brand-caption">YOUR GAME INTELLIGENCE</span>
              </span>
            </a>
            <form className="shell-search" onSubmit={submitShellSearch} role="search">
              <label className="shell-category">
                <span className="sr-only">Search category</span>
                <select
                  value={shellCategory}
                  onChange={(event) => setShellCategory(event.target.value)}
                  aria-label="Search category"
                >
                  {['All', 'PC', 'PlayStation', 'Xbox'].map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </label>
              <input
                value={shellSearch}
                onChange={(event) => setShellSearch(event.target.value)}
                placeholder="Search games"
                aria-label="Search games"
              />
              <button type="submit" aria-label="Submit game search">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <circle cx="10.5" cy="10.5" r="6.5" />
                  <path d="m15.5 15.5 4 4" strokeLinecap="round" />
                </svg>
              </button>
            </form>
            <div className="shell-actions">
              <button
                type="button"
                className="shell-icon-button shell-bell"
                aria-label="Notifications: no new alerts"
                title="Notifications"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
                  <path d="M10 20h4" strokeLinecap="round" />
                </svg>
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
                      <button type="button" role="menuitem" onClick={() => navigateTab('account')}>Connect Telegram</button>
                      <button type="button" role="menuitem" onClick={() => navigateTab('library')}>Owned Games</button>
                      <button type="button" role="menuitem" onClick={() => navigateTab('news')}>News</button>
                      <span className="shell-account-dropdown__divider" role="separator" />
                      <button type="button" role="menuitem" className="shell-account-dropdown__signout" onClick={handleShellSignOut}>Sign out</button>
                    </div>
                  )}
                </div>
              ) : (
                <button type="button" className="shell-sign-in" onClick={() => navigateTab('account')}>
                  Sign in
                </button>
              )}
            </div>
          </div>

        </div>
      </header>

      <main className="main-content">
        {tab === 'free' && (
          <FreeNow
            getGameActions={saveActions}
            onAvailabilityChange={setAvailableFreeGames}
            activeTab={freeTab}
            onTabChange={navigateFreeTab}
          />
        )}
        {tab === 'discover' && (
          <Discover
            library={ownedGames}
            wishlist={wishlist}
            session={session}
            getGameActions={saveActions}
            onNavigate={navigateTab}
          />
        )}
        {tab === 'deals' && (
          <Deals
            getGameActions={saveActions}
            onAvailabilityChange={updateAvailableDeals}
          />
        )}
        {tab === 'library' && (
          <Library
            games={ownedGames}
            setGames={syncedSetter('library', setOwnedGames)}
          />
        )}
        {tab === 'wishlist' && (
          <Wishlist
            games={wishlist}
            setGames={syncedSetter('wishlist', setWishlist)}
            freeGames={availableFreeGames}
            deals={availableDeals}
          />
        )}
        {tab === 'rumors' && <Rumors />}
        {tab === 'news' && <News />}
        {tab === 'account' && (
          <Account
            session={session}
          />
        )}
        {tab === 'not-found' && (
          <section className="not-found-redesign" role="alert">
            <div className="lr-art-fallback" aria-hidden="true">404</div>
            <span className="lr-section-heading__kicker">RADAR LOST THE SIGNAL</span>
            <h1>Page <strong>Not Found</strong></h1>
            <p>That LootRadar page does not exist or the link may be outdated.</p>
            <button type="button" className="lr-button" onClick={() => navigateTab('discover')}>
              Back to Home
            </button>
          </section>
        )}
      </main>

      <footer className="app-footer">
        Data from{' '}
        <a href="https://www.gamerpower.com" target="_blank" rel="noreferrer" className="underline">
          GamerPower
        </a>{' '}
        and{' '}
        <a href="https://www.cheapshark.com" target="_blank" rel="noreferrer" className="underline">
          CheapShark
        </a>{' '}
        and game data from{' '}
        <a href="https://rawg.io" target="_blank" rel="noreferrer" className="underline">
          RAWG
        </a>{' '}
        and free-to-play data from{' '}
        <a href="https://www.freetogame.com" target="_blank" rel="noreferrer" className="underline">
          FreeToGame
        </a>
      </footer>

      {tab !== 'not-found' && !(tab === 'account' && !session) && <nav className="bottom-nav" aria-label="Main navigation">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => navigateTab(t.id)}
            aria-current={activeNavTab === t.id ? 'page' : undefined}
            className={`nav-item ${activeNavTab === t.id ? 'is-active' : ''}`}
          >
            <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={TAB_ICONS[t.id]} />
            </svg>
            <span className="nav-label">{t.label}</span>
            {t.id === 'wishlist' && wishlist.length > 0 && (
              <span className="nav-count" aria-label={`${wishlist.length} wishlisted games`}>
                {wishlist.length}
              </span>
            )}
          </button>
        ))}
      </nav>}
    </div>
  )
}
