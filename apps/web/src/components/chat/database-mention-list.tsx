'use client'

import * as React from 'react'
import { Table, ChevronRight, ChevronDown, Loader2, Columns3 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useListTables, useGetSchema } from '@/hooks/use-context-mention'
import type { ContextMention, DatabaseColumn } from '@ihui/types'

interface DatabaseMentionListProps {
  query: string
  onSelect: (mention: ContextMention) => void
  activeIndex: number
  onItemCountChange: (count: number) => void
}

/**
 * 数据库表/schema 列表组件(MentionPopover 内部 database tab 用)。
 *
 * - 顶层显示表清单(按 q 过滤)
 * - 点击表名行展开,显示该表的列定义(columnName / dataType / nullable)
 * - 选中表(回车或点击)触发 onSelect,把表作为 ContextMention 插入
 */
export function DatabaseMentionList({
  query,
  onSelect,
  activeIndex,
  onItemCountChange,
}: DatabaseMentionListProps) {
  const { data, isLoading } = useListTables(query)
  const [expandedTable, setExpandedTable] = React.useState<string | null>(null)

  const mentions = data?.mentions ?? []
  const listRef = React.useRef<HTMLUListElement>(null)

  React.useEffect(() => {
    onItemCountChange(mentions.length)
  }, [mentions.length, onItemCountChange])

  React.useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const handleToggleExpand = (tableName: string) => {
    setExpandedTable((prev) => (prev === tableName ? null : tableName))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center px-3 py-6 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
        加载表清单...
      </div>
    )
  }

  if (mentions.length === 0) {
    return (
      <div className="px-3 py-6 text-center text-sm text-muted-foreground">
        {query ? '无匹配数据表' : '暂无数据表'}
      </div>
    )
  }

  return (
    <ul ref={listRef} className="max-h-60 overflow-y-auto p-1">
      {mentions.map((m, idx) => {
        const tableName = m.meta?.tableName ?? m.label
        const isExpanded = expandedTable === tableName
        const isActive = idx === activeIndex
        return (
          <li key={m.id}>
            <button
              type="button"
              data-idx={idx}
              onClick={() => onSelect(m)}
              onMouseEnter={() => {
                /* hover 由父级 activeIndex 管理 */
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
              )}
            >
              <span
                role="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.stopPropagation()
                  handleToggleExpand(tableName)
                }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); handleToggleExpand(tableName) } }}
                className="shrink-0 text-muted-foreground hover:text-foreground"
                aria-label={isExpanded ? '收起列定义' : '展开列定义'}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </span>
              <Table className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="break-words font-medium">{m.label}</p>
                <p className="break-words text-xs text-muted-foreground">{m.detail}</p>
              </div>
            </button>
            {isExpanded && <SchemaPanel tableName={tableName} />}
          </li>
        )
      })}
    </ul>
  )
}

/** 表 schema 列定义面板(展开时显示) */
function SchemaPanel({ tableName }: { tableName: string }) {
  const { data, isLoading } = useGetSchema(tableName)
  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 px-6 py-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        加载列定义...
      </div>
    )
  }
  const columns = data?.columns ?? []
  if (columns.length === 0) {
    return <div className="px-6 py-1.5 text-xs text-muted-foreground">无列定义</div>
  }
  return (
    <div className="px-6 py-1">
      <div className="flex items-center gap-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        <Columns3 className="h-3 w-3" />
        {columns.length} 列
      </div>
      <div className="space-y-0.5">
        {columns.map((col: DatabaseColumn) => (
          <div
            key={col.columnName}
            className="flex items-center gap-2 py-0.5 text-xs"
          >
            <span className="font-mono text-foreground">{col.columnName}</span>
            <span className="text-muted-foreground">{col.dataType}</span>
            {col.isNullable ? (
              <span className="rounded bg-muted px-1 text-[10px] text-muted-foreground">NULL</span>
            ) : (
              <span className="rounded bg-primary/10 px-1 text-[10px] text-primary">NOT NULL</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default DatabaseMentionList
