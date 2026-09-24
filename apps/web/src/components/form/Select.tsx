// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, Check } from 'lucide-react'
import { SearchInput } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
// 2026-09-15 治理:定位/portal/关闭逻辑统一收敛到 PortalPanel(此前 absolute 就地渲染,
// 会被 overflow-hidden 祖先裁剪;Escape/外点关闭与全项目其余浮层重复)。
import { PortalPanel } from '@/components/feedback/portal-panel'
import { isTopOverlay, popOverlay, pushOverlay } from '@/lib/overlay-stack'

/**
 * 层栈 id(见 @/lib/overlay-stack):下拉面板的门户外 Esc(PortalPanel 内部)
 * 与 listbox 内的 Esc 共用同一身份,避免两个处理器各自入栈互相遮蔽。
 */
const SELECT_OVERLAY_ID = 'form-select'

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
  placeholder,
  label,
  error,
  disabled = false,
  className,
}: SelectProps) {
  const t = useTranslations('a11y')
  // 未传 placeholder 时由 a11y.selectPlaceholder 取词(原为硬编码中文默认值)
  const resolvedPlaceholder = placeholder ?? t('selectPlaceholder')
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [activeIndex, setActiveIndex] = React.useState(0)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)
  // PortalPanel 面板 portal 到 body,与触发器同宽(原 w-full)需同步锚点宽度
  const [anchorWidth, setAnchorWidth] = React.useState(0)
  const listboxId = React.useId()

  React.useLayoutEffect(() => {
    if (!open) return
    const el = triggerRef.current
    if (!el) return
    const sync = () => setAnchorWidth(el.offsetWidth)
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => ro.disconnect()
  }, [open])

  // 层栈:面板打开期间注册为栈顶(与 PortalPanel 内部同一 id,pushOverlay 幂等),
  // 两层 Esc 都只在栈顶时消费
  React.useEffect(() => {
    if (!open) return
    pushOverlay(SELECT_OVERLAY_ID)
    return () => popOverlay(SELECT_OVERLAY_ID)
  }, [open])

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
      if (!arr.length) return resolvedPlaceholder
      const labels = arr.map((v) => options.find((o) => o.value === v)?.label).filter(Boolean)
      return labels.length > 2 ? t('selectedCount', { count: labels.length }) : labels.join(', ')
    }
    const v = selected as string | number | undefined
    return v !== undefined
      ? (options.find((o) => o.value === v)?.label ?? resolvedPlaceholder)
      : resolvedPlaceholder
  }, [selected, options, multiple, resolvedPlaceholder, t])

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
    const el = listRef.current?.querySelector(`[data-idx="${clamped}"]`)
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
      if (!isTopOverlay(SELECT_OVERLAY_ID)) return
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
      <div className="relative">
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
            // 改 focus: → focus-visible:(2026-09-02)
            // 根因:focus 包含鼠标点击,trigger focus 后 focus:ring-2 立即显示焦点环,常驻不可消除。
            // 自写 popover 用 useClickOutside 关闭后焦点回到 trigger 上,看似"莫名其妙的边框"。
            // 改 focus-visible 后:鼠标点击不会显示焦点环(只有键盘 Tab 焦点或脚本式 .focus() 才显示),
            // 符合 W3C :focus-visible 设计意图,WCAG 2.4.7 可访问性保留。
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
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
        <PortalPanel
          open={open}
          anchorRef={triggerRef}
          onClose={() => setOpen(false)}
          side="bottom"
          align="start"
          gap={4}
          panelRef={listRef}
          overlayId={SELECT_OVERLAY_ID}
          style={anchorWidth ? { width: anchorWidth } : undefined}
        >
          <div
            role="listbox"
            id={listboxId}
            tabIndex={-1}
            onKeyDown={handleListKeyDown}
            className="max-h-60 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none"
          >
            {searchable && (
              <SearchInput
                role="searchbox"
                aria-label={t('searchOption')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('searchOptionPlaceholder')}
                wrapperClassName="mb-1"
              />
            )}
            {filtered.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                {t('noMatchOption')}
              </div>
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
                  <span className="whitespace-nowrap">{opt.label}</span>
                  {isSelected(opt.value) && <Check className="h-4 w-4 text-primary" />}
                </div>
              ))
            )}
          </div>
        </PortalPanel>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
