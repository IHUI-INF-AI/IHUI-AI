'use client'

/**
 * useHoverPreview — hover 状态管理 hook(2026-07-28 立)
 *
 * 用于通用 hover 浮出预览卡场景:
 * - PlanStep / SubAgentCard / ToolCallCard 等列表项 hover 时显示摘要
 * - 250ms 延迟显示,避免误触
 * - 100ms 延迟关闭,允许用户移入预览卡操作
 * - 键盘 focus 触发显示(无障碍)
 * - 屏幕边界检测,避免浮层超出视口
 *
 * 典型用法:
 * ```tsx
 * const anchorRef = useRef<HTMLDivElement>(null)
 * const { visible, position, content, hoverHandlers, close } = useHoverPreview({
 *   buildContent: (step) => <StepSummary step={step} />,
 *   anchorRef,
 *   data: step,
 * })
 * return (
 *   <>
 *     <div ref={anchorRef} {...hoverHandlers}>{step.title}</div>
 *     <HoverPreviewCard visible={visible} position={position} content={content} onClose={close} />
 *   </>
 * )
 * ```
 */

import * as React from 'react'

export interface UseHoverPreviewOptions<T> {
  /** 预览内容构造函数(data 为 null 时不调用) */
  buildContent: (data: T) => React.ReactNode
  /** 触发 hover 的元素 ref */
  anchorRef: React.RefObject<HTMLElement | null>
  /** 预览数据,null 表示无预览 */
  data: T | null
  /** 显示延迟 ms,默认 250 */
  delayMs?: number
  /** 关闭延迟 ms,默认 100 */
  closeDelayMs?: number
  /** 距 anchor 边缘偏移 px,默认 8 */
  offset?: number
  /** 浮层宽,用于边界检测,默认 240 */
  width?: number
  /** 浮层高,用于边界检测,默认 140 */
  height?: number
}

export interface UseHoverPreviewReturn {
  /** 是否可见 */
  visible: boolean
  /** 浮层位置(屏幕坐标) */
  position: { x: number; y: number }
  /** 构建好的内容(可直接传给 HoverPreviewCard.content) */
  content: React.ReactNode
  /** hover 事件 handlers(挂在 anchor 元素上) */
  hoverHandlers: {
    onMouseEnter: (e: React.MouseEvent) => void
    onMouseLeave: (e: React.MouseEvent) => void
    onFocus: (e: React.FocusEvent) => void
    onBlur: (e: React.FocusEvent) => void
  }
  /** 手动关闭 */
  close: () => void
}

interface PreviewGeometry {
  x: number
  y: number
}

function clampToViewport(
  desired: PreviewGeometry,
  width: number,
  height: number,
  offset: number,
): PreviewGeometry {
  if (typeof window === 'undefined') return desired
  const vw = window.innerWidth
  const vh = window.innerHeight
  let { x, y } = desired
  // 右边界
  if (x + width > vw) {
    x = Math.max(offset, vw - width - offset)
  }
  // 下边界
  if (y + height > vh) {
    y = Math.max(offset, vh - height - offset)
  }
  // 左/上兜底
  if (x < offset) x = offset
  if (y < offset) y = offset
  return { x, y }
}

export function useHoverPreview<T>({
  buildContent,
  anchorRef,
  data,
  delayMs = 250,
  closeDelayMs = 100,
  offset = 8,
  width = 240,
  height = 140,
}: UseHoverPreviewOptions<T>): UseHoverPreviewReturn {
  const [visible, setVisible] = React.useState(false)
  const [position, setPosition] = React.useState<PreviewGeometry>({ x: 0, y: 0 })
  const [content, setContent] = React.useState<React.ReactNode>(null)

  const showTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const dataRef = React.useRef<T | null>(data)
  dataRef.current = data

  const clearTimers = React.useCallback(() => {
    if (showTimerRef.current !== null) {
      clearTimeout(showTimerRef.current)
      showTimerRef.current = null
    }
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const close = React.useCallback(() => {
    clearTimers()
    setVisible(false)
  }, [clearTimers])

  const computePositionFromRect = React.useCallback(
    (rect: DOMRect): PreviewGeometry => {
      const desired: PreviewGeometry = {
        x: rect.right + offset,
        y: rect.bottom + offset,
      }
      return clampToViewport(desired, width, height, offset)
    },
    [height, offset, width],
  )

  const show = React.useCallback(() => {
    const current = dataRef.current
    if (current === null) return
    const anchor = anchorRef.current
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    setPosition(computePositionFromRect(rect))
    setContent(buildContent(current))
    setVisible(true)
  }, [anchorRef, buildContent, computePositionFromRect])

  const scheduleShow = React.useCallback(() => {
    // 取消挂起的关闭
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    // 已有挂起的显示
    if (showTimerRef.current !== null) return
    // data 为 null 不显示
    if (dataRef.current === null) return
    showTimerRef.current = setTimeout(() => {
      showTimerRef.current = null
      show()
    }, delayMs)
  }, [delayMs, show])

  const scheduleClose = React.useCallback(() => {
    if (showTimerRef.current !== null) {
      clearTimeout(showTimerRef.current)
      showTimerRef.current = null
    }
    if (closeTimerRef.current !== null) return
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null
      close()
    }, closeDelayMs)
  }, [close, closeDelayMs])

  const onMouseEnter = React.useCallback(() => {
    scheduleShow()
  }, [scheduleShow])

  const onMouseLeave = React.useCallback(() => {
    scheduleClose()
  }, [scheduleClose])

  const onFocus = React.useCallback(() => {
    scheduleShow()
  }, [scheduleShow])

  const onBlur = React.useCallback(() => {
    scheduleClose()
  }, [scheduleClose])

  // data 变 null 时立即关闭
  React.useEffect(() => {
    if (data === null && visible) {
      clearTimers()
      setVisible(false)
    }
  }, [data, visible, clearTimers])

  // 卸载清理
  React.useEffect(() => {
    return () => clearTimers()
  }, [clearTimers])

  return {
    visible,
    position,
    content,
    hoverHandlers: { onMouseEnter, onMouseLeave, onFocus, onBlur },
    close,
  }
}

export default useHoverPreview
