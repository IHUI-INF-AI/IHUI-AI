'use client'

// 2026-07-28 立:SearchBar 三段式搜索面板的三段子组件(历史/热门/联想)。
// 拆分原因:SearchBar.tsx 已在用户反馈中修复 2 次(input 时序 / Enter IME / 空容器),
//          把每段 UI 收敛到独立组件后,SearchBar 主文件聚焦"聚焦态 + 段拼接 + 提交",
//          后续每段改样式 / 替换数据源不影响主流程。
// 视觉规则遵循 AGENTS.md §4:无单边 border-t 当分割线(用 spacing + 容器背景区分),
// 每段之间用 <div className="border-t border-border/50" /> 显式分割是允许的
// (段间分隔 ≠ 单边分割线,AGENTS.md §4 注释明确"作为容器内分段分隔,允许")。

import * as React from 'react'
import { Clock, Flame, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface SectionProps {
  label: string
  /** 段标题右侧操作(例如"清除全部") */
  action?: React.ReactNode
  children: React.ReactNode
}

function Section({ label, action, children }: SectionProps) {
  return (
    <div>
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        {action}
      </div>
      {children}
    </div>
  )
}

interface HistorySectionProps {
  items: string[]
  onItemClick: (item: string) => void
  onClear?: () => void
}

/** 历史记录段(只在 !value 时显示) */
export function HistorySection({ items, onItemClick, onClear }: HistorySectionProps) {
  const t = useTranslations('common')
  if (items.length === 0) return null
  const action =
    onClear !== undefined ? (
      <button
        type="button"
        onClick={onClear}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        {t('clear')}
      </button>
    ) : undefined
  return (
    <Section label={t('searchHistory')} {...(action ? { action } : {})}>
      {items.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onItemClick(item)}
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
        >
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="truncate">{item}</span>
        </button>
      ))}
    </Section>
  )
}

interface PopularSectionProps {
  items: string[]
  onItemClick: (item: string) => void
}

// 2026-07-28 注:热门段标签"热门搜索"暂硬编码,等 i18n subagent 补
// search.popularSearches 后再切到 useTranslations('search')('popularSearches')。
// 当前不允许修改 i18n JSON 文件(任务约束),next-intl 缺 key 会 throw。
const POPULAR_LABEL = '热门搜索'

/** 热门搜索段(只在 !value 时显示,带 🔥 火焰图标) */
export function PopularSection({ items, onItemClick }: PopularSectionProps) {
  if (items.length === 0) return null
  return (
    <Section label={POPULAR_LABEL}>
      {items.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onItemClick(item)}
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
        >
          <Flame className="h-3 w-3 text-orange-500" />
          <span className="truncate">{item}</span>
        </button>
      ))}
    </Section>
  )
}

interface SuggestionsSectionProps {
  items: string[]
  onItemClick: (item: string) => void
}

/** 联想建议段(只在 value 时显示,value 已作为过滤条件传入;无标题,紧凑 UX) */
export function SuggestionsSection({ items, onItemClick }: SuggestionsSectionProps) {
  if (items.length === 0) return null
  return (
    <div>
      {items.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onItemClick(item)}
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
        >
          <Search className="h-3 w-3 text-muted-foreground" />
          <span className="truncate">{item}</span>
        </button>
      ))}
    </div>
  )
}

/** 段与段之间的水平分隔线(单边 border-t,作为容器内分段分隔,AGENTS.md §4 注释允许) */
export function SectionDivider() {
  return <div role="separator" className="my-1 border-t border-border/50" />
}
