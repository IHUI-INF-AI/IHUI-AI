'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { useClickOutside } from '@/hooks/use-click-outside'

interface PopoverProps {
  content: React.ReactNode
  children: React.ReactElement
  position?: 'top' | 'right' | 'bottom' | 'left'
  trigger?: 'click' | 'hover'
  /** 弹出层 a11y 描述;不传时回退到 children 的 aria-label/文本 */
  'aria-label'?: string
  className?: string
  /**
   * true 时把弹层 portal 到 document.body 并用 fixed 定位,
   * 通过 trigger.getBoundingClientRect() 计算坐标。
   * 解决祖先 overflow:hidden 裁剪弹层的问题(如 MainShell h-screen overflow-hidden)。
   * 默认 false(沿用 absolute 定位,保持向后兼容)。
   */
  portal?: boolean
  /**
   * portal 模式下沿用旧 absolute 行为的对齐方向(top|bottom|left|right) + 间距(px)。
   * 默认 { side: position, gap: 8 }。可显式覆盖,例如弹层要"底部对齐 trigger"用
   * { side: 'right', align: 'bottom', gap: 8 }。
   */
  align?: 'start' | 'center' | 'end'
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Popover({
  content,
  children,
  position = 'bottom',
  trigger = 'click',
  'aria-label': ariaLabel,
  className,
  portal = false,
  align = 'center',
}: PopoverProps) {
  const [open, setOpen] = React.useState(false)
  const contentRef = React.useRef<HTMLDivElement | null>(null)
  const triggerElRef = React.useRef<HTMLElement | null>(null)
  // 包装 div 引用,click-outside 用
  const ref = useClickOutside<HTMLDivElement>(React.useCallback(() => setOpen(false), []))

  // portal 模式:动态计算 fixed 坐标(随 trigger 滚动/resize 同步)
  const [coords, setCoords] = React.useState<{ top: number; left: number } | null>(null)
  const updateCoords = React.useCallback(() => {
    if (!portal || !triggerElRef.current) return
    const r = triggerElRef.current.getBoundingClientRect()
    const gap = 8
    let top = 0
    let left = 0
    // 主方向
    if (position === 'right') {
      left = r.right + gap
      // 对齐
      if (align === 'start') top = r.top
      else if (align === 'end') top = r.bottom
      else top = r.top + r.height / 2
    } else if (position === 'left') {
      left = r.left - gap
      if (align === 'start') top = r.top
      else if (align === 'end') top = r.bottom
      else top = r.top + r.height / 2
    } else if (position === 'top') {
      top = r.top - gap
      if (align === 'start') left = r.left
      else if (align === 'end') left = r.right
      else left = r.left + r.width / 2
    } else {
      // bottom
      top = r.bottom + gap
      if (align === 'start') left = r.left
      else if (align === 'end') left = r.right
      else left = r.left + r.width / 2
    }
    setCoords({ top, left })
  }, [portal, position, align])

  React.useEffect(() => {
    if (!open || !portal) return
    updateCoords()
    // 同步 trigger 位置变化(滚动/resize)
    window.addEventListener('scroll', updateCoords, true)
    window.addEventListener('resize', updateCoords)
    // 监听 trigger 自身尺寸变化(Sidebar 折叠/展开)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateCoords) : null
    if (ro && triggerElRef.current) ro.observe(triggerElRef.current)
    return () => {
      window.removeEventListener('scroll', updateCoords, true)
      window.removeEventListener('resize', updateCoords)
      ro?.disconnect()
    }
  }, [open, portal, updateCoords])

  const posClass = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    right: 'left-full top-0 ml-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-0 mr-2',
  }

  // portal 模式下 transform 由坐标计算替代;非 portal 模式保留原 translate
  const portalPositionClass = {
    top: '-translate-y-full',
    right: '',
    bottom: '',
    left: '-translate-x-full',
  }

  // ESC 关闭 + Tab 焦点陷阱 + 关闭后焦点回归 trigger
  React.useEffect(() => {
    if (!open) return
    // 记录触发元素,关闭后焦点回归
    if (typeof document !== 'undefined') {
      triggerElRef.current = (document.activeElement as HTMLElement) ?? null
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
        return
      }
      if (e.key !== 'Tab' || !contentRef.current) return
      // 焦点陷阱:循环在 content 内可聚焦元素
      const focusable = Array.from(
        contentRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      )
      if (focusable.length === 0) return
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey && (active === first || !contentRef.current.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    // 打开时把焦点送入 content(让屏幕阅读器宣告),首个可聚焦元素
    const firstFocusable = contentRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
    firstFocusable?.focus()
    return () => {
      document.removeEventListener('keydown', onKey, true)
      // 关闭时焦点回归 trigger
      triggerElRef.current?.focus?.()
    }
  }, [open])

  const triggerProps =
    trigger === 'hover'
      ? { onMouseEnter: () => setOpen(true), onMouseLeave: () => setOpen(false) }
      : { onClick: () => setOpen(!open) }

  // 抓 trigger DOM 节点(用 callback ref 赋值给 triggerElRef)
  const childWithRef = React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
    ref: (node: HTMLElement | null) => {
      triggerElRef.current = node
      // 保留 children 自带的 ref 行为
      const childRef = (children as unknown as { ref?: React.Ref<HTMLElement> }).ref
      if (typeof childRef === 'function') childRef(node)
      else if (childRef && typeof childRef === 'object') {
        ;(childRef as React.MutableRefObject<HTMLElement | null>).current = node
      }
    },
  })

  // 弹层节点(非 portal: 走原 absolute; portal: 走 fixed + 坐标)
  const overlay = open ? (
    <div
      ref={contentRef}
      role="dialog"
      aria-label={ariaLabel}
      tabIndex={-1}
      className={cn(
        'rounded-md border bg-popover p-3 text-popover-foreground shadow-md outline-none',
        'focus-visible:ring-2 focus-visible:ring-ring',
        // z-popover 来自设计 tokens,与 Dropdown/Tooltip 同级
        portal ? 'fixed z-popover' : 'absolute z-popover',
        // 非 portal:用预设定位类;portal:由内联 style 定位 + transform 调整对齐
        !portal && posClass[position],
        className,
      )}
      style={
        portal && coords
          ? {
              top: coords.top,
              left: coords.left,
              // 组合 translate:portalPositionClass 修正主方向;align=center 用 -50% 居中;
              // align=end(right/left position)用 -100% 让 popover 底边对齐 trigger 底边,避免向下溢出视口。
              transform: `${portalPositionClass[position]} ${
                align === 'center' && (position === 'top' || position === 'bottom')
                  ? '-translate-x-1/2'
                  : ''
              } ${
                align === 'center' && (position === 'left' || position === 'right')
                  ? '-translate-y-1/2'
                  : ''
              } ${
                align === 'end' && (position === 'left' || position === 'right')
                  ? '-translate-y-full'
                  : ''
              }`.trim(),
            }
          : undefined
      }
    >
      {content}
    </div>
  ) : null

  if (portal) {
    return (
      <div ref={ref} className="relative inline-block" {...triggerProps}>
        {childWithRef}
        {typeof document !== 'undefined' && createPortal(overlay, document.body)}
      </div>
    )
  }

  return (
    <div ref={ref} className="relative inline-block" {...triggerProps}>
      {childWithRef}
      {overlay}
    </div>
  )
}
