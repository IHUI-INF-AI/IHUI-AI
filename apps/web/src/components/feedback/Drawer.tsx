// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Drawer 抽屉组件(关闭时焦点归还约束)
 *
 * **使用方必读(2026-09-02 治理)**:
 * Drawer 打开时记录当前 activeElement 作为 triggerRef,关闭时(第 88 行
 * triggerRef.current?.focus())把焦点归还给该元素。该元素通常是打开
 * Drawer 的按钮——若该按钮有 `focus-visible:ring-*` 样式,关闭后焦点
 * 环会常驻显示(浏览器 Chrome 122+ 对 .focus() 程序性触发也会显示
 * focus-visible ring)。
 *
 * 触发 Drawer 的按钮必须满足下列**任一**条件:
 * 1. 使用 Radix Dialog/DropdownMenu/Popover(自带 data-state="closed"),
 *    命中 globals.css:1090 `button[data-state='closed']:focus-visible { box-shadow: none }`
 * 2. 自写按钮但加了 `data-state={open ? 'open' : 'closed'}`(参考
 *    apps/web/src/components/ai/permission-history-panel.tsx)
 * 3. 焦点环样式使用 `focus-visible:ring-*` 而非 `focus:ring-*`
 *    (`:focus-visible` 只对键盘 Tab / 脚本式 .focus() 显示,鼠标点击
 *    关闭 Drawer 后浏览器判定为 mouse-initiated focus,不显示 ring)
 *
 * 守门:scripts/check-popover-trigger-data-state.mjs 会在 CI 拦截
 * 自写 popover + createPortal 但无 data-state 的 trigger(2026-09-02 立)。
 */

type DrawerSide = 'left' | 'right' | 'top' | 'bottom'

interface DrawerProps {
  open: boolean
  onClose: () => void
  side?: DrawerSide
  title?: React.ReactNode
  children?: React.ReactNode
  width?: string
  height?: string
  className?: string
}

const sideMap: Record<DrawerSide, string> = {
  left: 'left-0 top-0 h-full',
  right: 'right-0 top-0 h-full',
  top: 'left-0 top-0 w-full',
  bottom: 'left-0 bottom-0 w-full',
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

export function Drawer({
  open,
  onClose,
  side = 'right',
  title,
  children,
  width = '24rem',
  height = 'auto',
  className,
}: DrawerProps) {
  const t = useTranslations('a11y')
  const panelRef = React.useRef<HTMLDivElement>(null)
  const triggerRef = React.useRef<HTMLElement | null>(null)
  const titleId = React.useId()

  React.useEffect(() => {
    if (!open) return
    triggerRef.current = document.activeElement as HTMLElement

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        )
        if (focusable.length === 0) return
        const first = focusable[0]!
        const last = focusable[focusable.length - 1]!
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', handler)

    const panel = panelRef.current
    if (panel) {
      const firstFocusable = panel.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
      firstFocusable?.focus()
    }

    return () => {
      document.removeEventListener('keydown', handler)
      triggerRef.current?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  const isHorizontal = side === 'left' || side === 'right'

  return (
    <div className="fixed inset-0 z-modal">
      <button
        type="button"
        aria-label={t('close')}
        className="absolute inset-0 cursor-default bg-black/80 animate-in fade-in-0"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={cn(
          'absolute bg-background shadow-lg',
          sideMap[side],
          isHorizontal ? 'animate-in slide-in-from-right' : 'animate-in slide-in-from-bottom',
          className,
        )}
        style={{
          width: isHorizontal ? width : '100%',
          height: isHorizontal ? '100%' : height,
        }}
      >
        <div className="flex items-center justify-between border-b p-4">
          {title && (
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
          )}
          <button
            onClick={onClose}
            aria-label={t('close')}
            className="ml-auto rounded-sm opacity-70 hover:opacity-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div
          className="overflow-auto p-4"
          style={{ maxHeight: isHorizontal ? 'calc(100% - 3.5rem)' : 'calc(100% - 3.5rem)' }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
