'use client'

import * as React from 'react'
import { useLocale } from 'next-intl'
import { MessageSquare, Loader2, Eye, X } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'

interface SessionItem {
  id: string
  botId: string
  userId: string
  status: 'active' | 'paused' | 'closed'
  createdAt: number
  lastActiveAt: number
  context?: { messages: Array<{ id: string; role: string; content: string; timestamp: number }> }
}

type SessionsData = { list: SessionItem[] } | SessionItem[]

const STATUS_CLS: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-600',
  paused: 'bg-amber-500/10 text-amber-600',
  closed: 'bg-muted text-muted-foreground',
}

export default function ClawdbotSessionsPage() {
  const locale = useLocale()
  const [sessions, setSessions] = React.useState<SessionItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [selected, setSelected] = React.useState<SessionItem | null>(null)
  const timeFmt = new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  const load = React.useCallback(async () => {
    const res = await fetchApi<SessionsData>('/api/admin/clawdbot/sessions')
    if (res.success && res.data) {
      const d = res.data
      setSessions(Array.isArray(d) ? d : (d.list ?? []))
    } else if (!res.success) {
      setError(res.error)
    }
    setLoading(false)
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const viewDetail = async (s: SessionItem) => {
    const res = await fetchApi<SessionItem>(`/api/admin/clawdbot/sessions/${s.id}`)
    if (res.success && res.data) setSelected(res.data)
    else setSelected(s)
  }

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
        <MessageSquare className="h-6 w-6 text-primary" /> 会话管理
      </h1>

      <div className="rounded-lg border bg-card">
        <div className="divide-y">
          {sessions.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              暂无会话
            </div>
          ) : (
            sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{s.id}</p>
                    <span className={cn('rounded px-1.5 py-0.5 text-xs', STATUS_CLS[s.status])}>
                      {s.status}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    Bot: {s.botId} · 用户: {s.userId} · {timeFmt.format(new Date(s.lastActiveAt))}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => viewDetail(s)}>
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-modal flex items-center justify-center bg-black/50 p-4"
          tabIndex={0}
          onClick={() => setSelected(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setSelected(null)
          }}
        >
          <div
            className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-lg border bg-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-4 py-2.5">
              <p className="text-sm font-medium">会话详情 · {selected.id}</p>
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="max-h-[60vh] space-y-2 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  Bot: <span className="font-medium">{selected.botId}</span>
                </div>
                <div>
                  用户: <span className="font-medium">{selected.userId}</span>
                </div>
                <div>
                  状态: <span className="font-medium">{selected.status}</span>
                </div>
                <div>
                  创建:{' '}
                  <span className="font-medium">
                    {timeFmt.format(new Date(selected.createdAt))}
                  </span>
                </div>
              </div>
              <div className="border-t pt-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">消息记录</p>
                {(selected.context?.messages ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">暂无消息</p>
                ) : (
                  (selected.context?.messages ?? []).map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        'mb-2 rounded p-2 text-sm',
                        m.role === 'user' ? 'bg-primary/5' : 'bg-muted/50',
                      )}
                    >
                      <span className="text-xs text-muted-foreground">
                        {m.role} · {timeFmt.format(new Date(m.timestamp))}
                      </span>
                      <p className="mt-0.5">{m.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
