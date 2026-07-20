'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

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
        className="absolute inset-0 h-full w-full cursor-default bg-black/80 animate-in fade-in-0"
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
