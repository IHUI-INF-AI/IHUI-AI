'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { useClickOutside } from '@/hooks/use-click-outside'

interface PopoverProps {
  content: React.ReactNode
  children: React.ReactElement
  position?: 'top' | 'right' | 'bottom' | 'left'
  trigger?: 'click' | 'hover'
  className?: string
}

export function Popover({
  content,
  children,
  position = 'bottom',
  trigger = 'click',
  className,
}: PopoverProps) {
  const [open, setOpen] = React.useState(false)
  const ref = useClickOutside<HTMLDivElement>(React.useCallback(() => setOpen(false), []))

  const posClass = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    right: 'left-full top-0 ml-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-0 mr-2',
  }

  const triggerProps =
    trigger === 'hover'
      ? { onMouseEnter: () => setOpen(true), onMouseLeave: () => setOpen(false) }
      : { onClick: () => setOpen(!open) }

  return (
    <div ref={ref} className="relative inline-block" {...triggerProps}>
      {children}
      {open && (
        <div
          className={cn(
            'absolute z-50 rounded-md border bg-popover p-3 text-popover-foreground shadow-md',
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
