'use client'

// 2026-07-28 升级:三段式搜索面板(历史/热门/联想),对齐 VS Code / Cursor 搜索面板 UX。
// 三段由 ./search-suggestions 子组件渲染,本文件聚焦:
//   1) input 聚焦态 + 外部点击关闭
//   2) value 过滤(联想段)
//   3) 提交(Enter + form submit,绕过中文 IME composition)
//   4) 三段按"有内容"决定是否显示,避免空容器
// 保留全部 props 不变(对 TagsView 契约零破坏)。

import * as React from 'react'
import { Search, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { useSearchHistory } from '@/hooks/use-search-history'
import { useSearchPopular } from '@/hooks/use-search-popular'
import {
  HistorySection,
  PopularSection,
  SuggestionsSection,
  SectionDivider,
} from './search-suggestions'

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
  history: historyProp,
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

  // 2026-07-28 注:历史记录支持两种模式 ——
  //   1) 外层传 `history` prop(TagsView 场景):以 prop 为准,外层负责持久化
  //   2) 未传 prop:用 hook 内部状态,hook 自管 localStorage(独立消费场景)
  // 两种模式互斥,避免重复写 localStorage 引发竞态。
  const isStandalone = historyProp === undefined
  const hookHistory = useSearchHistory()
  const history = isStandalone ? hookHistory.history : historyProp

  // 2026-07-28 修复(用户反馈"输入内容后没下拉 + Enter 没反应"):
  // 原 useClickOutside hook 在 SearchBar 挂载时立即注册 document mousedown 监听器,
  // 与 focusOnMount=true 的 inputRef.current?.focus() 时序冲突。
  // 修复:用 focused 状态作为 enabled gate,只有 input 已聚焦后才监听外部 mousedown。
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
  React.useEffect(() => {
    if (!focusOnMount) return
    const id = window.setTimeout(() => {
      inputRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(id)
  }, [focusOnMount])

  // 2026-07-28 修复(用户反馈"输入内容后没下拉 + Enter 没反应"):
  // input type=search + form 在中文 IME composition 状态下按 Enter 是"确认中文选词",
  // 不会触发 form submit。改用 input onKeyDown 显式拦截 Enter,绕过 IME 流程。
  const handleEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    if (isStandalone) hookHistory.addHistory(trimmed)
    onSearch?.(trimmed)
    setFocused(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    if (isStandalone) hookHistory.addHistory(trimmed)
    onSearch?.(trimmed)
    setFocused(false)
  }

  // 2026-07-28 修复(用户反馈"没有历史搜索记录时还显示一个空容器"):
  // 把"是否有可显示内容"作为唯一条件,过滤结果提前到 useMemo 复用。
  const filteredSuggestions = React.useMemo(
    () =>
      value
        ? suggestions
            .filter((s) => s.toLowerCase().includes(value.toLowerCase()))
            .slice(0, 8)
        : [],
    [value, suggestions],
  )

  // 2026-07-28 升级:三段式面板的"是否有内容"汇总 ——
  //   联想段(value):有匹配建议
  //   静默段(!value):有历史 或 有热门
  const popular = useSearchPopular()
  const hasSilentSection = !value && (history.length > 0 || popular.length > 0)
  const hasQuerySection = value && filteredSuggestions.length > 0
  const showDropdown = focused && (hasSilentSection || hasQuerySection)

  // 2026-07-28 注:点击历史项触发外层 onHistoryClick(由外层写持久化);
  // standalone 模式下额外写 hook 内部状态。
  const handleHistoryItemClick = (item: string) => {
    if (isStandalone) {
      hookHistory.addHistory(item)
    } else {
      onHistoryClick?.(item)
    }
    setValue(item)
    setFocused(false)
  }

  // 2026-07-28 注:联想段点击 — 直接填值 + 触发搜索(对齐原行为)。
  const handleSuggestionItemClick = (item: string) => {
    setValue(item)
    if (isStandalone) hookHistory.addHistory(item)
    onSearch?.(item)
    setFocused(false)
  }

  // 2026-07-28 注:热门段点击 — 填值 + 触发搜索(参考 VS Code 行为)。
  const handlePopularItemClick = (item: string) => {
    setValue(item)
    if (isStandalone) hookHistory.addHistory(item)
    onSearch?.(item)
    setFocused(false)
  }

  return (
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
          {!value ? (
            <>
              <HistorySection
                items={history}
                onItemClick={handleHistoryItemClick}
                {...(onClearHistory ? { onClear: onClearHistory } : {})}
              />
              {history.length > 0 && popular.length > 0 ? <SectionDivider /> : null}
              <PopularSection items={popular} onItemClick={handlePopularItemClick} />
            </>
          ) : (
            <SuggestionsSection items={filteredSuggestions} onItemClick={handleSuggestionItemClick} />
          )}
        </div>
      )}
    </div>
  )
}
