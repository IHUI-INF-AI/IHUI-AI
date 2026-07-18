import * as React from 'react'

interface UseTextareaAutoHeightOptions {
  /** 内容 ≤ N 行的阈值,低于此值用 rows 原生渲染,默认 60(3 行) */
  threeLinePx?: number
  /** 最大高度,超出后滚动,默认 120(6 行) */
  maxHeightPx?: number
}

/**
 * textarea 自动高度 hook:空内容用 rows 原生渲染,有内容按 scrollHeight 撑高,超 maxHeightPx 保持最大高度 + 滚动条。
 * padding 必须由 textarea 外层容器提供,避免滚动时 padding-top 被吃掉。
 */
export function useTextareaAutoHeight<T extends HTMLTextAreaElement>(
  value: string,
  options: UseTextareaAutoHeightOptions = {},
) {
  const { threeLinePx = 60, maxHeightPx = 120 } = options
  const ref = React.useRef<T>(null)

  const resize = React.useCallback(() => {
    const el = ref.current
    if (!el) return
    if (!el.value) {
      el.style.height = ''
      el.style.overflowY = 'hidden'
      return
    }
    el.style.height = 'auto'
    const sh = el.scrollHeight
    if (sh < threeLinePx) {
      el.style.height = ''
      el.style.overflowY = 'hidden'
    } else if (sh <= maxHeightPx) {
      el.style.height = `${sh}px`
      el.style.overflowY = 'hidden'
    } else {
      el.style.height = `${maxHeightPx}px`
      el.style.overflowY = 'auto'
    }
  }, [threeLinePx, maxHeightPx])

  React.useEffect(() => {
    resize()
  }, [value, resize])

  return { ref, resize }
}
