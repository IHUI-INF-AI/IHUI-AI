'use client'

import * as React from 'react'
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
}: PopoverProps) {
  const [open, setOpen] = React.useState(false)
  const contentRef = React.useRef<HTMLDivElement | null>(null)
  const triggerElRef = React.useRef<HTMLElement | null>(null)
  const ref = useClickOutside<HTMLDivElement>(React.useCallback(() => setOpen(false), []))

  const posClass = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    right: 'left-full top-0 ml-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-0 mr-2',
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

  return (
    <div ref={ref} className="relative inline-block" {...triggerProps}>
      {children}
      {open && (
        <div
          ref={contentRef}
          role="dialog"
          aria-label={ariaLabel}
          tabIndex={-1}
          className={cn(
            'absolute z-popover rounded-md border bg-popover p-3 text-popover-foreground shadow-md outline-none',
            'focus-visible:ring-2 focus-visible:ring-ring',
            posClass[position],
            className,
          )}
        >
          {content}
        </div>
      )}
    </div>
  )
}
