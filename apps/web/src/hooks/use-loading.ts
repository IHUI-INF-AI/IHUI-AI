'use client'

import * as React from 'react'

export interface UseLoadingReturn {
  isLoading: boolean
  startLoading: () => void
  stopLoading: () => void
  withLoading: <T>(promise: Promise<T>) => Promise<T>
}

export function useLoading(): UseLoadingReturn {
  const [isLoading, setLoading] = React.useState(false)

  const startLoading = React.useCallback(() => setLoading(true), [])
  const stopLoading = React.useCallback(() => setLoading(false), [])

  const withLoading = React.useCallback(
    async <T>(promise: Promise<T>): Promise<T> => {
      setLoading(true)
      try {
        return await promise
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  return { isLoading, startLoading, stopLoading, withLoading }
}
