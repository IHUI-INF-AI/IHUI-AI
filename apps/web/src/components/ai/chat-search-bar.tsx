'use client'

import { Search } from 'lucide-react'
import { Input } from '@ihui/ui'
import type { SearchResult } from '@/hooks/use-chat-search'

interface ChatSearchBarProps {
  /** 是否显示搜索栏 */
  show: boolean
  /** 搜索关键词 */
  value: string
  /** 搜索结果列表 */
  results: SearchResult[]
  /** 输入回调 */
  onSearch: (value: string) => void
  /** 滚动到消息 */
  onScrollToMessage: (id: string) => void
}

/** 格式化时间为相对时间 */
function formatTime(time: string): string {
  if (!time) return ''
  const date = new Date(time)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}天前`
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

/**
 * AI 聊天对话搜索栏
 *
 * 从旧架构 client/src/components/ai/chat-parts/chatsearchbar.vue 迁移至 React TSX。
 * 提供对话内消息搜索 UI：搜索输入框 + 结果列表，点击结果滚动定位。
 */
export function ChatSearchBar({
  show,
  value,
  results,
  onSearch,
  onScrollToMessage,
}: ChatSearchBarProps) {
  if (!show) return null

  return (
    <div className="border-b border-border bg-background/95 backdrop-blur">
      <div className="flex items-center gap-2 px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="搜索对话内容..."
          className="h-7 border-none bg-transparent px-0 shadow-none focus-visible:ring-0"
          autoFocus
        />
      </div>
      {results.length > 0 && (
        <div className="max-h-48 overflow-y-auto border-t border-border">
          {results.map((result) => (
            <button
              key={result.id}
              onClick={() => onScrollToMessage(result.id)}
              className="flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors hover:bg-muted/50"
            >
              <span className="line-clamp-1 text-xs text-foreground">{result.preview}</span>
              <span className="text-[10px] text-muted-foreground">
                {formatTime(result.createTime)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
