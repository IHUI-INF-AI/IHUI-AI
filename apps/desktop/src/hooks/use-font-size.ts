import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'ihui-font-scale'
export const MIN_SCALE = 0.8
export const MAX_SCALE = 1.6
export const DEFAULT_SCALE = 1
const STEP = 0.1

/** 解析为有效 scale(限制范围)。 */
function parseScale(v: string | null): number {
  const n = v ? parseFloat(v) : NaN
  if (Number.isNaN(n)) return DEFAULT_SCALE
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, n))
}

/** 把 scale 应用到 documentElement(CSS 变量 --font-scale)。 */
function applyFontSize(scale: number): void {
  document.documentElement.style.setProperty('--font-scale', String(scale))
}

/** 初始化字号:在 React 渲染前调用(main.tsx),避免布局跳动。 */
export function initFontSize(): number {
  const scale = parseScale(localStorage.getItem(STORAGE_KEY))
  applyFontSize(scale)
  return scale
}

/** 字号 hook:返回当前 scale 与操作函数,自动持久化。 */
export function useFontSize(): {
  scale: number
  zoomIn: () => void
  zoomOut: () => void
  reset: () => void
  setScale: (s: number) => void
} {
  const [scale, setScaleState] = useState<number>(() => {
    if (typeof window === 'undefined') return DEFAULT_SCALE
    return parseScale(localStorage.getItem(STORAGE_KEY))
  })

  useEffect(() => {
    applyFontSize(scale)
  }, [scale])

  const persist = useCallback((s: number) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(s))
    } catch {
      // 忽略隐私模式
    }
  }, [])

  const setScale = useCallback(
    (s: number) => {
      const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round(s * 100) / 100))
      setScaleState(clamped)
      persist(clamped)
    },
    [persist],
  )

  const zoomIn = useCallback(() => setScale(scale + STEP), [scale, setScale])
  const zoomOut = useCallback(() => setScale(scale - STEP), [scale, setScale])
  const reset = useCallback(() => setScale(DEFAULT_SCALE), [setScale])

  return { scale, zoomIn, zoomOut, reset, setScale }
}
