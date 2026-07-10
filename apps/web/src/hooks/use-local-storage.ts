'use client'

import * as React from 'react'

export type SetLocalStorageValue<T> = (value: T | ((prev: T) => T)) => void

export function useLocalStorage<T>(
  key: string,
  initial: T,
): [T, SetLocalStorageValue<T>, () => void] {
  const [stored, setStored] = React.useState<T>(() => {
    if (typeof window === 'undefined') return initial
    try {
      const item = window.localStorage.getItem(key)
      return item ? (JSON.parse(item) as T) : initial
    } catch {
      return initial
    }
  })

  const setValue = React.useCallback<SetLocalStorageValue<T>>(
    (value) => {
      setStored((prev) => {
        const next = value instanceof Function ? value(prev) : value
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem(key, JSON.stringify(next))
          } catch {
            /* quota exceeded or unavailable */
          }
        }
        return next
      })
    },
    [key],
  )

  const remove = React.useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(key)
    }
    setStored(initial)
  }, [key, initial])

  return [stored, setValue, remove]
}
