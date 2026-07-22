'use client'

import * as React from 'react'

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  checked?: boolean
  indeterminate?: boolean
  onCheckedChange?: (checked: boolean) => void
  onChange?: (checked: boolean) => void
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { checked = false, indeterminate = false, onCheckedChange, onChange, disabled, className, ...props },
  ref,
) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onCheckedChange?.(e.target.checked)
    onChange?.(e.target.checked)
  }

  return (
    <label className={`ihui-checkbox ${className ?? ''}`}>
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        data-indeterminate={indeterminate ? 'true' : undefined}
        disabled={disabled}
        onChange={handleChange}
        {...props}
      />
      <span className="checkmark" />
    </label>
  )
})
Checkbox.displayName = 'Checkbox'

export { Checkbox }
