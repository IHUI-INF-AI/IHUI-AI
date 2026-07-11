'use client'

import * as React from 'react'

import { fetchApi } from '@/lib/api'

export interface TourSpot {
  id: string
  name: string
  description?: string
  images?: string[]
  location?: { lat: number; lng: number; address?: string }
  duration?: number
  price?: number
  rating?: number
}

export interface UseTourReturn {
  spots: TourSpot[]
  loading: boolean
  error: string | null
  fetchSpots: (params?: { keyword?: string; region?: string }) => Promise<void>
}

/** 旅游导览 Hook，拉取景点列表 */
export function useTour(): UseTourReturn {
  const [spots, setSpots] = React.useState<TourSpot[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const fetchSpots = React.useCallback(async (params?: { keyword?: string; region?: string }) => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams(
        Object.entries(params ?? {}).reduce<Record<string, string>>((acc, [k, v]) => {
          if (v) acc[k] = v
          return acc
        }, {}),
      ).toString()
      const url = qs ? `/api/tour/spots?${qs}` : '/api/tour/spots'
      const res = await fetchApi<TourSpot[]>(url)
      if (res.success) {
        setSpots(res.data)
      } else {
        setError(res.error)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  return { spots, loading, error, fetchSpots }
}
