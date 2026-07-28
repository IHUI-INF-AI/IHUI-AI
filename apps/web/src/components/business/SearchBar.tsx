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

  // 2026-07-28 修复(用户反馈"输入内容后没下拉 + Enter 没反应"):
  // 原 useClickOutside hook 在 SearchBar 挂载时立即注册 document mousedown 监听器,
  // 与 focusOnMount=true 的 inputRef.current?.focus() 时序冲突:
  // - mount 后 useEffect 注册 mousedown 监听器
  // - 同 effect 内 inputRef.current?.focus() 同步触发原生 focus
  // - React commit 后派发合成 onFocus → setFocused(true)
  // - 但如果 mousedown 在 focus() 派发前同步触发(或 React 19 dev 模式 batching 变化),
  //   会立即 setFocused(false) 覆盖,导致下拉永远不显示
  // 修复:用 focused 状态作为 enabled gate,只有 input 已聚焦后才监听外部 mousedown,
  //      从根本上消除与 focusOnMount 的时序竞争。
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

  // focusOnMount:用 ref + effect + setTimeout(0) 主动聚焦
  // setTimeout 推到下一帧,确保 React commit 完成后 input 节点完全可用,
  // 然后同步触发原生 focus 事件让 React 派发 onFocus 合成事件。
  // 不使用 jsx-a11y/no-autofocus 警告的方式(在 input 上写 autoFocus)。
  React.useEffect(() => {
    if (!focusOnMount) return
    const id = window.setTimeout(() => {
      inputRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(id)
  }, [focusOnMount])

  // 2026-07-28 修复(用户反馈"输入内容后没下拉 + Enter 没反应"):
  // 之前依赖 form onSubmit 触发搜索,但 input type=search + form 在中文 IME composition
  // 状态下按 Enter 是"确认中文选词",不会触发 form submit,导致 Enter 提交失效。
  // 改用 input onKeyDown 显式拦截 Enter,绕过 IME 与 form 提交流程。
  const handleEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    // 跳过 IME composition 中的 Enter(原生 keydown 的 isComposing 判断)
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    onSearch?.(trimmed)
    setFocused(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = value.trim()
    if (trimmed) {
      onSearch?.(trimmed)
      setFocused(false)
    }
  }

  // 2026-07-28 修复(用户反馈"没有历史搜索记录时还显示一个空容器"):
  // 原 showDropdown 仅看 suggestions.length > 0 / history.length > 0,导致:
  // - 焦点进入但无输入且无历史时:外层容器渲染但内部两块条件都不满足 → 空容器
  // - 输入字符后所有 suggestions 都被过滤掉时:外层容器渲染但 suggestions 块为空 → 空容器
  // 修复:把"是否有可显示内容"作为唯一条件,过滤结果提前到 useMemo 复用,避免渲染时重复 filter。
  const filteredSuggestions = React.useMemo(
    () =>
      value
        ? suggestions
            .filter((s) => s.toLowerCase().includes(value.toLowerCase()))
            .slice(0, 8)
        : [],
    [value, suggestions],
  )
  const showDropdown =
    focused && (filteredSuggestions.length > 0 || (!value && history.length > 0))

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
          onKeyDown={handleEnter}
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
          {value && filteredSuggestions.length > 0 && (
            <div>
              {filteredSuggestions.map((s) => (
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
