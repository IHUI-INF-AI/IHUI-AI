'use client'

import * as React from 'react'
import { Loader2, MessageSquare } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  cn,
} from '@ihui/ui'
import { fetchApi } from '@/lib/api'

interface Session {
  id: string
  startedAt: string
  messageCount: number
  status: 'active' | 'completed' | 'failed' | 'aborted'
}

interface SessionMessage {
  role: string
  content: string
  ts: string
}

interface Props {
  agentId: string | null
}

const SESSION_STATUS: Record<Session['status'], { label: string; className: string }> = {
  active: { label: '进行中', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' },
  completed: { label: '已完成', className: 'bg-muted text-muted-foreground' },
  failed: { label: '失败', className: 'bg-destructive/10 text-destructive' },
  aborted: { label: '已中断', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-500' },
}

const dateFmt = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

const timeFmt = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

function truncate(id: string, len = 8): string {
  return id.length <= len ? id : `${id.slice(0, len)}...`
}

export function AgentSessionList({ agentId }: Props) {
  const [sessions, setSessions] = React.useState<Session[]>([])
  const [loading, setLoading] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)
  const [activeSession, setActiveSession] = React.useState<Session | null>(null)
  const [messages, setMessages] = React.useState<SessionMessage[]>([])
  const [msgLoading, setMsgLoading] = React.useState(false)

  React.useEffect(() => {
    if (!agentId) {
      setSessions([])
      setErr(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setErr(null)
    void (async () => {
      try {
        const res = await fetchApi<{ list?: Session[]; data?: Session[] }>(
          `/api/agents/${encodeURIComponent(agentId)}/sessions`,
        )
        if (cancelled) return
        if (res.success) {
          setSessions(res.data.list ?? res.data.data ?? [])
        } else {
          setErr(res.error || '加载失败')
          setSessions([])
        }
      } catch (e) {
        if (cancelled) return
        setErr(e instanceof Error ? e.message : '网络异常')
        setSessions([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [agentId])

  const openSession = async (s: Session) => {
    setActiveSession(s)
    setMessages([])
    setMsgLoading(true)
    try {
      const res = await fetchApi<{ messages?: SessionMessage[]; data?: SessionMessage[] }>(
        `/api/agents/${encodeURIComponent(agentId!)}/sessions/${encodeURIComponent(s.id)}`,
      )
      if (res.success) {
        setMessages(res.data.messages ?? res.data.data ?? [])
      }
    } catch {
      /* 降级显示空消息 */
    } finally {
      setMsgLoading(false)
    }
  }

  if (!agentId) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border bg-card p-6 text-center text-xs text-muted-foreground">
        选择 Agent 后查看会话历史
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col rounded-lg border bg-card">
      <div className="px-3 py-2 text-sm font-medium">
        会话历史
        <span className="ml-2 text-xs font-normal text-muted-foreground">{sessions.length}</span>
      </div>
      <div className="flex-1 overflow-auto px-2 py-1">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            加载中...
          </div>
        ) : err ? (
          <div className="px-2 py-4 text-center text-xs text-destructive">{err}</div>
        ) : sessions.length === 0 ? (
          <div className="px-2 py-8 text-center text-xs text-muted-foreground">暂无会话</div>
        ) : (
          <div className="space-y-1">
            {sessions.map((s) => {
              const badge = SESSION_STATUS[s.status] ?? SESSION_STATUS.completed
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => openSession(s)}
                  className="w-full rounded-md px-2 py-2 text-left transition-colors hover:bg-accent/50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-xs">{truncate(s.id)}</span>
                    <span
                      className={cn(
                        'inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium',
                        badge.className,
                      )}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{dateFmt.format(new Date(s.startedAt))}</span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {s.messageCount}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <Dialog open={!!activeSession} onOpenChange={(v) => !v && setActiveSession(null)}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>会话详情</DialogTitle>
            <DialogDescription>
              {activeSession
                ? `${truncate(activeSession.id, 16)} · ${dateFmt.format(new Date(activeSession.startedAt))}`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[55vh] overflow-auto rounded-md border bg-background p-3">
            {msgLoading ? (
              <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                加载消息...
              </div>
            ) : messages.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">暂无消息</div>
            ) : (
              <div className="space-y-3">
                {messages.map((m, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="font-medium uppercase">{m.role}</span>
                      <span>{timeFmt.format(new Date(m.ts))}</span>
                    </div>
                    <div className="whitespace-pre-wrap break-words rounded-md bg-muted/50 px-3 py-2 text-xs">
                      {m.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
