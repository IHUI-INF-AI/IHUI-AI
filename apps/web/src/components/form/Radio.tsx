'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface RadioOption {
  label: string
  value: string | number
  disabled?: boolean
}

interface RadioProps {
  options: RadioOption[]
  value?: string | number
  onChange?: (value: string | number) => void
  inline?: boolean
  name?: string
  className?: string
}

export function Radio({ options, value, onChange, inline = false, className }: RadioProps) {
  return (
    <div
      role="radiogroup"
      className={cn(inline ? 'flex flex-wrap gap-4' : 'flex flex-col gap-2', className)}
    >
      {options.map((opt) => {
        const isChecked = value === opt.value
        const handleSelect = () => !opt.disabled && onChange?.(opt.value)
        const handleKeyDown = (e: React.KeyboardEvent) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault()
            handleSelect()
          } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
            e.preventDefault()
            const idx = options.indexOf(opt)
            const next = options[(idx + 1) % options.length]
            if (next && !next.disabled) onChange?.(next.value)
          } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
            e.preventDefault()
            const idx = options.indexOf(opt)
            const prev = options[(idx - 1 + options.length) % options.length]
            if (prev && !prev.disabled) onChange?.(prev.value)
          }
        }
        return (
          <label
            key={opt.value}
            className={cn(
              'inline-flex cursor-pointer items-center gap-2',
              opt.disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            <span
              role="radio"
              tabIndex={opt.disabled ? -1 : 0}
              aria-checked={isChecked}
              aria-disabled={opt.disabled || undefined}
              onClick={handleSelect}
              onKeyDown={handleKeyDown}
              className={cn(
                'flex h-4 w-4 items-center justify-center rounded-full border border-input transition-colors',
                isChecked && 'border-primary',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              )}
            >
              {isChecked && <span className="h-2 w-2 rounded-full bg-primary" />}
            </span>
            <span className="text-sm">{opt.label}</span>
          </label>
        )
      })}
    </div>
  )
}
