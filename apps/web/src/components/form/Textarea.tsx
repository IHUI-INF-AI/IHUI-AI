'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  autoResize?: boolean
  showCounter?: boolean
  containerClassName?: string
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    { label, error, autoResize = false, showCounter = false, maxLength, className, containerClassName, id, value, onChange, ...props },
    ref,
  ) => {
    const reactId = React.useId()
    const textareaId = id ?? reactId
    const innerRef = React.useRef<HTMLTextAreaElement | null>(null)

    const setRefs = (el: HTMLTextAreaElement | null) => {
      innerRef.current = el
      if (typeof ref === 'function') ref(el)
      else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = el
    }

    React.useEffect(() => {
      if (autoResize && innerRef.current) {
        innerRef.current.style.height = 'auto'
        innerRef.current.style.height = `${innerRef.current.scrollHeight}px`
      }
    }, [autoResize, value])

    const length = typeof value === 'string' ? value.length : 0

    return (
      <div className={cn('w-full space-y-1.5', containerClassName)}>
        {label && (
          <label htmlFor={textareaId} className="text-sm font-medium leading-none">
            {label}
          </label>
        )}
        <textarea
          ref={setRefs}
          id={textareaId}
          maxLength={maxLength}
          value={value}
          onChange={onChange}
          className={cn(
            'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors',
            'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            autoResize && 'resize-none overflow-hidden',
            error && 'border-destructive focus-visible:ring-destructive',
            className,
          )}
          {...props}
        />
        <div className="flex items-center justify-between">
          {error ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : (
            <span />
          )}
          {showCounter && (
            <span className="text-xs text-muted-foreground">
              {length}
              {maxLength ? `/${maxLength}` : ''}
            </span>
          )}
        </div>
      </div>
    )
  },
)
Textarea.displayName = 'Textarea'
