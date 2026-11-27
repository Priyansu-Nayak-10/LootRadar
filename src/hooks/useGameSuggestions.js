import { useState, useRef, useEffect, useCallback } from 'react'
import { fetchRawgSuggestions } from '../lib/discoverApi'

/**
 * Custom hook for debounced typeahead game suggestions with caching,
 * abort handling, out-of-order response guard, and combobox keyboard navigation.
 */
export function useGameSuggestions({
  category = 'All',
  onSelectGame,
  onSubmitSearch,
  debounceMs = 300,
} = {}) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  const abortRef = useRef(null)
  const timerRef = useRef(null)
  const requestIdRef = useRef(0)

  const close = useCallback(() => {
    setIsOpen(false)
    setHighlightedIndex(-1)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (abortRef.current) abortRef.current.abort()
  }, [])

  const clear = useCallback(() => {
    setQuery('')
    setSuggestions([])
    setError(null)
    close()
  }, [close])

  const handleInputChange = useCallback(
    (newVal) => {
      setQuery(newVal)
      setHighlightedIndex(-1)

      if (timerRef.current) clearTimeout(timerRef.current)
      if (abortRef.current) abortRef.current.abort()

      const trimmed = newVal.trim()
      if (trimmed.length < 2) {
        setSuggestions([])
        setError(null)
        setLoading(false)
        setIsOpen(false)
        return
      }

      setLoading(true)
      setIsOpen(true)
      setError(null)

      timerRef.current = setTimeout(async () => {
        const currentReqId = ++requestIdRef.current
        const controller = new AbortController()
        abortRef.current = controller

        try {
          const results = await fetchRawgSuggestions(trimmed, category, controller.signal)
          // Ensure this response is the latest requested and not aborted
          if (currentReqId === requestIdRef.current && !controller.signal.aborted) {
            setSuggestions(results)
            setLoading(false)
            setError(null)
            setIsOpen(true)
          }
        } catch (err) {
          if (currentReqId === requestIdRef.current && err.name !== 'AbortError' && !controller.signal.aborted) {
            setSuggestions([])
            setLoading(false)
            if (err.message === 'RAWG_KEY_MISSING' || err.code === 'RAWG_KEY_MISSING') {
              setError('KEY_MISSING')
            } else {
              setError('FETCH_FAILED')
            }
            setIsOpen(true)
          }
        }
      }, debounceMs)
    },
    [category, debounceMs]
  )

  const handleKeyDown = useCallback(
    (event) => {
      if (!isOpen) {
        if (event.key === 'ArrowDown' && suggestions.length > 0) {
          event.preventDefault()
          setIsOpen(true)
          setHighlightedIndex(0)
        }
        return
      }

      const totalItems = suggestions.length > 0 ? suggestions.length + 1 : 0 // +1 for "See all results"

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        if (totalItems > 0) {
          setHighlightedIndex((prev) => (prev + 1) % totalItems)
        }
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        if (totalItems > 0) {
          setHighlightedIndex((prev) => (prev <= 0 ? totalItems - 1 : prev - 1))
        }
      } else if (event.key === 'Escape') {
        event.preventDefault()
        close()
      } else if (event.key === 'Enter') {
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          event.preventDefault()
          const selected = suggestions[highlightedIndex]
          if (onSelectGame) onSelectGame(selected)
          close()
        } else if (highlightedIndex === suggestions.length && suggestions.length > 0) {
          event.preventDefault()
          if (onSubmitSearch) onSubmitSearch(query)
          close()
        } else {
          // No suggestion row selected -> let normal form submit execute or call onSubmitSearch
          if (onSubmitSearch) {
            onSubmitSearch(query)
            close()
          }
        }
      }
    },
    [isOpen, suggestions, highlightedIndex, onSelectGame, onSubmitSearch, query, close]
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (abortRef.current) abortRef.current.abort()
    }
  }, [])

  return {
    query,
    setQuery,
    suggestions,
    loading,
    error,
    isOpen,
    setIsOpen,
    highlightedIndex,
    setHighlightedIndex,
    handleInputChange,
    handleKeyDown,
    close,
    clear,
  }
}
