'use client'

import * as React from 'react'
import { Loader2, Search } from 'lucide-react'
import { Input } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import type { ContextType, Mention } from '@ihui/shared/context/index'

interface MentionSearchProps {
  /** 当前激活的 type tab */
  activeType: ContextType
  onTypeChange: (t: ContextType) => void
  /** 搜索关键字 */
  query: string
  onQueryChange: (q: string) => void
  /** 结果列表 */
  results: Mention[]
  isLoading?: boolean
  total?: number
  /** 选中某个结果 */
  onSelect?: (m: Mention) => void
  selectedId?: string
  className?: string
}

const TYPE_TABS: Array<{ value: ContextType; label: string }> = [
  { value: 'file', label: '文件' },
  { value: 'folder', label: '目录' },
  { value: 'symbol', label: '符号' },
  { value: 'database', label: '数据库' },
  { value: 'web', label: '网页' },
]

const TYPE_BADGE: Record<ContextType, string> = {
  file: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  folder: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  symbol: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  database: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  web: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
}

export function MentionSearch({
  activeType,
  onTypeChange,
  query,
  onQueryChange,
  results,
  isLoading,
  total,
  onSelect,
  selectedId,
  className,
}: MentionSearchProps) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={`搜索${TYPE_TABS.find((t) => t.value === activeType)?.label ?? ''}…`}
          className="pl-9"
          aria-label="搜索关键词"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      <div className="flex flex-wrap gap-1" role="tablist" aria-label="提及类型">
        {TYPE_TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={activeType === t.value}
            onClick={() => onTypeChange(t.value)}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              activeType === t.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
        <span>共 {total ?? results.length} 条结果</span>
      </div>

      <div className="max-h-[420px] space-y-1 overflow-y-auto rounded-md border bg-card p-1.5">
        {results.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            {isLoading ? '检索中…' : '暂无结果,请输入关键词'}
          </div>
        ) : (
          results.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelect?.(m)}
              className={cn(
                'flex w-full items-start gap-2 rounded-sm px-2.5 py-2 text-left transition-colors hover:bg-accent',
                selectedId === m.id && 'bg-accent',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-medium',
                  TYPE_BADGE[m.type],
                )}
              >
                {m.type}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{m.label}</p>
                {m.detail && (
                  <p className="truncate text-xs text-muted-foreground">{m.detail}</p>
                )}
                {m.insertText && (
                  <code className="mt-1 inline-block max-w-full truncate rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {m.insertText}
                  </code>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
