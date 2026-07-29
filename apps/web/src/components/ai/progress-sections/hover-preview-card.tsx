'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface HoverPreviewCardProps {
  visible: boolean
  position: { x: number; y: number }
  content: React.ReactNode
  className?: string
  /** ARIA role: tooltip(纯展示,默认)或 dialog(可交互 + Esc 关闭 + 焦点陷阱) */
  role?: 'tooltip' | 'dialog'
  /** Esc 关闭回调,仅在 role="dialog" 时生效 */
  onClose?: () => void
  /** aria-label 文本(role="dialog" 时推荐提供) */
  ariaLabel?: string
  'data-testid'?: string
}

/** 可聚焦元素选择器(用于焦点陷阱) */
const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export const HoverPreviewCard = React.memo(function HoverPreviewCard({
  visible,
  position,
  content,
  className,
  role = 'tooltip',
  onClose,
  ariaLabel,
  'data-testid': testId,
}: HoverPreviewCardProps) {
  const cardRef = React.useRef<HTMLDivElement>(null)

  // Esc 关闭:仅在 visible + onClose 提供时监听
  React.useEffect(() => {
    if (!visible || !onClose) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [visible, onClose])

  // 焦点陷阱 + 自动聚焦:仅在 visible 时激活
  React.useEffect(() => {
    if (!visible) return
    const card = cardRef.current
    if (!card) return

    // 自动聚焦第一个可聚焦元素(role="dialog" 时若无可聚焦元素则聚焦卡片本身)
    const focusable = card.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    const firstFocusable = focusable[0]
    if (firstFocusable) {
      firstFocusable.focus()
    } else if (role === 'dialog') {
      card.focus()
    }

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const focusableEls = card.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      const first = focusableEls[0]
      const last = focusableEls[focusableEls.length - 1]
      if (!first || !last) return
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    card.addEventListener('keydown', handleTab)
    return () => card.removeEventListener('keydown', handleTab)
  }, [visible, role])

  if (!visible) return null

  return (
    <div
      ref={cardRef}
      className={cn(
        'pointer-events-none fixed z-[1000] w-[240px] rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-md',
        className,
      )}
      style={{ left: position.x, top: position.y }}
      data-testid={testId ?? 'hover-preview-card'}
      role={role}
      aria-modal={role === 'dialog' ? false : undefined}
      aria-label={ariaLabel}
      tabIndex={role === 'dialog' ? -1 : undefined}
    >
      {content}
    </div>
  )
})

export default HoverPreviewCard
