'use client'

import * as React from 'react'
import { Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DatePickerProps {
  value?: string
  onChange?: (value: string) => void
  label?: string
  error?: string
  min?: string
  max?: string
  disabled?: boolean
  placeholder?: string
  className?: string
}

export function DatePicker({
  value,
  onChange,
  label,
  error,
  min,
  max,
  disabled = false,
  placeholder = '请选择日期',
  className,
}: DatePickerProps) {
  return (
    <div className={cn('w-full space-y-1.5', className)}>
      {label && <label className="text-sm font-medium leading-none">{label}</label>}
      <div className="relative">
        <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="date"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          min={min}
          max={max}
          disabled={disabled}
          placeholder={placeholder}
          className={cn(
            'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-9 text-sm',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-destructive',
          )}
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
