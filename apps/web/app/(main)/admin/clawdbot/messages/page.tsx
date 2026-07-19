'use client'

import * as React from 'react'
import { useLocale } from 'next-intl'
import { MessageSquare, Loader2, Search, X } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button, Input } from '@ihui/ui'
import { Alert } from '@/components/feedback'

interface MessageItem {
  id: string
  sessionId: string
  role: string
  content: string
  intent?: string
  timestamp: number
}

type MessagesData = { list: MessageItem[] } | MessageItem[]

export default function ClawdbotMessagesPage() {
  const locale = useLocale()
  const [messages, setMessages] = React.useState<MessageItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [keyword, setKeyword] = React.useState('')
  const [intentFilter, setIntentFilter] = React.useState('')
  const [selected, setSelected] = React.useState<MessageItem | null>(null)
  const timeFmt = new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  const load = React.useCallback(async () => {
    const params = new URLSearchParams()
    if (keyword.trim()) params.set('q', keyword.trim())
    if (intentFilter) params.set('intent', intentFilter)
    const qs = params.toString()
    const res = await fetchApi<MessagesData>(`/api/admin/clawdbot/messages${qs ? `?${qs}` : ''}`)
    if (res.success && res.data) {
      const d = res.data
      setMessages(Array.isArray(d) ? d : (d.list ?? []))
    } else if (!res.success) {
      setError(res.error)
    }
    setLoading(false)
  }, [keyword, intentFilter])

  React.useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 加载中...
      </div>
    )
  }
  if (error) {
    return (
      <div className="p-4">
        <Alert variant="danger" title="加载失败" description={error} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
        <MessageSquare className="h-6 w-6 text-primary" /> 消息记录
      </h1>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索消息内容..."
          />
        </div>
        <select
          className="h-9 rounded-md border bg-background px-3 text-sm"
          value={intentFilter}
          onChange={(e) => setIntentFilter(e.target.value)}
        >
          <option value="">全部意图</option>
          <option value="chat">chat</option>
          <option value="question">question</option>
          <option value="command">command</option>
          <option value="search">search</option>
          <option value="tool_request">tool_request</option>
          <option value="task">task</option>
        </select>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="divide-y">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              暂无消息
            </div>
          ) : (
            messages.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelected(m)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
              >
                <div
                  className={cn(
                    'mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs',
                    m.role === 'user'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {m.role}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{m.content}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {timeFmt.format(new Date(m.timestamp))}
                    {m.intent ? ` · ${m.intent}` : ''}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-modal flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-lg border bg-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-4 py-2.5">
              <p className="text-sm font-medium">消息详情</p>
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-3 p-4 text-sm">
              <div>
                <span className="text-muted-foreground">ID:</span> {selected.id}
              </div>
              <div>
                <span className="text-muted-foreground">会话:</span> {selected.sessionId}
              </div>
              <div>
                <span className="text-muted-foreground">角色:</span> {selected.role}
              </div>
              {selected.intent && (
                <div>
                  <span className="text-muted-foreground">意图:</span> {selected.intent}
                </div>
              )}
              <div>
                <span className="text-muted-foreground">时间:</span>{' '}
                {timeFmt.format(new Date(selected.timestamp))}
              </div>
              <div>
                <span className="text-muted-foreground">内容:</span>
                <p className="mt-1 rounded bg-muted/50 p-2">{selected.content}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
