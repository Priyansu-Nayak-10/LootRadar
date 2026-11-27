import { memo } from 'react'
import SafeImage from './SafeImage'
import PlatformIcons from './PlatformIcons'

export const SearchSuggestions = memo(function SearchSuggestions({
  suggestions = [],
  loading = false,
  error = null,
  query = '',
  highlightedIndex = -1,
  listId = 'search-suggestions-list',
  onSelectGame,
  onSubmitSearch,
  onHoverIndex,
}) {
  return (
    <div
      className="search-suggestions"
      id={listId}
      role="listbox"
      aria-label="Search suggestions"
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* 1. Loading Skeleton */}
      {loading && suggestions.length === 0 && (
        <div className="search-suggestions__skeleton" aria-busy="true">
          {[1, 2, 3].map((n) => (
            <div key={n} className="search-suggestions__skeleton-row">
              <div className="search-suggestions__skeleton-thumb lr-skeleton" />
              <div className="search-suggestions__skeleton-meta">
                <div className="search-suggestions__skeleton-line search-suggestions__skeleton-line--title lr-skeleton" />
                <div className="search-suggestions__skeleton-line search-suggestions__skeleton-line--sub lr-skeleton" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 2. Error / Missing RAWG Key Notice */}
      {!loading && error && (
        <div className="search-suggestions__notice" role="status">
          {error === 'KEY_MISSING' ? (
            <p>
              Add your free RAWG API key to <code>.env.local</code> to enable game suggestions.
            </p>
          ) : (
            <p>Suggestions unavailable right now.</p>
          )}
        </div>
      )}

      {/* 3. Empty State (No games found) */}
      {!loading && !error && suggestions.length === 0 && query.trim().length >= 2 && (
        <div className="search-suggestions__empty" role="status">
          No games found for &ldquo;{query.trim()}&rdquo;
        </div>
      )}

      {/* 4. Suggestions List */}
      {suggestions.map((game, idx) => {
        const releaseYear = game.released ? game.released.slice(0, 4) : ''
        const rating = Number(game.rating) > 0 ? Number(game.rating).toFixed(1) : null

        return (
          <div
            key={game.id}
            id={`${listId}-opt-${idx}`}
            role="option"
            aria-selected={highlightedIndex === idx}
            className={`search-suggestions__item ${
              highlightedIndex === idx ? 'is-active' : ''
            }`}
            onClick={(e) => {
              e.preventDefault()
              if (onSelectGame) onSelectGame(game)
            }}
            onMouseEnter={() => {
              if (onHoverIndex) onHoverIndex(idx)
            }}
          >
            <SafeImage
              src={game.background_image}
              alt=""
              className="search-suggestions__thumb"
              loading="eager"
            />
            <div className="search-suggestions__info">
              <strong className="search-suggestions__title">{game.name}</strong>
              <div className="search-suggestions__meta">
                {releaseYear && <span>{releaseYear}</span>}
                {releaseYear && rating && <span>·</span>}
                {rating && <span className="search-suggestions__rating">★ {rating}</span>}
                {(releaseYear || rating) && game.platforms?.length > 0 && <span>·</span>}
                <div className="search-suggestions__platforms">
                  <PlatformIcons platforms={game.platforms} size={14} />
                </div>
              </div>
            </div>
          </div>
        )
      })}

      {/* 5. "See all results" Row */}
      {suggestions.length > 0 && (
        <button
          type="button"
          id={`${listId}-opt-${suggestions.length}`}
          role="option"
          aria-selected={highlightedIndex === suggestions.length}
          className={`search-suggestions__see-all ${
            highlightedIndex === suggestions.length ? 'is-active' : ''
          }`}
          onClick={(e) => {
            e.preventDefault()
            if (onSubmitSearch) onSubmitSearch(query)
          }}
          onMouseEnter={() => {
            if (onHoverIndex) onHoverIndex(suggestions.length)
          }}
        >
          Search for &ldquo;{query.trim()}&rdquo;
        </button>
      )}
    </div>
  )
})

export default SearchSuggestions
