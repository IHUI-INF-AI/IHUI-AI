'use client'

import * as React from 'react'

/** 检测点击发生在指定元素外部时触发回调 */
export function useClickOutside<T extends HTMLElement>(
  callback: () => void,
): React.RefObject<T | null> {
  const ref = React.useRef<T>(null)

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = (event: MouseEvent | TouchEvent) => {
      const el = ref.current
      if (el && !el.contains(event.target as Node)) {
        callback()
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [callback])

  return ref
}
