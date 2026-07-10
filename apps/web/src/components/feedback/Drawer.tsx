'use client'

import * as React from 'react'
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
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const isHorizontal = side === 'left' || side === 'right'

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/80 animate-in fade-in-0" onClick={onClose} />
      <div
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
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          <button onClick={onClose} className="ml-auto rounded-sm opacity-70 hover:opacity-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-auto p-4" style={{ maxHeight: isHorizontal ? 'calc(100% - 3.5rem)' : 'calc(100% - 3.5rem)' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
