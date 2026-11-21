import { useCallback, useEffect, useState } from 'react'
import FreeNow from './pages/FreeNow'
import Discover from './pages/Discover'
import Deals from './pages/Deals'
import Library from './pages/Library'
import Wishlist from './pages/Wishlist'
import AlwaysFree from './pages/AlwaysFree'
import ComingSoon from './pages/ComingSoon'
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
  { id: 'library', label: 'Library' },
  { id: 'more', label: 'More' },
]

const TAB_DESCRIPTIONS = {
  free: 'Limited-time games you can claim right now',
  discover: 'Search games, trending PC titles, and the latest gaming news',
  deals: 'Games on sale right now',
  library: 'Games you own',
  wishlist: 'Games you want to play',
  more: 'Always Free, Coming Soon, and rumor reports',
  always: 'Free-to-play games that are always available',
  coming: 'Confirmed upcoming Epic free games',
  rumors: 'Unconfirmed free-game reports, clearly labelled',
  news: 'Latest gaming headlines and publisher links',
  account: 'Sign in or create a LootRadar account',
}

const TAB_ICONS = {
  free: 'M12 3v2m0 14v2m9-9h-2M5 12H3m15.36-6.36-1.42 1.42M7.06 16.94l-1.42 1.42m12.72 0-1.42-1.42M7.06 7.06 5.64 5.64M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  discover: 'M12 3 14.8 9.2 21 12l-6.2 2.8L12 21l-2.8-6.2L3 12l6.2-2.8L12 3Zm0 6v6m-3-3h6',
  deals: 'm20 13-7 7L3 10V3h7l10 10Zm-12-6h.01',
  library: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5v-12ZM4 6h16M8 10h8m-8 4h6',
  wishlist: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
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
  const [avatarOpen, setAvatarOpen] = useState(false)
  const activeNavTab = ['always', 'coming', 'rumors', 'wishlist', 'news', 'account'].includes(tab) ? 'more' : tab

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
    function readHash() {
      const hashTab = window.location.hash.replace(/^#\/?/, '')
      if (hashTab) setTab(hashTab)
    }
    readHash()
    window.addEventListener('hashchange', readHash)
    return () => window.removeEventListener('hashchange', readHash)
  }, [])

  function navigateTab(nextTab) {
    setTab(nextTab)
    window.location.hash = `/${nextTab}`
    setAvatarOpen(false)
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
    setAvatarOpen(false)
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
      <header className="app-header">
        <div className="header-inner">
          <div className="header-top">
            <a className="brand" href="#top" aria-label="LootRadar home">
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
              <div className="shell-avatar-wrap">
                <button
                  type="button"
                  className="shell-avatar"
                  aria-label="Open account menu"
                  aria-expanded={avatarOpen}
                  onClick={() => setAvatarOpen((open) => !open)}
                >
                  {session?.user?.email?.trim().slice(0, 1).toUpperCase() || 'G'}
                </button>
                {avatarOpen && (
                  <div className="shell-avatar-menu" role="menu">
                    <button type="button" role="menuitem" onClick={() => navigateTab('library')}>
                      Library
                    </button>
                    <button type="button" role="menuitem" onClick={() => navigateTab('wishlist')}>
                      Wishlist
                    </button>
                    <button type="button" role="menuitem" onClick={() => navigateTab('account')}>
                      Telegram settings
                    </button>
                    {session && (
                      <button type="button" role="menuitem" onClick={signOut}>
                        Sign out
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="hero-header" id="top">
            <div>
              <div className="hero-eyebrow">YOUR PERSONAL GAME RADAR</div>
              <h2 className="hero-title">
                {TABS.find((item) => item.id === tab)?.label ||
                  ({ always: 'Always Free', coming: 'Coming Soon', rumors: 'Rumors', news: 'News', wishlist: 'Wishlist', account: 'Account' }[tab])}
              </h2>
              <p className="hero-description">{TAB_DESCRIPTIONS[tab]}</p>
            </div>
            <div className="hero-aside">
              <span className="hero-aside-label">BUILT FOR YOUR BACKLOG</span>
              <strong>Discover. Save. Play.</strong>
              <span>Free games, deals, and your collection.</span>
            </div>
          </div>
        </div>
      </header>

      <main className="main-content">
        {tab === 'free' && (
          <FreeNow
            getGameActions={saveActions}
            onAvailabilityChange={setAvailableFreeGames}
          />
        )}
        {tab === 'discover' && (
          <Discover
            library={ownedGames}
            wishlist={wishlist}
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
        {tab === 'more' && (
          <section className="more-section">
            <div className="game-grid">
              <button type="button" className="game-card more-card" onClick={() => navigateTab('always')}>
                <div className="game-card-content">
                  <span className="discover-kicker">ALWAYS AVAILABLE</span>
                  <h2 className="game-title">Always Free</h2>
                  <p className="game-platform">Free-to-play games from FreeToGame</p>
                </div>
              </button>
              <button type="button" className="game-card more-card" onClick={() => navigateTab('coming')}>
                <div className="game-card-content">
                  <span className="discover-kicker">EPIC CONFIRMATIONS</span>
                  <h2 className="game-title">Coming Soon</h2>
                  <p className="game-platform">Confirmed upcoming free promotions</p>
                </div>
              </button>
              <button type="button" className="game-card more-card" onClick={() => navigateTab('rumors')}>
                <div className="game-card-content">
                  <span className="discover-kicker">UNCONFIRMED</span>
                  <h2 className="game-title">Rumors</h2>
                  <p className="game-platform">Reports clearly labelled as rumors</p>
                </div>
              </button>
              <button type="button" className="game-card more-card" onClick={() => navigateTab('wishlist')}>
                <div className="game-card-content">
                  <span className="discover-kicker">YOUR SAVED GAMES</span>
                  <h2 className="game-title">Wishlist</h2>
                  <p className="game-platform">{wishlist.length} saved</p>
                </div>
              </button>
              <button type="button" className="game-card more-card" onClick={() => navigateTab('news')}>
                <div className="game-card-content">
                  <span className="discover-kicker">LATEST HEADLINES</span>
                  <h2 className="game-title">News</h2>
                  <p className="game-platform">Newsroom feeds and publisher links</p>
                </div>
              </button>
              <button type="button" className="game-card more-card" onClick={() => navigateTab('account')}>
                <div className="game-card-content">
                  <span className="discover-kicker">YOUR ACCOUNT</span>
                  <h2 className="game-title">Account</h2>
                  <p className="game-platform">
                    {session ? session.user.email : 'Sign in or create an account'}
                  </p>
                </div>
              </button>
            </div>
          </section>
        )}
        {tab === 'always' && <AlwaysFree getGameActions={saveActions} />}
        {tab === 'coming' && <ComingSoon />}
        {tab === 'rumors' && <Rumors />}
        {tab === 'news' && <News />}
        {tab === 'account' && <Account session={session} />}
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

      <nav className="bottom-nav" aria-label="Main navigation">
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
      </nav>
    </div>
  )
}
