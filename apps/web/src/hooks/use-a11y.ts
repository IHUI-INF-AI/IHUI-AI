'use client'

import * as React from 'react'

export interface UseA11yReturn {
  /** 是否启用高对比度 */
  highContrast: boolean
  /** 字体放大倍数 */
  fontScale: number
  /** 是否显示焦点指示器 */
  focusVisible: boolean
  /** 是否减少动效 */
  reduceMotion: boolean
  toggleHighContrast: () => void
  setFontScale: (scale: number) => void
  toggleReduceMotion: () => void
  announce: (message: string) => void
}

/** 无障碍辅助 Hook，管理高对比度/字体缩放/动效偏好，并同步到 document 根属性 */
export function useA11y(): UseA11yReturn {
  const [highContrast, setHighContrast] = React.useState(false)
  const [fontScale, setFontScaleState] = React.useState(1)
  const [reduceMotion, setReduceMotion] = React.useState(false)

  const focusVisible = React.useMemo(() => {
    if (typeof window === 'undefined') return true
    return window.matchMedia('(prefers-reduced-motion: no-preference)').matches
  }, [])

  // 同步根属性，供 CSS 选择器读取
  React.useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-contrast', highContrast ? 'high' : 'normal')
    root.style.setProperty('--font-scale', String(fontScale))
    root.setAttribute('data-reduce-motion', reduceMotion ? 'true' : 'false')
  }, [highContrast, fontScale, reduceMotion])

  const announce = React.useCallback((message: string) => {
    const live = document.createElement('div')
    live.setAttribute('aria-live', 'polite')
    live.setAttribute('class', 'sr-only')
    live.textContent = message
    document.body.appendChild(live)
    setTimeout(() => live.remove(), 1000)
  }, [])

  return {
    highContrast,
    fontScale,
    focusVisible,
    reduceMotion,
    toggleHighContrast: () => setHighContrast((v) => !v),
    setFontScale: setFontScaleState,
    toggleReduceMotion: () => setReduceMotion((v) => !v),
    announce,
  }
}
