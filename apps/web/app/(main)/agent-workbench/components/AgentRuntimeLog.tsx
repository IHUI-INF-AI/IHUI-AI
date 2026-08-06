'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  Loader2,
  MessageSquare,
  Wrench,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Pause,
  Play,
  RotateCw,
} from 'lucide-react'
import { Button, cn } from '@ihui/ui-react'
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
  { icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; color: string }
> = {
  token: { icon: MessageSquare, color: 'text-foreground' },
  tool_call: { icon: Wrench, color: 'text-sky-600 dark:text-sky-400' },
  tool_result: { icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-500' },
  error: { icon: AlertTriangle, color: 'text-destructive' },
}

// 2026-08-02 修复 Bug #9:删除 SAMPLE_LOGS 假数据,
// SSE 失败时显示明确错误状态 + 重试按钮,不再用静态日志误导用户

const timeFmt = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

export function AgentRuntimeLog({ agentId, running }: Props) {
  const t = useTranslations('agentWorkbench.runtimeLog')
  const [logs, setLogs] = React.useState<LogEntry[]>([])
  const [autoScroll, setAutoScroll] = React.useState(true)
  const [connected, setConnected] = React.useState(false)
  const [usingFallback, setUsingFallback] = React.useState(false)
  // 2026-08-02 修复 Bug #9:SSE 失败时记录错误信息,显示给用户而非降级假数据
  const [connectionError, setConnectionError] = React.useState<string | null>(null)
  // 2026-08-02 修复 Bug #9:retryKey 递增触发 effect 重跑,实现"重试"按钮
  const [retryKey, setRetryKey] = React.useState(0)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const abortRef = React.useRef<AbortController | null>(null)
  // 2026-08-02 修复 Bug #12:滚动 throttle 状态(leading + trailing,200ms 合并)
  const scrollThrottleRef = React.useRef<{ last: number; timer: number | null }>({
    last: 0,
    timer: null,
  })

  // SSE 流式订阅 /api/agents/:id/stream
  // 2026-08-02 修复 Bug #9:retryKey 变化时重新订阅 SSE,实现重试按钮
  React.useEffect(() => {
    abortRef.current?.abort()
    setLogs([])
    setConnected(false)
    setUsingFallback(false)
    setConnectionError(null)
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
        if (!res.ok || !res.body) throw new Error(t('sseConnectionError', { status: res.status }))
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
        // 2026-08-02 修复 Bug #9:不再降级到 SAMPLE_LOGS 假数据,
        // 显示明确错误状态 + 重试按钮,避免误导用户以为 Agent 在跑
        setUsingFallback(true)
        setLogs([])
        setConnectionError(e instanceof Error ? e.message : String(e))
      } finally {
        setConnected(false)
      }
    })()

    return () => {
      controller.abort()
    }
  }, [agentId, retryKey, t])

  // 自动滚动到底部
  // 2026-08-02 修复 Bug #12:用 leading + trailing 200ms throttle 合并滚动赋值,
  // 避免高频 token 日志每秒数十次 scrollTop 写入导致滚动抖动
  React.useEffect(() => {
    if (!autoScroll) return
    const el = scrollRef.current
    if (!el) return

    const now = Date.now()
    const st = scrollThrottleRef.current
    const remaining = 200 - (now - st.last)

    if (remaining <= 0) {
      // leading:立即滚动
      st.last = now
      if (st.timer !== null) {
        clearTimeout(st.timer)
        st.timer = null
      }
      el.scrollTop = el.scrollHeight
    } else if (st.timer === null) {
      // trailing:200ms 窗口内首次触发,安排 trailing 滚动兜底
      st.timer = window.setTimeout(() => {
        st.last = Date.now()
        st.timer = null
        const trailingEl = scrollRef.current
        if (trailingEl) trailingEl.scrollTop = trailingEl.scrollHeight
      }, remaining)
    }
  }, [logs, autoScroll])

  // 卸载时清理 throttle timer,避免泄漏
  React.useEffect(() => {
    const st = scrollThrottleRef.current
    return () => {
      if (st.timer !== null) {
        clearTimeout(st.timer)
        st.timer = null
      }
    }
  }, [])

  if (!agentId) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border bg-card p-5 min-[768px]:p-8 text-center text-sm text-muted-foreground">
        {t('selectAgentPrompt')}
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
              {t('realtimeConnection')}
            </span>
          ) : usingFallback ? (
            // 2026-08-02 修复 Bug #9:失败时显示错误状态 + 重试按钮,不再伪装"静态日志"
            <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              {t('connectionFailed')}
              {connectionError && (
                <span className="ml-1 text-[10px] text-muted-foreground/60" title={connectionError}>
                  ({connectionError.slice(0, 30)})
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  setUsingFallback(false)
                  setConnectionError(null)
                  setRetryKey((k) => k + 1)
                }}
                className="ml-2 inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] text-primary hover:bg-accent/40"
              >
                <RotateCw className="h-2.5 w-2.5" aria-hidden /> {t('retry')}
              </button>
            </span>
          ) : running ? (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              {t('connecting')}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-sm bg-muted-foreground/50" />
              {t('notRunning')}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {t('logCount', { count: logs.length })}
          </span>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => setAutoScroll((v) => !v)}>
          {autoScroll ? (
            <Pause className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Play className="h-3.5 w-3.5" aria-hidden />
          )}
          {autoScroll ? t('pauseAutoScroll') : t('resumeAutoScroll')}
        </Button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-auto px-3 py-2">
        {logs.length === 0 ? (
          usingFallback ? (
            // 2026-08-02 修复 Bug #9:SSE 失败时显示明确错误占位 + 重试按钮
            <div className="py-8 text-center text-xs text-red-500/70">
              <AlertTriangle className="mx-auto mb-2 h-5 w-5" aria-hidden />
              <p>{t('sseConnectionFailed')}</p>
              {connectionError && (
                <p className="mt-1 text-[10px] text-muted-foreground/60">{connectionError}</p>
              )}
              <button
                type="button"
                onClick={() => setRetryKey((k) => k + 1)}
                className="mt-3 inline-flex items-center gap-1 rounded-sm border border-border px-2 py-1 text-[11px] hover:bg-accent/40"
              >
                <RotateCw className="h-3 w-3" aria-hidden /> {t('retry')}
              </button>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-muted-foreground">{t('noLogs')}</div>
          )
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
                  <Icon className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', color)} aria-hidden />
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
