import { useEffect, useMemo, useState } from 'react'
import GameActions from '../components/GameActions'
import cachedFetch from '../lib/cachedFetch'

const CHEAPSHARK = 'https://www.cheapshark.com/api/1.0'

const keyOf = (value = '') => value.trim().toLocaleLowerCase()
const money = (value) => Number.isFinite(Number(value)) ? `$${Number(value).toFixed(2)} USD` : '—'

export default function GameDetail({ gameId, getGameActions, wishlist, setWishlist }) {
  const [state, setState] = useState({ loading: true, error: '', deals: [], stores: [], image: '', title: '' })

  useEffect(() => {
    let cancelled = false
    const title = decodeURIComponent(gameId || '').trim()
    if (!title) {
      setState({ loading: false, error: 'Game not found.', deals: [], stores: [], image: '', title: '' })
      return undefined
    }
    Promise.all([
      fetch('/data/cheapshark-deals.json').then((response) => response.ok ? response.json() : null),
      fetch('/data/gamerpower-free-games.json').then((response) => response.ok ? response.json() : null),
    ]).then(async ([dealSnapshot, freeSnapshot]) => {
      const snapshotDeals = Array.isArray(dealSnapshot?.deals) ? dealSnapshot.deals : []
      const matchingDeals = snapshotDeals.filter((deal) => keyOf(deal.title) === keyOf(title))
      const freeGame = (Array.isArray(freeSnapshot?.games) ? freeSnapshot.games : []).find((game) => keyOf(game.title) === keyOf(title))
      let liveDeals = matchingDeals
      try {
        const query = new URLSearchParams({ title, limit: '20', exact: '1' })
        const data = await cachedFetch(`${CHEAPSHARK}/deals?${query}`)
        if (Array.isArray(data) && data.length) liveDeals = data
      } catch {
        // Snapshot prices remain available offline.
      }
      if (!matchingDeals.length && !freeGame && !liveDeals.length) throw new Error('Game not found.')
      if (!cancelled) setState({ loading: false, error: '', deals: liveDeals, stores: Array.isArray(dealSnapshot?.stores) ? dealSnapshot.stores : [], image: freeGame?.thumbnail || matchingDeals[0]?.thumb || liveDeals[0]?.thumb || '', title: freeGame?.title || matchingDeals[0]?.title || liveDeals[0]?.title || title })
    }).catch((error) => { if (!cancelled) setState({ loading: false, error: error.message || 'Could not load game details.', deals: [], stores: [], image: '', title }) })
    return () => { cancelled = true }
  }, [gameId])

  const savedGame = useMemo(() => wishlist.find((game) => keyOf(game.title) === keyOf(state.title)), [wishlist, state.title])
  const actions = getGameActions({ title: state.title, platform: 'PC', image: state.image, source: 'game-detail', sourceId: gameId })
  const lowest = state.deals.length ? Math.min(...state.deals.map((deal) => Number(deal.salePrice)).filter(Number.isFinite)) : null

  function updateAlert(updates) {
    if (!savedGame) return
    setWishlist((current) => current.map((game) => keyOf(game.title) === keyOf(state.title) ? { ...game, ...updates } : game))
  }

  if (state.loading) return <section className="game-detail"><div className="lr-skeleton game-detail__skeleton" /></section>
  if (state.error) return <section className="game-detail"><div className="inline-error" role="alert">{state.error}</div></section>

  return <section className="game-detail">
    <div className="game-detail__hero">
      {state.image ? <img src={state.image} alt={state.title} /> : <div className="lr-art-fallback">{state.title.slice(0, 1).toUpperCase()}</div>}
      <div><span className="lr-section-heading__kicker">GAME DETAILS</span><h1>{state.title}</h1><p>{lowest == null ? 'No active CheapShark price found.' : `Best current price ${money(lowest)}`}</p><GameActions {...actions} /></div>
    </div>
    <section className="game-detail__section"><h2>Current <strong>prices</strong></h2>{state.deals.length ? <div className="game-detail__prices">{state.deals.map((deal) => <a key={deal.dealID} href={`${CHEAPSHARK}/redirect?dealID=${deal.dealID}`} target="_blank" rel="noreferrer"><span>{deal.storeName || state.stores.find((store) => store.storeID === deal.storeID)?.storeName || 'Store'}</span><del>{money(deal.normalPrice)}</del><strong>{money(deal.salePrice)}</strong></a>)}</div> : <p className="empty-state">No current store prices are available.</p>}</section>
    <section className="game-detail__section"><h2>Price <strong>history</strong></h2><div className="game-detail__history-empty">No price history yet. CheapShark does not provide a timeline for this game.</div></section>
    <section className="game-detail__section"><h2>Wishlist <strong>alerts</strong></h2>{savedGame ? <div className="game-detail__alerts"><label><input type="checkbox" checked={savedGame.alertOnFree !== false} onChange={(event) => updateAlert({ alertOnFree: event.target.checked })} /> Notify when free</label><label>Discount at least <input type="number" min="1" max="100" value={savedGame.alertDiscountPercent ?? ''} onChange={(event) => updateAlert({ alertDiscountPercent: event.target.value })} />%</label><label>Target price <input type="number" min="0" step="0.01" value={savedGame.alertTargetPrice ?? ''} onChange={(event) => updateAlert({ alertTargetPrice: event.target.value })} /> USD</label></div> : <p className="empty-state">Add this game to your Wishlist to configure price alerts.</p>}</section>
  </section>
}
