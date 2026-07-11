'use client'

import * as React from 'react'

import { fetchApi } from '@/lib/api'

export interface DramaScript {
  id: string
  title: string
  characters: string[]
  scenes: DramaScene[]
  genre?: string
  synopsis?: string
}

export interface DramaScene {
  index: number
  location?: string
  time?: string
  dialogue: Array<{
    character: string
    line: string
    emotion?: string
    action?: string
  }>
}

export interface UseDramaScriptReturn {
  script: DramaScript | null
  loading: boolean
  error: string | null
  enhance: (scriptId: string) => Promise<void>
  enhanceLine: (scriptId: string, sceneIndex: number, lineIndex: number) => Promise<string | null>
}

/** 剧本增强 Hook，支持整体增强与单行改写 */
export function useDramaScript(): UseDramaScriptReturn {
  const [script, setScript] = React.useState<DramaScript | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const enhance = React.useCallback(async (scriptId: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchApi<DramaScript>(`/api/drama/scripts/${scriptId}/enhance`, {
        method: 'POST',
      })
      if (res.success) {
        setScript(res.data)
      } else {
        setError(res.error)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const enhanceLine = React.useCallback(
    async (scriptId: string, sceneIndex: number, lineIndex: number) => {
      const res = await fetchApi<{ line: string }>(
        `/api/drama/scripts/${scriptId}/scenes/${sceneIndex}/lines/${lineIndex}/enhance`,
        { method: 'POST' },
      )
      return res.success ? res.data.line : null
    },
    [],
  )

  return { script, loading, error, enhance, enhanceLine }
}
