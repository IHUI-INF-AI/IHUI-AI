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
  /** 复选框原生 a11y 标签;不传时回退到 label 文本/aria-labelledby 关联 */
  'aria-label'?: string
  className?: string
}

export const Checkbox = React.forwardRef<HTMLSpanElement, CheckboxProps>(function Checkbox(
  {
    checked = false,
    indeterminate = false,
    onChange,
    label,
    disabled = false,
    className,
    'aria-label': ariaLabel,
  },
  ref,
) {
  const handleToggle = () => {
    if (!disabled) onChange?.(!checked)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      handleToggle()
    }
  }

  return (
    <label
      className={cn(
        'inline-flex cursor-pointer items-center gap-2',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <span
        ref={ref}
        role="checkbox"
        tabIndex={disabled ? -1 : 0}
        aria-checked={indeterminate ? 'mixed' : checked}
        aria-disabled={disabled || undefined}
        aria-label={ariaLabel}
        aria-invalid={indeterminate || undefined}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className={cn(
          'flex h-4 w-4 items-center justify-center rounded border border-input transition-colors',
          (checked || indeterminate) && 'border-primary bg-primary text-primary-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        )}
      >
        {indeterminate ? (
          <Minus className="h-3 w-3" />
        ) : checked ? (
          <Check className="h-3 w-3" />
        ) : null}
      </span>
      {label && <span className="text-sm">{label}</span>}
    </label>
  )
})
