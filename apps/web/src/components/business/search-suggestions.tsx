// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// 2026-07-28 立:SearchBar 三段式搜索面板的三段子组件(历史/热门/联想)。
// 拆分原因:SearchBar.tsx 已在用户反馈中修复 2 次(input 时序 / Enter IME / 空容器),
//          把每段 UI 收敛到独立组件后,SearchBar 主文件聚焦"聚焦态 + 段拼接 + 提交",
//          后续每段改样式 / 替换数据源不影响主流程。
// 视觉规则遵循 AGENTS.md §4:段与段之间不画线(既无单边 border-t,也无背景色发丝线),
// 靠「分组标题 + 留白」区分;分组的可访问性语义由 <Section> 的 role="group" + aria-label 承载。
// 段间节奏由**消费方的面板容器**(`space-y-*`)承担,本文件不导出任何占位空 div
// (§4 给的替代正是 space-y-*/背景对比;spacer 节点为存在而存在,且要求父级知道每段的空态策略)。

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
    <div role="group" aria-label={label}>
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
