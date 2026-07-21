'use client'

import * as React from 'react'
import { cn } from '../lib/utils.js'

interface CollapsibleContextValue {
  open: boolean
  toggle: () => void
  contentId: string
}

const CollapsibleContext = React.createContext<CollapsibleContextValue | null>(null)

function useCollapsibleContext(component: string): CollapsibleContextValue {
  const ctx = React.useContext(CollapsibleContext)
  if (!ctx) {
    throw new Error(`<${component}> 必须在 <Collapsible> 内使用`)
  }
  return ctx
}

export interface CollapsibleProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
  className?: string
}

const Collapsible = React.forwardRef<HTMLDivElement, CollapsibleProps>(
  ({ open: openProp, defaultOpen = false, onOpenChange, children, className }, ref) => {
    const [internalOpen, setInternalOpen] = React.useState(defaultOpen)
    const isControlled = openProp !== undefined
    const open = isControlled ? openProp : internalOpen

    const contentId = React.useId()

    const toggle = React.useCallback(() => {
      const next = !open
      if (!isControlled) setInternalOpen(next)
      onOpenChange?.(next)
    }, [open, isControlled, onOpenChange])

    const value = React.useMemo<CollapsibleContextValue>(
      () => ({ open, toggle, contentId }),
      [open, toggle, contentId],
    )

    return (
      <CollapsibleContext.Provider value={value}>
        <div
          ref={ref}
          className={cn('w-full', className)}
          data-state={open ? 'open' : 'closed'}
        >
          {children}
        </div>
      </CollapsibleContext.Provider>
    )
  },
)
Collapsible.displayName = 'Collapsible'

export interface CollapsibleTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

const CollapsibleTrigger = React.forwardRef<
  HTMLButtonElement,
  CollapsibleTriggerProps
>(({ className, onClick, children, ...props }, ref) => {
  const { open, toggle, contentId } = useCollapsibleContext('CollapsibleTrigger')
  return (
    <button
      ref={ref}
      type="button"
      aria-expanded={open}
      aria-controls={contentId}
      onClick={(e) => {
        onClick?.(e)
        if (!e.defaultPrevented) toggle()
      }}
      className={cn('flex w-full items-center', className)}
      {...props}
    >
      {children}
    </button>
  )
})
CollapsibleTrigger.displayName = 'CollapsibleTrigger'

export interface CollapsibleContentProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * 强制渲染内容(忽略折叠状态)。折叠时仍渲染 DOM 但带 data-state="closed"。
   * 用于需要始终保留 DOM 的场景(如 LogViewer 流式追加 + 自动滚动)。
   */
  forceMount?: boolean
}

const CollapsibleContent = React.forwardRef<HTMLDivElement, CollapsibleContentProps>(
  ({ className, children, forceMount = false, ...props }, ref) => {
    const { open, contentId } = useCollapsibleContext('CollapsibleContent')
    if (!open && !forceMount) return null
    return (
      <div
        ref={ref}
        id={contentId}
        data-state={open ? 'open' : 'closed'}
        className={cn(className)}
        {...props}
      >
        {children}
      </div>
    )
  },
)
CollapsibleContent.displayName = 'CollapsibleContent'

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
