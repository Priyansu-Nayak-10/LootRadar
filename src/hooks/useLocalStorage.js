import { useEffect, useState } from 'react';

/**
 * Keep a piece of React state in sync with localStorage when it is available.
 * If storage is empty, blocked, or contains invalid JSON, the app still works
 * with the provided initial value for the current session.
 */
export default function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const storedValue = window.localStorage.getItem(key);

      if (storedValue !== null) {
        return JSON.parse(storedValue);
      }
    } catch {
      // Storage can be disabled by the browser, or contain invalid JSON.
    }

    return typeof initialValue === 'function' ? initialValue() : initialValue;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Keep the in-memory state usable even when saving is unavailable.
    }
  }, [key, value]);

  return [value, setValue];
}
