import { useSyncExternalStore } from 'react'

const TICK_MS = 60000
const listeners = new Set()
let currentNow = Date.now()
let intervalId = null

function subscribe(listener) {
  listeners.add(listener)
  if (listeners.size === 1 && intervalId === null) {
    currentNow = Date.now()
    intervalId = setInterval(() => {
      currentNow = Date.now()
      for (const fn of listeners) {
        fn()
      }
    }, TICK_MS)
  }

  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
    }
  }
}

function getSnapshot() {
  return currentNow
}

function getServerSnapshot() {
  return currentNow
}

/**
 * Subscribes to a single shared 60-second clock.
 * Only one setInterval exists across the entire app while >= 1 subscriber is mounted.
 */
export function useNow() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
