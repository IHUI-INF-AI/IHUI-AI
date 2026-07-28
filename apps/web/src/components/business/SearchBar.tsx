'use client'

import * as React from 'react'
import { Search, X, Clock } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

interface SearchBarProps {
  placeholder?: string
  onSearch?: (value: string) => void
  suggestions?: string[]
  history?: string[]
  onHistoryClick?: (item: string) => void
  onClearHistory?: () => void
  className?: string
  /** 挂载后自动聚焦输入框(用 ref+effect 实现,避免 jsx-a11y/no-autofocus 警告) */
  focusOnMount?: boolean
}

export function SearchBar({
  placeholder,
  onSearch,
  suggestions = [],
  history = [],
  onHistoryClick,
  onClearHistory,
  className,
  focusOnMount = false,
}: SearchBarProps) {
  const t = useTranslations('common')
  const resolvedPlaceholder = placeholder ?? t('searchPlaceholder')
  const [value, setValue] = React.useState('')
  const [focused, setFocused] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)

  // 2026-07-28 修复:click outside 监听器只在 input 已聚焦后才注册
  // 原 useClickOutside 实现:SearchBar 挂载时立即注册 document mousedown 监听器,
  // 在 React 19 + dev mode + focusOnMount 场景下,监听器可能比 onFocus 派发 setFocused(true)
  // 之前或同步触发,导致 focused 状态被立即 setFocused(false) 覆盖 → 下拉永远不显示。
  // 修复:用 focused state 作为 enabled gate,只有 input 已聚焦后才监听外部 mousedown。
  React.useEffect(() => {
    if (!focused) return
    const handler = (event: MouseEvent | TouchEvent) => {
      const el = containerRef.current
      if (el && !el.contains(event.target as Node)) {
        setFocused(false)
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [focused])

  // focusOnMount:用 ref + effect 主动聚焦(避免 jsx-a11y/no-autofocus 警告)
  React.useEffect(() => {
    if (focusOnMount) {
      // 延迟一帧确保 React commit 完成后 input 节点完全可用
      // + 同步触发原生 focus 事件让 React 派发 onFocus 合成事件
      const id = window.setTimeout(() => {
        inputRef.current?.focus()
      }, 0)
      return () => window.clearTimeout(id)
    }
    return undefined
  }, [focusOnMount])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (value.trim()) {
      onSearch?.(value.trim())
      setFocused(false)
    }
  }

  const showDropdown = focused && (suggestions.length > 0 || (history.length > 0 && !value))

  return (
    // 2026-07-28 简化:合并原两层 div(relative 外层 + relative 内层)为一层,input 直接占满父容器。
    // 原双层结构是为了承载 Search icon 绝对定位和 dropdown 浮层,但实际只需一层 relative
    // 即可同时承载 icon + dropdown(input 自身无圆角边框,完全靠父容器 bg-popover + border 提供外观)。
    // click-outside 仍由 containerRef 提供,fade-in 动画由父级(弹层容器)提供。
    <div ref={containerRef} className={cn('relative w-full', className)}>
      <form onSubmit={handleSubmit}>
        <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          placeholder={resolvedPlaceholder}
          className="h-10 w-full bg-transparent pl-9 pr-9 text-sm transition-colors placeholder:text-muted-foreground/70 focus-visible:outline-none"
        />
        {value && (
          <button
            type="button"
            onClick={() => setValue('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </form>
      {showDropdown && (
        <div className="absolute z-popover mt-1 w-full overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          {!value && history.length > 0 && (
            <div className="mb-1">
              <div className="flex items-center justify-between px-2 py-1">
                <span className="text-xs text-muted-foreground">{t('searchHistory')}</span>
                {onClearHistory && (
                  <button
                    onClick={onClearHistory}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {t('clear')}
                  </button>
                )}
              </div>
              {history.map((item) => (
                <button
                  key={item}
                  onClick={() => {
                    onHistoryClick?.(item)
                    setValue(item)
                    setFocused(false)
                  }}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                >
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  {item}
                </button>
              ))}
            </div>
          )}
          {value && suggestions.length > 0 && (
            <div>
              {suggestions
                .filter((s) => s.toLowerCase().includes(value.toLowerCase()))
                .slice(0, 8)
                .map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setValue(s)
                      onSearch?.(s)
                      setFocused(false)
                    }}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <Search className="h-3 w-3 text-muted-foreground" />
                    {s}
                  </button>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
