'use client'

import * as React from 'react'
import { Search, Tag, Hash } from 'lucide-react'

import { cn } from '@/lib/utils'

interface KnowledgeItem {
  id: string
  content: string
  score?: number
  metadata?: Record<string, unknown>
}

interface KnowledgeListProps {
  items: KnowledgeItem[]
  onSearch: (query: string) => void
  loading?: boolean
}

function scoreColor(score?: number): string {
  if (score === undefined) return 'bg-muted text-muted-foreground'
  if (score >= 0.8) return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
  if (score >= 0.5) return 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
  return 'bg-muted text-muted-foreground'
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max) + '...'
}

function MetadataTags({ metadata }: { metadata?: Record<string, unknown> }) {
  if (!metadata || Object.keys(metadata).length === 0) return null

  const entries = Object.entries(metadata).slice(0, 4)
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {entries.map(([key, val]) => (
        <span
          key={key}
          className="inline-flex items-center gap-1 rounded-md bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground"
        >
          <Tag className="h-3 w-3" />
          {key}: {String(val).slice(0, 30)}
        </span>
      ))}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-xl border bg-card p-4">
          <div className="mb-2 h-4 w-3/4 rounded bg-muted" />
          <div className="mb-1 h-3 w-full rounded bg-muted" />
          <div className="h-3 w-1/2 rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}

export function KnowledgeList({ items, onSearch, loading }: KnowledgeListProps) {
  const [query, setQuery] = React.useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = query.trim()
    if (trimmed) onSearch(trimmed)
  }

  return (
    <div className="space-y-4">
      {/* 搜索输入框 */}
      <form onSubmit={handleSubmit} className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索知识库..."
          className="h-10 w-full rounded-xl border bg-background pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
        />
      </form>

      {/* 加载状态 */}
      {loading && <Skeleton />}

      {/* 空状态 */}
      {!loading && items.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <Hash className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">暂无搜索结果</p>
          <p className="text-xs text-muted-foreground/60">输入关键词搜索知识库内容</p>
        </div>
      )}

      {/* 结果列表 */}
      {!loading && items.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">共 {items.length} 条结果</p>
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border bg-card p-4 transition-colors hover:bg-accent/30"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm leading-relaxed">{truncate(item.content, 200)}</p>
                {item.score !== undefined && (
                  <span
                    className={cn(
                      'shrink-0 rounded-md px-2 py-0.5 text-xs font-medium',
                      scoreColor(item.score),
                    )}
                  >
                    {(item.score * 100).toFixed(0)}%
                  </span>
                )}
              </div>
              <MetadataTags metadata={item.metadata} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default KnowledgeList
