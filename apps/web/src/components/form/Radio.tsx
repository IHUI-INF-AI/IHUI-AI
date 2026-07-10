'use client'

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
    <div className={cn(inline ? 'flex flex-wrap gap-4' : 'flex flex-col gap-2', className)}>
      {options.map((opt) => {
        const isChecked = value === opt.value
        return (
          <label
            key={opt.value}
            className={cn('inline-flex cursor-pointer items-center gap-2', opt.disabled && 'cursor-not-allowed opacity-50')}
          >
            <span
              onClick={() => !opt.disabled && onChange?.(opt.value)}
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
