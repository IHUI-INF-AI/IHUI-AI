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
  // 2026-07-28 改:从 'common' 切到 'search' 命名空间。
  // common 命名空间没有 searchPlaceholder / searchHistory / clear / noSuggestions 这些 key,
  // 会触发 next-intl MISSING_MESSAGE 警告。search 命名空间已经承载搜索相关文案,合理归位。
  const t = useTranslations('search')
  const resolvedPlaceholder = placeholder ?? t('searchPlaceholder')
  const [value, setValue] = React.useState('')
  const [focused, setFocused] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)

  // focusOnMount:用 ref + effect 主动聚焦(避免 jsx-a11y/no-autofocus 警告)
  // 2026-07-28 修复:加 setTimeout(0) 把 focus 推到下一个 tick,确保 React 19
  // commit 阶段后再触发原生 focus,避免与 click-outside 监听器时序竞争
  React.useEffect(() => {
    if (!focusOnMount) return
    const id = window.setTimeout(() => {
      inputRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(id)
  }, [focusOnMount])

  // 2026-07-28 修复(用户反馈"输入内容后没下拉"):
  // 原 useClickOutside hook 在 SearchBar 挂载时立即注册 document mousedown 监听器,
  // 与 focusOnMount=true 的 inputRef.current?.focus() 时序冲突:
  //   - mount 后 useEffect 注册 mousedown 监听器
  //   - 同 effect 内 inputRef.current?.focus() 同步触发原生 focus
  //   - React commit 后派发合成 onFocus → setFocused(true)
  //   - 但 mousedown 监听器已经就位,如果浏览器把 focus 前的 mousedown 派发到 document
  //     (或 React 19 dev 模式 batching 变化),会立即 setFocused(false) 覆盖,下拉永远不显示
  // 修复:用 focused 状态作为 enabled gate,只有 input 已聚焦后才监听外部 mousedown,
  //      从根本上消除与 focusOnMount 的时序竞争
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

  // 2026-07-28 修复(用户反馈"Enter 确认后没反应"):
  // 之前依赖 form onSubmit 触发搜索,但 input type=search + form 在中文 IME composition
  // 状态下按 Enter 是"确认中文选词",不会触发 form submit,导致 Enter 提交失效。
  // 改用 input onKeyDown 显式拦截 Enter,绕过 IME 与 form 提交流程。
  // 注意:即使不是 IME 状态,显式 onKeyDown 也比 form submit 更可靠
  // (type=search 在某些浏览器下,空字符串按 Enter 不会触发 submit)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    // 跳过 IME composition 中的 Enter(原生 keydown 的 isComposing 判断)
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    onSearch?.(trimmed)
    setFocused(false)
  }

  // 提交逻辑(供 form onSubmit + 兜底使用,主要靠 onKeyDown)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    onSearch?.(trimmed)
    setFocused(false)
  }

  // 下拉显示条件:
  // - focused:必须聚焦
  // - 有 value:过滤 suggestions 显示
  // - 无 value + 有 history:显示历史
  // - 无 value + 无 history + 有 suggestions:显示所有快速建议(8 条,辅助新用户引导)
  // - 有 value + suggestions 为空:仍允许显示(展示 "无匹配" 提示)
  const showDropdown =
    focused &&
    (suggestions.length > 0 || (history.length > 0 && !value))

  // 过滤建议项(忽略大小写、按 value 子串匹配,限制 8 条)
  const filteredSuggestions = React.useMemo(() => {
    if (!value) return []
    const q = value.toLowerCase()
    return suggestions.filter((s) => s.toLowerCase().includes(q)).slice(0, 8)
  }, [suggestions, value])

  // 无 value 时显示的快速建议(用 suggestions 全量,无 history 兜底)
  // 2026-07-28 修复(用户反馈"再次打开弹窗时历史记录区为空"):
  // 原逻辑只在 history.length>0 时显示下拉,导致:
  // - 父组件 setHistory 是异步,弹窗打开瞬间 SearchBar 收到 history=[] → 下拉空
  // - 即使 history 后到,空 value + 空 history 仍无内容可显示
  // 修复:无 value + 无 history 时,fallback 显示 suggestions 全部 8 条作为"快速建议"
  const quickFallbackSuggestions = React.useMemo(() => {
    if (value) return []
    if (history.length > 0) return []
    return suggestions.slice(0, 8)
  }, [value, history.length, suggestions])

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
          onKeyDown={handleKeyDown}
          placeholder={resolvedPlaceholder}
          className="h-10 w-full bg-transparent pl-9 pr-9 text-sm transition-colors placeholder:text-muted-foreground/70 focus-visible:outline-none"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              setValue('')
              inputRef.current?.focus()
            }}
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
          {/* 无 value + 无 history 时显示所有 suggestions 作为快速建议
              (2026-07-28 立,用户反馈"再次打开弹窗时历史记录区为空") */}
          {!value && quickFallbackSuggestions.length > 0 && (
            <div>
              {quickFallbackSuggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => {
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
          {value && filteredSuggestions.length > 0 && (
            <div>
              {filteredSuggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => {
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
          {value && filteredSuggestions.length === 0 && suggestions.length > 0 && (
            <div className="px-2 py-2 text-xs text-muted-foreground">
              {t('noSuggestions')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
