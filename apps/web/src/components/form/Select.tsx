'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, Check, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useClickOutside } from '@/hooks/use-click-outside'

export interface Option {
  label: string
  value: string | number
  disabled?: boolean
}

interface SelectProps {
  options: Option[]
  value?: string | number | (string | number)[]
  onChange?: (value: string | number | (string | number)[]) => void
  multiple?: boolean
  searchable?: boolean
  placeholder?: string
  label?: string
  error?: string
  disabled?: boolean
  className?: string
}

export function Select({
  options,
  value,
  onChange,
  multiple = false,
  searchable = false,
  placeholder = '请选择',
  label,
  error,
  disabled = false,
  className,
}: SelectProps) {
  const t = useTranslations('a11y')
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [activeIndex, setActiveIndex] = React.useState(0)
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false))
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const listboxId = React.useId()

  const selected = React.useMemo(() => {
    if (multiple) {
      return Array.isArray(value) ? value : value !== undefined ? [value] : []
    }
    return value
  }, [value, multiple])

  const filtered = React.useMemo(() => {
    if (!searchable || !query) return options
    return options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
  }, [options, query, searchable])

  const displayLabel = React.useMemo(() => {
    if (multiple) {
      const arr = selected as (string | number)[]
      if (!arr.length) return placeholder
      const labels = arr.map((v) => options.find((o) => o.value === v)?.label).filter(Boolean)
      return labels.length > 2 ? `已选 ${labels.length} 项` : labels.join(', ')
    }
    const v = selected as string | number | undefined
    return v !== undefined
      ? (options.find((o) => o.value === v)?.label ?? placeholder)
      : placeholder
  }, [selected, options, multiple, placeholder])

  const handleSelect = (val: string | number) => {
    if (multiple) {
      const arr = selected as (string | number)[]
      const next = arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]
      onChange?.(next)
    } else {
      onChange?.(val)
      setOpen(false)
    }
  }

  const isSelected = (val: string | number) =>
    multiple ? (selected as (string | number)[]).includes(val) : selected === val

  const focusOption = (idx: number) => {
    const clamped = Math.max(0, Math.min(idx, filtered.length - 1))
    setActiveIndex(clamped)
    const el = ref.current?.querySelector(`[data-idx="${clamped}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActiveIndex(0)
    }
  }

  const handleListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      focusOption(activeIndex + 1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      focusOption(activeIndex - 1)
    } else if (e.key === 'Home') {
      e.preventDefault()
      focusOption(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      focusOption(filtered.length - 1)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      const opt = filtered[activeIndex]
      if (opt && !opt.disabled) handleSelect(opt.value)
    }
  }

  React.useEffect(() => {
    if (open && filtered.length > 0) setActiveIndex(0)
  }, [open, filtered.length])

  return (
    <div className={cn('w-full space-y-1.5', className)}>
      {label && (
        <label id={`${listboxId}-label`} className="text-sm font-medium leading-none">
          {label}
        </label>
      )}
      <div ref={ref} className="relative">
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-labelledby={label ? `${listboxId}-label` : undefined}
          onClick={() => setOpen(!open)}
          onKeyDown={handleTriggerKeyDown}
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-destructive',
          )}
        >
          <span
            className={cn(
              'break-words',
              !selected || (multiple && !(selected as []).length) ? 'text-muted-foreground' : '',
            )}
          >
            {displayLabel}
          </span>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
              open && 'rotate-180',
            )}
          />
        </button>
        {open && (
          <div
            role="listbox"
            id={listboxId}
            tabIndex={-1}
            onKeyDown={handleListKeyDown}
            className="absolute z-popover mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none"
          >
            {searchable && (
              <div className="relative mb-1">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  role="searchbox"
                  aria-label={t('searchOption')}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索..."
                  className="h-8 w-full rounded-sm bg-transparent pl-8 pr-2 text-sm outline-none"
                />
              </div>
            )}
            {filtered.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">无匹配项</div>
            ) : (
              filtered.map((opt, idx) => (
                <div
                  key={opt.value}
                  role="option"
                  tabIndex={-1}
                  data-idx={idx}
                  aria-selected={isSelected(opt.value)}
                  aria-disabled={opt.disabled || undefined}
                  onClick={() => !opt.disabled && handleSelect(opt.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      if (!opt.disabled) handleSelect(opt.value)
                    }
                  }}
                  className={cn(
                    'flex w-full cursor-pointer items-center justify-between rounded-sm px-2 py-1.5 text-sm',
                    idx === activeIndex && 'bg-accent text-accent-foreground',
                    'hover:bg-accent hover:text-accent-foreground',
                    opt.disabled && 'cursor-not-allowed opacity-50',
                  )}
                  onMouseEnter={() => setActiveIndex(idx)}
                >
                  {opt.label}
                  {isSelected(opt.value) && <Check className="h-4 w-4 text-primary" />}
                </div>
              ))
            )}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
