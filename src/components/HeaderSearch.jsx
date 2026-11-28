import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { useGameSuggestions } from '../hooks/useGameSuggestions'
import { SearchIcon, ChevronDownIcon } from './icons'

const loadSearchSuggestions = () => import('./SearchSuggestions')
const SearchSuggestions = lazy(loadSearchSuggestions)

function SuggestionsFallback() {
  return (
    <div className="search-suggestions" role="listbox" aria-label="Loading suggestions">
      {[0, 1, 2].map((i) => (
        <div key={i} className="search-suggestions__skeleton" aria-hidden="true">
          <div className="search-suggestions__skeleton-thumb lr-skeleton" />
          <div className="search-suggestions__skeleton-text">
            <div className="lr-skeleton" style={{ width: '65%', height: 14 }} />
            <div className="lr-skeleton" style={{ width: '40%', height: 11 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function HeaderSearch({
  submittedQuery = '',
  submittedCategory = 'All',
  onSearchSubmit,
  onSelectGame,
}) {
  const [query, setQuery] = useState(submittedQuery)
  const [category, setCategory] = useState(submittedCategory)
  const searchFormRef = useRef(null)
  const searchInputRef = useRef(null)

  useEffect(() => {
    setQuery(submittedQuery)
  }, [submittedQuery])

  useEffect(() => {
    setCategory(submittedCategory)
  }, [submittedCategory])

  const headerSuggestions = useGameSuggestions({
    category,
    onSelectGame: (game) => {
      onSelectGame?.(game, searchInputRef.current)
    },
    onSubmitSearch: (q) => {
      onSearchSubmit?.(q, category)
    },
  })

  useEffect(() => {
    function handleClickOutside(event) {
      if (searchFormRef.current && !searchFormRef.current.contains(event.target)) {
        headerSuggestions.close()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [headerSuggestions])

  function submitShellSearch(event) {
    if (event?.preventDefault) event.preventDefault()
    headerSuggestions.close()
    onSearchSubmit?.(query, category)
  }

  return (
    <form
      className="shell-search"
      onSubmit={submitShellSearch}
      role="search"
      ref={searchFormRef}
    >
      <label className="shell-category">
        <span className="sr-only">Search category</span>
        <select
          value={category}
          onChange={(event) => {
            setCategory(event.target.value)
            headerSuggestions.close()
          }}
          aria-label="Search category"
        >
          {['All', 'PC', 'PlayStation', 'Xbox'].map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <ChevronDownIcon size={14} className="shell-category__chevron" />
      </label>
      <div className="shell-search-combo">
        <input
          ref={searchInputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            headerSuggestions.handleInputChange(event.target.value)
          }}
          onKeyDown={headerSuggestions.handleKeyDown}
          onFocus={() => {
            loadSearchSuggestions()
            if (headerSuggestions.suggestions.length > 0 || query.trim().length >= 2) {
              headerSuggestions.setIsOpen(true)
            }
          }}
          placeholder="Search games"
          aria-label="Search all games across PC and consoles"
          role="combobox"
          aria-expanded={headerSuggestions.isOpen}
          aria-controls="shell-suggestions-list"
          aria-activedescendant={
            headerSuggestions.highlightedIndex >= 0
              ? `shell-suggestions-list-opt-${headerSuggestions.highlightedIndex}`
              : undefined
          }
          autoComplete="off"
        />
        {headerSuggestions.isOpen && (
          <Suspense fallback={<SuggestionsFallback />}>
            <SearchSuggestions
              suggestions={headerSuggestions.suggestions}
              loading={headerSuggestions.loading}
              error={headerSuggestions.error}
              query={query}
              highlightedIndex={headerSuggestions.highlightedIndex}
              listId="shell-suggestions-list"
              onSelectGame={(game) => {
                onSelectGame?.(game, searchInputRef.current)
                headerSuggestions.close()
              }}
              onSubmitSearch={(q) => {
                onSearchSubmit?.(q, category)
                headerSuggestions.close()
              }}
              onHoverIndex={headerSuggestions.setHighlightedIndex}
            />
          </Suspense>
        )}
      </div>
      <button type="submit" aria-label="Search">
        <SearchIcon size={16} strokeWidth={2} />
      </button>
    </form>
  )
}
