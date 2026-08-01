'use client'

import * as React from 'react'

export interface UseLazyImageReturn {
  ref: React.RefObject<HTMLImageElement | null>
  isLoaded: boolean
  currentSrc: string | null
}

/**
 * 懒加载图片 Hook。
 *
 * - 使用 IntersectionObserver 检测元素是否进入视口
 * - 进入视口后加载图片,加载完成后更新 currentSrc
 * - 支持 placeholder(加载前显示)
 * - SSR 安全:在服务端不创建 observer
 *
 * 用法:
 *   const { ref, isLoaded, currentSrc } = useLazyImage(realSrc, placeholder)
 *   return <img ref={ref} src={currentSrc ?? undefined} />
 */
export function useLazyImage(src: string, placeholder?: string): UseLazyImageReturn {
  const ref = React.useRef<HTMLImageElement>(null)
  const [isIntersecting, setIntersecting] = React.useState(false)
  const [isLoaded, setLoaded] = React.useState(false)
  const [currentSrc, setCurrentSrc] = React.useState<string | null>(placeholder ?? null)

  React.useEffect(() => {
    if (typeof window === 'undefined' || !ref.current) return
    const el = ref.current
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIntersecting(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  React.useEffect(() => {
    if (!isIntersecting || !src || isLoaded) return
    // 2026-08-02 修复: Image 未清理, 卸载后 setState - 添加 cancelled 标志 + cleanup 中清除 onload
    let cancelled = false
    const img = new Image()
    img.onload = () => {
      if (cancelled) return
      setCurrentSrc(src)
      setLoaded(true)
    }
    img.onerror = () => {
      // 加载失败保留 placeholder
    }
    img.src = src
    return () => {
      cancelled = true
      img.onload = null
      img.onerror = null
    }
  }, [isIntersecting, src, isLoaded])

  return { ref, isLoaded, currentSrc }
}
