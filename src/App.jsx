import { useCallback, useEffect, useState } from 'react'
import FreeNow from './pages/FreeNow'
import Discover from './pages/Discover'
import Deals from './pages/Deals'
import Library from './pages/Library'
import Wishlist from './pages/Wishlist'
import useLocalStorage from './hooks/useLocalStorage'
import cachedFetch from './lib/cachedFetch'
import './App.css'

const TABS = [
  { id: 'discover', label: 'Discover' },
  { id: 'free', label: 'Free Now' },
  { id: 'deals', label: 'Deals' },
  { id: 'library', label: 'Library' },
  { id: 'wishlist', label: 'Wishlist' },
]

const TAB_DESCRIPTIONS = {
  free: 'Limited-time games you can claim right now',
  discover: 'New releases, upcoming games, trends, and gaming news',
  deals: 'Games on sale right now',
  library: 'Games you own',
  wishlist: 'Games you want to play',
}

const TAB_ICONS = {
  free: 'M12 3v2m0 14v2m9-9h-2M5 12H3m15.36-6.36-1.42 1.42M7.06 16.94l-1.42 1.42m12.72 0-1.42-1.42M7.06 7.06 5.64 5.64M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  discover: 'M12 3 14.8 9.2 21 12l-6.2 2.8L12 21l-2.8-6.2L3 12l6.2-2.8L12 3Zm0 6v6m-3-3h6',
  deals: 'm20 13-7 7L3 10V3h7l10 10Zm-12-6h.01',
  library: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5v-12ZM4 6h16M8 10h8m-8 4h6',
  wishlist: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z',
}

function titleKey(title) {
  return title.trim().toLocaleLowerCase()
}

function toggleGame(setGames, game) {
  setGames((current) => {
    const alreadySaved = current.some((saved) => titleKey(saved.title) === titleKey(game.title))
    return alreadySaved
      ? current.filter((saved) => titleKey(saved.title) !== titleKey(game.title))
      : [...current, game]
  })
}

export default function App() {
  const [tab, setTab] = useState('discover')
  const [ownedGames, setOwnedGames] = useLocalStorage('lootradar_library', [])
  const [wishlist, setWishlist] = useLocalStorage('lootradar_wishlist', [])
  const [availableFreeGames, setAvailableFreeGames] = useState([])
  const [availableDeals, setAvailableDeals] = useState([])
  const [dealsAvailabilityLoaded, setDealsAvailabilityLoaded] = useState(false)

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
      onToggleOwned: () => toggleGame(setOwnedGames, game),
      onToggleWishlist: () => toggleGame(setWishlist, game),
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
            <div className="system-status"><span className="status-light" />YOUR RADAR</div>
          </div>

          <div className="hero-header" id="top">
            <div>
              <div className="hero-eyebrow">YOUR PERSONAL GAME RADAR</div>
              <h2 className="hero-title">{TABS.find((item) => item.id === tab)?.label}</h2>
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
          />
        )}
        {tab === 'deals' && (
          <Deals
            getGameActions={saveActions}
            onAvailabilityChange={updateAvailableDeals}
          />
        )}
        {tab === 'library' && <Library games={ownedGames} setGames={setOwnedGames} />}
        {tab === 'wishlist' && (
          <Wishlist
            games={wishlist}
            setGames={setWishlist}
            freeGames={availableFreeGames}
            deals={availableDeals}
          />
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
        </a>
      </footer>

      <nav className="bottom-nav" aria-label="Main navigation">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
            className={`nav-item ${tab === t.id ? 'is-active' : ''}`}
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
