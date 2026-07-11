'use client'

import * as React from 'react'

// ============================================================================
// 类型定义
// ============================================================================

export interface UseLazyBackgroundOptions {
  /** IntersectionObserver threshold，默认 0.1 */
  threshold?: number
  /** IntersectionObserver rootMargin，默认 '50px' */
  rootMargin?: string
  /** 加载前占位背景图 URL */
  placeholder?: string
}

export interface UseLazyBackgroundReturn<T extends HTMLElement = HTMLDivElement> {
  /** 绑定到目标元素的 ref */
  ref: React.RefObject<T | null>
  /** 背景图是否已加载完成 */
  isLoaded: boolean
}

// ============================================================================
// Hook
// ============================================================================

/**
 * 背景图懒加载 Hook
 *
 * - 使用 IntersectionObserver 监测元素是否进入视口
 * - 进入视口后预加载图片并设置 style.backgroundImage
 * - 支持 placeholder 占位图
 * - SSR 安全：服务端不创建 observer
 *
 * 用法：
 *   const { ref, isLoaded } = useLazyBackground('/bg.jpg', { placeholder: '/placeholder.jpg' })
 *   return <div ref={ref} className="hero" />
 */
export function useLazyBackground<T extends HTMLElement = HTMLDivElement>(
  src: string,
  options?: UseLazyBackgroundOptions,
): UseLazyBackgroundReturn<T> {
  const ref = React.useRef<T>(null)
  const [isLoaded, setLoaded] = React.useState(false)
  const [isIntersecting, setIntersecting] = React.useState(false)

  const threshold = options?.threshold ?? 0.1
  const rootMargin = options?.rootMargin ?? '50px'
  const placeholder = options?.placeholder

  // 设置占位背景
  React.useEffect(() => {
    if (!ref.current || !placeholder) return
    ref.current.style.backgroundImage = `url(${placeholder})`
  }, [placeholder])

  // IntersectionObserver 监测进入视口
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
      { threshold, rootMargin },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold, rootMargin])

  // 进入视口后加载真实背景图
  React.useEffect(() => {
    if (!isIntersecting || !src || isLoaded) return

    const img = new Image()
    img.onload = () => {
      if (ref.current) {
        ref.current.style.backgroundImage = `url(${src})`
      }
      setLoaded(true)
    }
    img.src = src
  }, [isIntersecting, src, isLoaded])

  return { ref, isLoaded }
}
