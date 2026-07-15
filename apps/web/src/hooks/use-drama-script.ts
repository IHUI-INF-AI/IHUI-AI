'use client'

import * as React from 'react'

import { fetchApi } from '@/lib/api'

export interface DramaEnhanceResult {
  consistency: unknown
  pacing: unknown
  outline: unknown
}

export interface DramaLineRewrite {
  original: string
  rewritten: string
  sceneIndex: number
  lineIndex: number
}

export interface UseDramaScriptReturn {
  enhanceResult: DramaEnhanceResult | null
  lineRewrite: DramaLineRewrite | null
  loading: boolean
  error: string | null
  enhance: (scriptId: string, title?: string) => Promise<void>
  enhanceLine: (
    scriptId: string,
    sceneIndex: number,
    lineIndex: number,
    content: string,
    instruction?: string,
  ) => Promise<DramaLineRewrite | null>
  reset: () => void
}

export function useDramaScript(): UseDramaScriptReturn {
  const [enhanceResult, setEnhanceResult] = React.useState<DramaEnhanceResult | null>(null)
  const [lineRewrite, setLineRewrite] = React.useState<DramaLineRewrite | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const enhance = React.useCallback(async (scriptId: string, title?: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchApi<DramaEnhanceResult>(`/api/drama/scripts/${scriptId}/enhance`, {
        method: 'POST',
        body: JSON.stringify(title ? { title } : {}),
      })
      if (res.success) {
        setEnhanceResult(res.data)
      } else {
        setError(res.error)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const enhanceLine = React.useCallback(
    async (
      scriptId: string,
      sceneIndex: number,
      lineIndex: number,
      content: string,
      instruction?: string,
    ) => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetchApi<DramaLineRewrite>(
          `/api/drama/scripts/${scriptId}/scenes/${sceneIndex}/lines/${lineIndex}/enhance`,
          {
            method: 'POST',
            body: JSON.stringify({ content, instruction: instruction || undefined }),
          },
        )
        if (res.success) {
          setLineRewrite(res.data)
          return res.data
        }
        setError(res.error)
        return null
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const reset = React.useCallback(() => {
    setEnhanceResult(null)
    setLineRewrite(null)
    setError(null)
  }, [])

  return { enhanceResult, lineRewrite, loading, error, enhance, enhanceLine, reset }
}
