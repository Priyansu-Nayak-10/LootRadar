import { RadarMarkIcon } from './icons'

export default function Footer({ onNavigate, onNavigateFreeTab }) {
  function handleInternalClick(event, destination, subTab) {
    event.preventDefault()
    if (destination === 'telegram') {
      onNavigate?.('account')
      setTimeout(() => {
        const target = document.getElementById('telegram-settings')
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 100)
      return
    }

    if (destination === 'upcoming') {
      if (onNavigateFreeTab) {
        onNavigateFreeTab('coming')
      } else {
        onNavigate?.('free')
      }
      return
    }

    onNavigate?.(destination)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <footer className="app-footer">
      <div className="footer-inner">
        <div className="footer-grid">
          {/* Column 1: Brand */}
          <div className="footer-col footer-col--brand">
            <a
              href="/"
              className="footer-brand"
              onClick={(e) => handleInternalClick(e, 'discover')}
              aria-label="WishRadar home"
            >
              <span className="brand-mark footer-brand-mark" aria-hidden="true">
                <RadarMarkIcon size={22} />
              </span>
              <span className="brand-copy">
                <span className="brand-name">
                  Wish<span>Radar</span>
                </span>
              </span>
            </a>
            <p className="footer-tagline">
              Free games, PC deals and alerts for PC, PlayStation and Xbox players.
            </p>
          </div>

          {/* Column 2: Explore */}
          <div className="footer-col">
            <h4 className="footer-heading">Explore</h4>
            <ul className="footer-links">
              <li>
                <a
                  href="/"
                  className="footer-link"
                  onClick={(e) => handleInternalClick(e, 'discover')}
                >
                  Home
                </a>
              </li>
              <li>
                <a
                  href="/free"
                  className="footer-link"
                  onClick={(e) => handleInternalClick(e, 'free')}
                >
                  Free Now
                </a>
              </li>
              <li>
                <a
                  href="/deals"
                  className="footer-link"
                  onClick={(e) => handleInternalClick(e, 'deals')}
                >
                  Deals
                </a>
              </li>
              <li>
                <a
                  href="/free?tab=coming"
                  className="footer-link"
                  onClick={(e) => handleInternalClick(e, 'upcoming')}
                >
                  Upcoming
                </a>
              </li>
              <li>
                <a
                  href="/wishlist"
                  className="footer-link"
                  onClick={(e) => handleInternalClick(e, 'wishlist')}
                >
                  Wishlist
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Account */}
          <div className="footer-col">
            <h4 className="footer-heading">Account</h4>
            <ul className="footer-links">
              <li>
                <a
                  href="/account"
                  className="footer-link"
                  onClick={(e) => handleInternalClick(e, 'account')}
                >
                  Account
                </a>
              </li>
              <li>
                <a
                  href="/library"
                  className="footer-link"
                  onClick={(e) => handleInternalClick(e, 'library')}
                >
                  Library
                </a>
              </li>
              <li>
                <a
                  href="/account#telegram-settings"
                  className="footer-link"
                  onClick={(e) => handleInternalClick(e, 'telegram')}
                >
                  Telegram alerts
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: Data credits */}
          <div className="footer-col">
            <h4 className="footer-heading">Data Credits</h4>
            <ul className="footer-links footer-credits">
              <li>
                <a
                  href="https://rawg.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-link footer-link--ext"
                >
                  RAWG
                </a>
              </li>
              <li>
                <a
                  href="https://www.gamerpower.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-link footer-link--ext"
                >
                  GamerPower
                </a>
              </li>
              <li>
                <a
                  href="https://isthereanydeal.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-link footer-link--ext"
                >
                  Prices from IsThereAnyDeal
                </a>
              </li>
              <li>
                <a
                  href="https://www.freetogame.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-link footer-link--ext"
                >
                  FreeToGame
                </a>
              </li>
              <li className="footer-news-credits">
                <span className="footer-sublabel">News:</span>
                <a
                  href="https://www.ign.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-link footer-link--ext"
                >
                  IGN
                </a>
                <span className="footer-sep" aria-hidden="true">
                  {'\u00b7'}
                </span>
                <a
                  href="https://www.pcgamer.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-link footer-link--ext"
                >
                  PC Gamer
                </a>
                <span className="footer-sep" aria-hidden="true">
                  {'\u00b7'}
                </span>
                <a
                  href="https://www.gamespot.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-link footer-link--ext"
                >
                  GameSpot
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="footer-bottom">
          <span className="footer-copyright">
            {'\u00a9'} 2026 WishRadar
          </span>
          <p className="footer-disclaimer">
            Not affiliated with Steam, Epic Games, Sony or Microsoft. Prices and offers can change, so check the store before buying.
            {' '}Icons: Simple Icons via react-icons/si (CC0 1.0), Font Awesome Free via react-icons/fa6 (CC BY 4.0), Bootstrap Icons via react-icons/bs (MIT).
          </p>
        </div>
      </div>
    </footer>
  )
}
