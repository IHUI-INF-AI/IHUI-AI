// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { AlertCircle, CheckCircle2, ChevronDown, Clock, XCircle } from 'lucide-react'

import { toolDisplayKey } from '@ihui/shared/chat'
import { cn } from '@/lib/utils'

interface TraceToolCall {
  id: string
  name: string
  args: Record<string, unknown>
}

interface TraceToolResult {
  name: string
  error?: string
}

interface TraceIteration {
  iteration: number
  reasoning: string
  tool_calls: TraceToolCall[]
  tool_results: TraceToolResult[]
  duration_ms: number
}

interface TraceData {
  session_id: string
  success: boolean
  final_response: string
  iterations: TraceIteration[]
  total_duration_ms: number
  stop_reason: string
}

interface AgentTraceViewerProps {
  trace: TraceData
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

/** 终止原因 → 本地化措辞;映射不到保留原值(不猜语义,不误译) */
function stopReasonLabel(reason: string, t: (key: string) => string): string {
  const map: Record<string, string> = {
    completed: t('traceStopCompleted'),
    max_iterations: t('traceStopMaxIterations'),
    error: t('traceStopError'),
    no_tools: t('traceStopNoTools'),
    paused: t('traceStopPaused'),
    cancelled: t('traceStopCancelled'),
  }
  return map[reason] ?? reason
}

export function AgentTraceViewer({ trace }: AgentTraceViewerProps) {
  const t = useTranslations('ai.pane')
  const tStatus = useTranslations('taskStatus')
  const [expanded, setExpanded] = React.useState<Set<number>>(new Set())
  const [showAllReasoning, setShowAllReasoning] = React.useState(false)

  const toggleIteration = (idx: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  return (
    <div className="space-y-3">
      {/* 总体摘要 */}
      <div
        className={cn(
          'rounded-xl border p-3',
          trace.success
            ? 'border-emerald-500/30 bg-emerald-500/5'
            : 'border-destructive/30 bg-destructive/5',
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {trace.success ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            ) : (
              <XCircle className="h-5 w-5 text-destructive" />
            )}
            <span
              className={cn(
                'text-sm font-medium',
                trace.success ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive',
              )}
            >
              {t(trace.success ? 'traceSuccess' : 'traceFailed')}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            {stopReasonLabel(trace.stop_reason, t)}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {t('traceTotalDuration')}: {formatDuration(trace.total_duration_ms)}
          </span>
          <span>
            {t('traceTotalIterations')}: {trace.iterations.length}
          </span>
          <span>
            {t('traceSession')}: {trace.session_id.slice(0, 12)}…
          </span>
        </div>
      </div>

      {/* 迭代列表 */}
      <div className="space-y-2">
        {trace.iterations.map((it, idx) => {
          const isOpen = expanded.has(idx)
          const hasErrorInIter = it.tool_results.some((r) => r.error)

          return (
            <div
              key={idx}
              className={cn('rounded-xl border bg-card', hasErrorInIter && 'border-destructive/30')}
            >
              <button
                type="button"
                onClick={() => toggleIteration(idx)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-md text-xs font-medium',
                      hasErrorInIter
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {it.iteration}
                  </span>
                  <span className="text-sm font-medium">
                    {tStatus('roundNumber', { n: it.iteration })}
                  </span>
                  {hasErrorInIter && <AlertCircle className="h-3.5 w-3.5 text-destructive" />}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {it.tool_calls.length > 0
                      ? t('traceToolsCount', { n: it.tool_calls.length })
                      : t('traceNoToolCalls')}
                    {' · '}
                    {formatDuration(it.duration_ms)}
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 text-muted-foreground transition-transform',
                      isOpen && 'rotate-180',
                    )}
                  />
                </div>
              </button>

              {isOpen && (
                <div className="space-y-3 border-t px-4 py-3">
                  {/* 推理内容 */}
                  {it.reasoning && (
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">
                        {t('traceReasoning')}
                      </p>
                      <div
                        className={cn(
                          'rounded-md bg-muted/40 p-3 text-sm',
                          !showAllReasoning &&
                            it.reasoning.length > 300 &&
                            'max-h-24 overflow-hidden',
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words">{it.reasoning}</p>
                      </div>
                      {it.reasoning.length > 300 && (
                        <button
                          type="button"
                          onClick={() => setShowAllReasoning(!showAllReasoning)}
                          className="mt-1 text-xs text-primary hover:underline"
                        >
                          {showAllReasoning ? t('traceCollapse') : t('traceExpandAll')}
                        </button>
                      )}
                    </div>
                  )}

                  {/* 工具调用列表 */}
                  {it.tool_calls.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">
                        {t('traceToolCallsTitle', { n: it.tool_calls.length })}
                      </p>
                      <div className="space-y-1.5">
                        {it.tool_calls.map((tc) => {
                          const result = it.tool_results.find((r) => r.name === tc.name)
                          return (
                            <div
                              key={tc.id}
                              className={cn(
                                'rounded-md border px-3 py-2',
                                result?.error
                                  ? 'border-destructive/30 bg-destructive/5'
                                  : 'bg-muted/20',
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">
                                  {/* 工具显示名走共享映射;映射不到的插件/MCP 动态名保留原码名 */}
                                  {(() => {
                                    const key = toolDisplayKey(tc.name)
                                    return key ? tStatus(key) : tc.name
                                  })()}
                                </span>
                                {result?.error ? (
                                  <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                                ) : (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                )}
                              </div>
                              {tc.args && Object.keys(tc.args).length > 0 && (
                                <p className="mt-1 truncate text-xs text-muted-foreground">
                                  {JSON.stringify(tc.args)}
                                </p>
                              )}
                              {result?.error && (
                                <p className="mt-1 text-xs text-destructive">{result.error}</p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* 耗时 */}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {t('traceRoundDuration')}: {formatDuration(it.duration_ms)}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 最终回复 */}
      {trace.final_response && (
        <div className="rounded-xl border bg-card p-3">
          <p className="mb-1 text-xs font-medium text-muted-foreground">最终回复</p>
          <p className="whitespace-pre-wrap break-words text-sm">{trace.final_response}</p>
        </div>
      )}
    </div>
  )
}

export default AgentTraceViewer
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
