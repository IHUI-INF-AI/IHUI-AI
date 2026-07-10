import * as React from 'react'
import { cn } from '@/lib/utils'

interface FormFieldProps {
  label?: string
  error?: string
  required?: boolean
  description?: string
  children: React.ReactNode
  className?: string
}

export function FormField({ label, error, required = false, description, children, className }: FormFieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label className="text-sm font-medium leading-none">
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </label>
      )}
      {children}
      {description && !error && <p className="text-xs text-muted-foreground">{description}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
