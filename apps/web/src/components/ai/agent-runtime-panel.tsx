'use client'

import * as React from 'react'
import {
  Bot,
  Play,
  Square,
  Loader2,
  AlertCircle,
  CheckCircle2,
  FileText,
  Shield,
  Ban,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { executeAgentRuntimeStream } from '@ihui/api-client'

interface AgentRuntimePanelProps {
  className?: string
}

// P2 中期增强:增加 cancelled 状态,停止后给用户明确的"任务已取消"反馈
// (此前只 setStatus('idle'),用户不知道停止是否生效)
type AgentStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled'

interface PermissionEvent {
  mode: string
  toolName?: string
  dangerLevel?: string
  decision: string
}

export function AgentRuntimePanel({ className }: AgentRuntimePanelProps) {
  const [status, setStatus] = React.useState<AgentStatus>('idle')
  const [input, setInput] = React.useState('')
  const [sessionId, setSessionId] = React.useState<string | null>(null)
  const [plan, setPlan] = React.useState<string | null>(null)
  const [output, setOutput] = React.useState<string>('')
  const [error, setError] = React.useState<string | null>(null)
  const [permission, setPermission] = React.useState<PermissionEvent | null>(null)
  const abortRef = React.useRef<AbortController | null>(null)

  const handleSend = React.useCallback(async () => {
    const message = input.trim()
    if (!message || status === 'running') return

    setStatus('running')
    setPlan(null)
    setOutput('')
    setError(null)
    setPermission(null)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      await executeAgentRuntimeStream(
        { message, mode: 'default', sessionId: sessionId ?? undefined },
        {
          onSession: (data) => setSessionId(data.sessionId),
          onPlan: (data) => setPlan(data.plan),
          onDelta: (data) => setOutput((prev) => prev + data.content),
          onPermission: (data) => setPermission(data),
          onDone: (data) => {
            setStatus('completed')
            if (data.summary) setOutput(data.summary)
          },
          onError: (data) => {
            setError(data.message)
            setStatus('failed')
          },
        },
        { signal: controller.signal },
      )
    } catch (err) {
      if (controller.signal.aborted) {
        // P2 中期增强:显示"任务已取消"状态而非静默回到 idle
        setStatus('cancelled')
        // 8s 后自动回归 idle,避免 banner 长期占位
        window.setTimeout(() => {
          setStatus((prev) => (prev === 'cancelled' ? 'idle' : prev))
        }, 8000)
      } else {
        setError(String(err))
        setStatus('failed')
      }
    } finally {
      abortRef.current = null
    }
  }, [input, status, sessionId])

  const handleStop = React.useCallback(() => {
    abortRef.current?.abort()
    // P2 中期增强:停止后置为 cancelled 状态,让用户清楚知道停止操作已生效
    setStatus('cancelled')
  }, [])

  const handleClear = React.useCallback(() => {
    setStatus('idle')
    setInput('')
    setSessionId(null)
    setPlan(null)
    setOutput('')
    setError(null)
    setPermission(null)
  }, [])

  return (
    <div className={cn('flex h-full flex-col bg-background', className)}>
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Bot className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold">Agent Runtime</span>
        {sessionId && (
          <span
            data-testid="session-id"
            className="truncate text-xs text-muted-foreground"
            title={sessionId}
          >
            #{sessionId.slice(0, 8)}
          </span>
        )}
        {status === 'running' && (
          <Loader2 data-testid="status-running" className="h-3.5 w-3.5 animate-spin text-primary" />
        )}
        {status === 'completed' && (
          <CheckCircle2 data-testid="status-completed" className="h-3.5 w-3.5 text-green-600" />
        )}
        {status === 'failed' && (
          <AlertCircle data-testid="status-failed" className="h-3.5 w-3.5 text-red-500" />
        )}
        {status === 'cancelled' && (
          <Ban data-testid="status-cancelled" className="h-3.5 w-3.5 text-zinc-500" />
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={handleClear}
          disabled={status === 'running'}
          className="rounded-md px-2 py-1 text-xs transition-colors hover:bg-accent disabled:opacity-40"
        >
          清空
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 thin-scroll">
        {plan && (
          <section className="mb-3 rounded-md border border-border bg-muted/30 p-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <FileText className="h-3 w-3" />
              执行计划
            </div>
            <pre className="whitespace-pre-wrap text-xs leading-relaxed">{plan}</pre>
          </section>
        )}

        {permission && (
          <section className="mb-3 rounded-md border border-yellow-300 bg-yellow-50 p-3 dark:border-yellow-700 dark:bg-yellow-950/30">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium">
              <Shield className="h-3 w-3" />
              权限决策:{permission.decision}
            </div>
            <div className="text-xs text-muted-foreground">
              工具:{permission.toolName ?? 'unknown'} · 等级:
              {permission.dangerLevel ?? 'read'} · 模式:{permission.mode}
            </div>
          </section>
        )}

        {output && (
          <section className="mb-3">
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">输出</div>
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{output}</div>
          </section>
        )}

        {error && (
          <section className="mb-3 rounded-md border border-red-300 bg-red-50 p-3 dark:border-red-700 dark:bg-red-950/30">
            <div className="flex items-center gap-1.5 text-xs font-medium text-red-700 dark:text-red-400">
              <AlertCircle className="h-3 w-3" />
              错误
            </div>
            <div className="mt-1 text-xs">{error}</div>
          </section>
        )}

        {/* P2 中期增强:任务被取消时显示明确提示,告知用户停止操作已生效 */}
        {status === 'cancelled' && (
          <section
            data-testid="cancelled-banner"
            className="mb-3 rounded-md border border-zinc-300 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900/30"
          >
            <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
              <Ban className="h-3 w-3" />
              任务已取消
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              已停止当前执行。如需继续,请修改输入后再次执行。
            </div>
          </section>
        )}

        {!plan && !output && !error && !permission && status !== 'cancelled' && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            输入任务,开始 Agent 执行
          </div>
        )}
      </div>

      <footer className="shrink-0 border-t border-border p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void handleSend()
              }
            }}
            placeholder="输入任务..."
            disabled={status === 'running'}
            rows={2}
            className="min-w-0 flex-1 resize-none rounded-md border border-border bg-background px-2.5 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          />
          {status === 'running' ? (
            <button
              type="button"
              onClick={handleStop}
              className="inline-flex h-9 items-center gap-1 rounded-md bg-red-500 px-3 text-xs font-medium text-white transition-colors hover:bg-red-600"
            >
              <Square className="h-3.5 w-3.5" />
              停止
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim()}
              className="inline-flex h-9 items-center gap-1 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
            >
              <Play className="h-3.5 w-3.5" />
              执行
            </button>
          )}
        </div>
      </footer>
    </div>
  )
}

export default AgentRuntimePanel
