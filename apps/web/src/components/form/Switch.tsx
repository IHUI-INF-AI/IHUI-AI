'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  label?: React.ReactNode
  className?: string
}

const sizeMap = {
  sm: { track: 'h-4 w-7', thumb: 'h-3 w-3', translate: 'translate-x-3' },
  md: { track: 'h-5 w-9', thumb: 'h-4 w-4', translate: 'translate-x-4' },
  lg: { track: 'h-6 w-11', thumb: 'h-5 w-5', translate: 'translate-x-5' },
}

export function Switch({ checked, onChange, disabled = false, size = 'md', label, className }: SwitchProps) {
  const s = sizeMap[size]
  return (
    <label className={cn('inline-flex cursor-pointer items-center gap-2', disabled && 'cursor-not-allowed opacity-50', className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex shrink-0 items-center rounded-full border-2 border-transparent transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          s.track,
          checked ? 'bg-primary' : 'bg-input',
        )}
      >
        <span
          className={cn(
            'pointer-events-none block rounded-full bg-background shadow-lg ring-0 transition-transform',
            s.thumb,
            checked ? s.translate : 'translate-x-0',
          )}
        />
      </button>
      {label && <span className="text-sm">{label}</span>}
    </label>
  )
}
