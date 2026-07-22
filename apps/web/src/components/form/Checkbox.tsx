'use client'

import * as React from 'react'

interface CheckboxProps {
  checked?: boolean
  indeterminate?: boolean
  onChange?: (checked: boolean) => void
  label?: React.ReactNode
  disabled?: boolean
  'aria-label'?: string
  className?: string
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { checked = false, indeterminate = false, onChange, label, disabled = false, className, 'aria-label': ariaLabel },
  ref,
) {
  return (
    <label className={`ihui-checkbox ${disabled ? 'opacity-50 pointer-events-none' : ''} ${className ?? ''}`}>
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        data-indeterminate={indeterminate ? 'true' : undefined}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      <span className="checkmark" />
      {label && <span className="text-sm">{label}</span>}
    </label>
  )
})
