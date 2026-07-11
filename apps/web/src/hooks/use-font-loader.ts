'use client'

import * as React from 'react'

export interface FontInfo {
  family: string
  displayName: string
  category?: string
  variants?: string[]
}

export interface UseFontLoaderReturn {
  loadedFonts: Set<string>
  loading: boolean
  error: string | null
  loadFont: (font: FontInfo) => Promise<boolean>
  isLoaded: (family: string) => boolean
}

/** 字体加载 Hook，使用 FontFace API 动态加载字体并追踪状态 */
export function useFontLoader(): UseFontLoaderReturn {
  const [loadedFonts, setLoadedFonts] = React.useState<Set<string>>(new Set())
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const loadFont = React.useCallback(async (font: FontInfo): Promise<boolean> => {
    setLoading(true)
    setError(null)
    try {
      const url = `/api/fonts/${encodeURIComponent(font.family)}.woff2`
      const fontFace = new FontFace(font.family, `url(${url})`)
      await fontFace.load()
      document.fonts.add(fontFace)
      setLoadedFonts((prev) => new Set(prev).add(font.family))
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : '字体加载失败')
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  const isLoaded = React.useCallback((family: string) => loadedFonts.has(family), [loadedFonts])

  return { loadedFonts, loading, error, loadFont, isLoaded }
}
