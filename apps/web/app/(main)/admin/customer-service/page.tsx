'use client'

import * as React from 'react'
import { useLocale } from 'next-intl'
import { Send, Loader2, MessageCircle, Users } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button, Input } from '@ihui/ui'
import { Alert } from '@/components/feedback'
import { MessageBubble, type CsMessage } from '@/components/customer-service/MessageBubble'
import { StatCards } from './StatCards'
import type { CsSession, CsStats, SessionsData } from './types'

export default function AdminCustomerServicePage() {
  const locale = useLocale()
  const [sessions, setSessions] = React.useState<CsSession[]>([])
  const [stats, setStats] = React.useState<CsStats>({
    onlineAgents: 0,
    waiting: 0,
    todayProcessed: 0,
  })
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState('')
  const [sending, setSending] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const firstLoad = React.useRef(true)
  const timeFmt = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' })

  const loadData = React.useCallback(async () => {
    const [sessRes, statRes] = await Promise.all([
      fetchApi<SessionsData>('/api/admin/customer-service/sessions'),
      fetchApi<CsStats>('/api/admin/customer-service/stats'),
    ])
    if (sessRes.success && sessRes.data) {
      const data = sessRes.data
      setSessions(Array.isArray(data) ? data : (data.list ?? []))
    } else if (!sessRes.success && firstLoad.current) {
      setError(sessRes.error)
    }
    if (statRes.success && statRes.data) setStats(statRes.data)
    if (firstLoad.current) {
      setLoading(false)
      firstLoad.current = false
    }
  }, [])

  React.useEffect(() => {
    void loadData()
    const timer = setInterval(loadData, 5000)
    return () => clearInterval(timer)
  }, [loadData])

  React.useEffect(() => {
    if (!selectedId && sessions.length > 0) setSelectedId(sessions[0]?.id ?? null)
  }, [selectedId, sessions])

  React.useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [selectedId, sessions])

  const selected = sessions.find((s) => s.id === selectedId) ?? null

  const handleSend = async () => {
    const text = draft.trim()
    if (!text || !selected || sending) return
    setSending(true)
    const r = await fetchApi<CsMessage>('/api/admin/customer-service/send', {
      method: 'POST',
      body: JSON.stringify({ sessionId: selected.id, content: text, type: 'text' }),
    })
    setSending(false)
    if (r.success && r.data) {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === selected.id
            ? {
                ...s,
                messages: [...s.messages, r.data],
                lastMessage: text,
                lastTime: r.data.createdAt,
              }
            : s,
        ),
      )
      setDraft('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
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
      <StatCards stats={stats} />

      <div className="flex h-[calc(100vh-280px)] overflow-hidden rounded-lg border bg-card">
        <div className="flex w-72 shrink-0 flex-col border-r">
          <div className="border-b px-4 py-2.5">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <Users className="h-4 w-4" /> 会话列表
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {sessions.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                暂无会话
              </div>
            ) : (
              sessions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedId(s.id)}
                  className={cn(
                    'flex w-full items-center gap-3 border-b px-3 py-2.5 text-left transition-colors',
                    s.id === selectedId ? 'bg-accent' : 'hover:bg-muted/50',
                  )}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                    {s.userAvatar ? (
                      <img
                        src={s.userAvatar}
                        alt={s.userName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-medium text-muted-foreground">
                        {s.userName?.[0]?.toUpperCase() || '?'}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{s.userName}</p>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {s.lastTime ? timeFmt.format(new Date(s.lastTime)) : ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs text-muted-foreground">
                        {s.lastMessage || '暂无消息'}
                      </p>
                      {s.unread > 0 && (
                        <span className="shrink-0 rounded-md bg-red-500 px-1.5 text-xs text-white">
                          {s.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col">
          {selected ? (
            <>
              <div className="flex items-center gap-2 border-b px-4 py-2.5">
                <MessageCircle className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">{selected.userName}</p>
              </div>
              <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
                {(selected.messages ?? []).length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    暂无消息
                  </div>
                ) : (
                  selected.messages.map((msg) => (
                    <MessageBubble key={msg.id} message={msg} isSelf={msg.sender === 'agent'} />
                  ))
                )}
              </div>
              <div className="flex items-center gap-2 border-t p-3">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="输入回复..."
                  disabled={sending}
                  maxLength={1000}
                />
                <Button
                  type="button"
                  size="icon"
                  onClick={handleSend}
                  disabled={sending || !draft.trim()}
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              选择左侧会话查看详情
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
