'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface FormProps extends Omit<React.FormHTMLAttributes<HTMLFormElement>, 'onSubmit'> {
  onSubmit?: (data: Record<string, unknown>) => void | Promise<void>
  layout?: 'vertical' | 'horizontal'
  children: React.ReactNode
}

export function Form({ onSubmit, layout = 'vertical', className, children, ...props }: FormProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const data: Record<string, unknown> = {}
    formData.forEach((value, key) => {
      if (key in data) {
        const existing = data[key]
        if (Array.isArray(existing)) existing.push(value)
        else data[key] = [existing, value]
      } else {
        data[key] = value
      }
    })
    onSubmit?.(data)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn('space-y-4', layout === 'horizontal' && 'sm:space-y-2', className)}
      {...props}
    >
      {children}
    </form>
  )
}
