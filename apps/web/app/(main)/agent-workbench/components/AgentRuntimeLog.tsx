'use client'

import * as React from 'react'
import {
  Loader2,
  MessageSquare,
  Wrench,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Pause,
  Play,
} from 'lucide-react'
import { Button, cn } from '@ihui/ui'
import { useAuthStore } from '@/stores/auth'

type LogType = 'token' | 'tool_call' | 'tool_result' | 'error'

interface LogEntry {
  ts: string
  type: LogType
  content: string
  success?: boolean
}

interface Props {
  agentId: string | null
  running: boolean
}

const TYPE_CONFIG: Record<
  LogType,
  { icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  token: { icon: MessageSquare, color: 'text-foreground' },
  tool_call: { icon: Wrench, color: 'text-sky-600 dark:text-sky-400' },
  tool_result: { icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-500' },
  error: { icon: AlertTriangle, color: 'text-destructive' },
}

// SSE 不可用时的降级静态日志
const SAMPLE_LOGS: LogEntry[] = [
  { ts: new Date(Date.now() - 60000).toISOString(), type: 'token', content: '你好,我是 Agent,准备开始任务...' },
  { ts: new Date(Date.now() - 45000).toISOString(), type: 'tool_call', content: 'grep(pattern="TODO", path="src/")' },
  { ts: new Date(Date.now() - 30000).toISOString(), type: 'tool_result', content: '找到 3 处匹配', success: true },
  { ts: new Date(Date.now() - 15000).toISOString(), type: 'token', content: '分析完成,生成报告...' },
]

const timeFmt = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

export function AgentRuntimeLog({ agentId, running }: Props) {
  const [logs, setLogs] = React.useState<LogEntry[]>([])
  const [autoScroll, setAutoScroll] = React.useState(true)
  const [connected, setConnected] = React.useState(false)
  const [usingFallback, setUsingFallback] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const abortRef = React.useRef<AbortController | null>(null)

  // SSE 流式订阅 /api/agents/:id/stream
  React.useEffect(() => {
    abortRef.current?.abort()
    setLogs([])
    setConnected(false)
    setUsingFallback(false)
    if (!agentId) return

    const controller = new AbortController()
    abortRef.current = controller
    const { token } = useAuthStore.getState()

    void (async () => {
      try {
        const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}/stream`, {
          method: 'GET',
          headers: {
            Accept: 'text/event-stream',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          signal: controller.signal,
        })
        if (!res.ok || !res.body) throw new Error(`SSE 连接失败(${res.status})`)
        setConnected(true)
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          let nl: number
          while ((nl = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, nl).replace(/\r$/, '')
            buffer = buffer.slice(nl + 1)
            if (!line.startsWith('data:')) continue
            const payload = line.slice(5).replace(/^\s/, '')
            if (payload === '[DONE]') continue
            try {
              const json = JSON.parse(payload) as Partial<LogEntry>
              const entryType = json.type
              const entryContent = json.content
              if (entryType && typeof entryContent === 'string') {
                const entry: LogEntry = {
                  ts: json.ts ?? new Date().toISOString(),
                  type: entryType,
                  content: entryContent,
                  success: json.success,
                }
                setLogs((prev) => [...prev, entry])
              }
            } catch {
              /* 忽略非 JSON 行 */
            }
          }
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return
        // 降级:显示静态日志
        setUsingFallback(true)
        setLogs(SAMPLE_LOGS)
      } finally {
        setConnected(false)
      }
    })()

    return () => {
      controller.abort()
    }
  }, [agentId])

  // 自动滚动到底部
  React.useEffect(() => {
    if (!autoScroll) return
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [logs, autoScroll])

  if (!agentId) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        选择一个 Agent 查看运行日志
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="flex items-center gap-2 text-sm">
          {connected ? (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-500">
              <span className="h-1.5 w-1.5 animate-pulse rounded-sm bg-emerald-500" />
              实时连接
            </span>
          ) : usingFallback ? (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-500">
              <AlertTriangle className="h-3.5 w-3.5" />
              静态日志(SSE 不可用)
            </span>
          ) : running ? (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              连接中...
            </span>
          ) : (
            <span className="flex items-center gap-1 text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-sm bg-muted-foreground/50" />
              未运行
            </span>
          )}
          <span className="text-xs text-muted-foreground">{logs.length} 条</span>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => setAutoScroll((v) => !v)}>
          {autoScroll ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          {autoScroll ? '暂停滚动' : '恢复滚动'}
        </Button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-auto px-3 py-2">
        {logs.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">暂无日志</div>
        ) : (
          <div className="space-y-1.5">
            {logs.map((entry, i) => {
              const cfg = TYPE_CONFIG[entry.type]
              const isFail = entry.type === 'tool_result' && entry.success === false
              const Icon = isFail ? XCircle : cfg.icon
              const color = isFail ? 'text-destructive' : cfg.color
              return (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {timeFmt.format(new Date(entry.ts))}
                  </span>
                  <Icon className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', color)} />
                  <span className={cn('min-w-0 flex-1 whitespace-pre-wrap break-words', color)}>
                    {entry.content}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
