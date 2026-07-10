'use client'

import * as React from 'react'

export interface UseIntersectionObserverReturn<T extends Element = Element> {
  ref: React.RefObject<T | null>
  isIntersecting: boolean
}

/** 交叉观察器，用于懒加载、无限滚动等场景 */
export function useIntersectionObserver<T extends Element = Element>(
  options?: IntersectionObserverInit,
): UseIntersectionObserverReturn<T> {
  const ref = React.useRef<T>(null)
  const [isIntersecting, setIntersecting] = React.useState(false)

  React.useEffect(() => {
    if (typeof window === 'undefined' || !ref.current) return
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]) setIntersecting(entries[0].isIntersecting)
    }, options)
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [options?.root, options?.rootMargin, options?.threshold])

  return { ref, isIntersecting }
}

export interface UseLazyImageReturn {
  ref: React.RefObject<HTMLImageElement | null>
  isLoaded: boolean
  src: string | null
}

/** 懒加载图片：元素需设置 data-src 属性，进入视口后读取 */
export function useLazyImage(): UseLazyImageReturn {
  const { ref, isIntersecting } = useIntersectionObserver<HTMLImageElement>({ threshold: 0.1 })
  const [src, setSrc] = React.useState<string | null>(null)
  const [isLoaded, setLoaded] = React.useState(false)

  React.useEffect(() => {
    if (isIntersecting && ref.current) {
      const dataSrc = ref.current.dataset.src
      if (dataSrc) {
        setSrc(dataSrc)
        setLoaded(true)
      }
    }
  }, [isIntersecting, ref])

  return { ref, isLoaded, src }
}
