'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  label?: string
  error?: string
  icon?: React.ComponentType<{ className?: string }>
  prefix?: React.ReactNode
  suffix?: React.ReactNode
  containerClassName?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { label, error, icon: Icon, prefix, suffix, className, containerClassName, id, ...props },
    ref,
  ) => {
    const reactId = React.useId()
    const inputId = id ?? reactId
    return (
      <div className={cn('w-full space-y-1.5', containerClassName)}>
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium leading-none">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {Icon && (
            <Icon className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
          )}
          {prefix && (
            <span className="absolute left-3 text-sm text-muted-foreground">{prefix}</span>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? `${inputId}-error` : undefined}
            className={cn(
              'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors',
              'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
              Icon && 'pl-9',
              prefix && 'pl-9',
              suffix && 'pr-9',
              error && 'border-destructive focus-visible:ring-destructive',
              className,
            )}
            {...props}
          />
          {suffix && (
            <span className="absolute right-3 text-sm text-muted-foreground">{suffix}</span>
          )}
        </div>
        {error && (
          <p id={`${inputId}-error`} className="text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  },
)
Input.displayName = 'Input'
