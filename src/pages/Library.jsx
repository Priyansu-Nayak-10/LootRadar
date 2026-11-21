import { useState } from 'react'

const PLATFORMS = ['Steam', 'Epic', 'GOG', 'PlayStation', 'Xbox', 'Other']

function titleKey(title) {
  return title.trim().toLocaleLowerCase()
}

export default function Library({ games, setGames }) {
  const [title, setTitle] = useState('')
  const [platform, setPlatform] = useState('Steam')
  const [image, setImage] = useState('')
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState('')

  function addGame(event) {
    event.preventDefault()
    const cleanTitle = title.trim()

    if (!cleanTitle) {
      setMessage('Please enter a game title.')
      return
    }

    if (games.some((game) => titleKey(game.title) === titleKey(cleanTitle))) {
      setMessage(`'${cleanTitle}' is already in your Library.`)
      return
    }

    setGames((current) => [
      ...current,
      {
        title: cleanTitle,
        platform,
        image: image.trim(),
        notes: notes.trim(),
        source: 'manual',
      },
    ])
    setTitle('')
    setPlatform('Steam')
    setImage('')
    setNotes('')
    setMessage(`${cleanTitle} added to your Library.`)
  }

  function removeGame(titleToRemove) {
    setGames((current) =>
      current.filter((game) => titleKey(game.title) !== titleKey(titleToRemove))
    )
  }

  return (
    <div className="collections-redesign library-redesign">
      <header className="redesign-page-header">
        <div>
          <span className="lr-section-heading__kicker">MY COLLECTION</span>
          <h1>My <strong>Library</strong></h1>
        </div>
        <span className="lr-badge">{games.length} games</span>
      </header>
      <section className="form-panel collection-section collection-add-panel">
        <h2 className="form-heading">Add a game manually</h2>
        <form onSubmit={addGame} className="form-grid">
          <label className="form-field">
            Game title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={100}
              required
              placeholder="For example, Stardew Valley"
            />
          </label>

          <label className="form-field">
            Platform
            <select
              value={platform}
              onChange={(event) => setPlatform(event.target.value)}
            >
              {PLATFORMS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field is-wide">
            Image URL <span className="form-optional">(optional)</span>
            <input
              type="url"
              value={image}
              onChange={(event) => setImage(event.target.value)}
              placeholder="https://example.com/game-image.jpg"
            />
          </label>

          <label className="form-field is-wide">
            Notes <span className="form-optional">(optional)</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              maxLength={300}
              placeholder="Anything you want to remember about this game"
            />
          </label>

          {message && (
            <p role="status" className="form-message">
              {message}
            </p>
          )}

          <button
            type="submit"
            className="form-submit"
          >
            Add to Library
          </button>
        </form>
      </section>

      <section className="collection-section">
        <h2 className="section-heading">
          My games <span className="section-count">({games.length})</span>
        </h2>

        {games.length === 0 ? (
          <p className="empty-state">
            Your Library is empty. Add a game above or mark one as owned from Free Now or Deals.
          </p>
        ) : (
          <div className="collection-grid">
            {games.map((game, index) => (
              <article
                key={`${titleKey(game.title)}-${index}`}
                className="lr-card collection-card redesign-collection-card"
              >
                {game.image ? (
                  <img
                    src={game.image}
                    alt=""
                    loading="lazy"
                    className="collection-image"
                  />
                ) : (
                  <div className="collection-fallback" aria-hidden="true">
                    GAME
                  </div>
                )}
                <div className="collection-copy">
                  <h3 className="collection-title">{game.title}</h3>
                  <p className="collection-platform">{game.platform || 'Platform not set'}</p>
                  {game.notes && <p className="collection-notes">{game.notes}</p>}
                  <button
                    type="button"
                    onClick={() => removeGame(game.title)}
                    className="remove-button"
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
