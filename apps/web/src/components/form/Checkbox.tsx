'use client'

import * as React from 'react'
import { Check, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CheckboxProps {
  checked?: boolean
  indeterminate?: boolean
  onChange?: (checked: boolean) => void
  label?: React.ReactNode
  disabled?: boolean
  className?: string
}

export function Checkbox({
  checked = false,
  indeterminate = false,
  onChange,
  label,
  disabled = false,
  className,
}: CheckboxProps) {
  const handleClick = () => {
    if (!disabled) onChange?.(!checked)
  }

  return (
    <label className={cn('inline-flex cursor-pointer items-center gap-2', disabled && 'cursor-not-allowed opacity-50', className)}>
      <span
        onClick={handleClick}
        className={cn(
          'flex h-4 w-4 items-center justify-center rounded border border-input transition-colors',
          (checked || indeterminate) && 'border-primary bg-primary text-primary-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        )}
      >
        {indeterminate ? <Minus className="h-3 w-3" /> : checked ? <Check className="h-3 w-3" /> : null}
      </span>
      {label && <span className="text-sm">{label}</span>}
    </label>
  )
}
