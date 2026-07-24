'use client'

import * as React from 'react'
import { useCallback, useState } from 'react'
import { PauseCircle, Play, RotateCcw, X, History as HistoryIcon } from 'lucide-react'
import { Button, Card, Input } from '@ihui/ui-react'
import type { SSEEvent, HistoryEntry, InterruptEvent } from '@ihui/types'
import { resumeExecution, getThreadHistory } from '@/api/langgraph-api'

/**
 * LangGraph HITL 人工介入面板(2026-07-23 立,Q1 HITL web 端)
 *
 * 触发条件:useAgentStream 收到 interrupt 事件 → 父组件传 interruptEvent 给本面板。
 *
 * 视觉规范(AGENTS.md §4):
 *  - rounded-xl 描边卡片,无 rounded-full
 *  - gap-* 间距分隔,无 divide-y / border-t 单边分割线
 *  - 中文 + 图标自动应用 --text-vcenter-offset
 *  - hover 用 subtle 颜色变化,无蓝色发光边框
 *  - 中文硬编码,不依赖 i18n
 *
 * 操作:
 *  - 恢复执行(action=resume)→ 输入 resumeValue → 调用 resumeExecution
 *  - 回滚到此处(action=rollback)
 *  - 取消执行(action=cancel)
 *  - 查看历史 → getThreadHistory → 展示 checkpoint 列表(Time Travel 入口)
 */

interface InterruptPanelProps {
  threadId: string
  interruptEvent: SSEEvent | null
  /** resume/rollback 成功后回调(通常用于 clearInterrupt + 继续监听流) */
  onResumed?: () => void
  /** cancel 成功后回调 */
  onCanceled?: () => void
}

const timeFormatter = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

/** 从 SSEEvent 提取 InterruptEvent,SSEEvent.data 承载完整 InterruptEvent 对象 */
function extractInterrupt(evt: SSEEvent | null): InterruptEvent | null {
  if (!evt) return null
  if (evt.data && typeof evt.data === 'object') {
    const d = evt.data as Partial<InterruptEvent>
    if (d.interruptId && d.nodeId && typeof d.reason === 'string') {
      return d as InterruptEvent
    }
  }
  return null
}

function formatPayload(payload: unknown): string {
  if (payload === null || payload === undefined) return '—'
  if (typeof payload === 'string') return payload
  try {
    return JSON.stringify(payload, null, 2)
  } catch {
    return String(payload)
  }
}

export function InterruptPanel({
  threadId,
  interruptEvent,
  onResumed,
  onCanceled,
}: InterruptPanelProps) {
  const interrupt = extractInterrupt(interruptEvent)
  const [resumeValue, setResumeValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const handleAction = useCallback(
    async (action: 'resume' | 'rollback' | 'cancel') => {
      if (!interrupt) return
      setSubmitting(true)
      setError(null)
      try {
        let value: unknown = undefined
        if (action === 'resume') {
          value = resumeValue.trim()
          // 尝试解析 JSON,失败则作为字符串传给后端
          try {
            value = JSON.parse(resumeValue)
          } catch {
            // 保持字符串
          }
        }
        await resumeExecution(threadId, interrupt.interruptId, value, action)
        setResumeValue('')
        if (action === 'cancel') {
          onCanceled?.()
        } else {
          onResumed?.()
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setSubmitting(false)
      }
    },
    [interrupt, resumeValue, threadId, onResumed, onCanceled],
  )

  const handleLoadHistory = useCallback(async () => {
    if (historyOpen) {
      setHistoryOpen(false)
      return
    }
    setHistoryOpen(true)
    if (history.length > 0) return
    setHistoryLoading(true)
    setError(null)
    try {
      const list = await getThreadHistory(threadId, 100)
      setHistory(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setHistoryLoading(false)
    }
  }, [historyOpen, history.length, threadId])

  if (!interrupt) return null

  const createdAt = interrupt.createdAt
    ? timeFormatter.format(new Date(interrupt.createdAt))
    : '—'

  return (
    <Card
      className="border-amber-500/40 bg-amber-50/60 p-3 text-sm dark:bg-amber-950/20"
      role="alert"
      aria-live="assertive"
    >
      {/* 标题区:暂停标识 + 节点 ID */}
      <div className="flex items-start gap-2 [&>span]:translate-y-[var(--text-vcenter-offset)]">
        <PauseCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            等待人工介入
          </span>
          <span className="text-xs text-muted-foreground">
            节点 {interrupt.nodeId} · {createdAt}
          </span>
        </div>
      </div>

      {/* 暂停原因 */}
      <div className="mt-2 rounded-md bg-background/70 p-2 text-xs">
        <div className="mb-1 font-medium text-foreground">暂停原因</div>
        <div className="break-words text-muted-foreground">
          {interrupt.reason || '未提供原因'}
        </div>
      </div>

      {/* payload 展示 */}
      {interrupt.payload !== null && interrupt.payload !== undefined && (
        <div className="mt-2 rounded-md bg-background/70 p-2 text-xs">
          <div className="mb-1 font-medium text-foreground">Payload</div>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-muted-foreground">
            {formatPayload(interrupt.payload)}
          </pre>
        </div>
      )}

      {/* resume 输入 */}
      <div className="mt-2 flex flex-col gap-1.5">
        <label htmlFor="resume-value" className="text-[11px] font-medium text-muted-foreground">
          恢复参数(可选,JSON 或纯文本)
        </label>
        <Input
          id="resume-value"
          value={resumeValue}
          onChange={(e) => setResumeValue(e.target.value)}
          placeholder='例如 {"approved": true}'
          disabled={submitting}
          className="h-8 text-xs"
        />
      </div>

      {/* 操作按钮区:gap 分隔,无 divide-y */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <Button
          size="sm"
          onClick={() => handleAction('resume')}
          disabled={submitting}
          className="h-7 gap-1 px-2.5 text-xs [&>span]:translate-y-[var(--text-vcenter-offset)]"
        >
          <Play className="h-3 w-3" />
          <span>恢复执行</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleAction('rollback')}
          disabled={submitting}
          className="h-7 gap-1 px-2.5 text-xs [&>span]:translate-y-[var(--text-vcenter-offset)]"
        >
          <RotateCcw className="h-3 w-3" />
          <span>回滚到此处</span>
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => handleAction('cancel')}
          disabled={submitting}
          className="h-7 gap-1 px-2.5 text-xs [&>span]:translate-y-[var(--text-vcenter-offset)]"
        >
          <X className="h-3 w-3" />
          <span>取消执行</span>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleLoadHistory}
          disabled={submitting}
          className="h-7 gap-1 px-2.5 text-xs [&>span]:translate-y-[var(--text-vcenter-offset)]"
        >
          <HistoryIcon className="h-3 w-3" />
          <span>查看历史</span>
        </Button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mt-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* 历史列表(Time Travel) */}
      {historyOpen && (
        <div className="mt-2.5 rounded-md bg-background/70 p-2">
          <div className="mb-1.5 text-[11px] font-medium text-muted-foreground">
            历史 Checkpoint({history.length})
          </div>
          {historyLoading ? (
            <div className="text-xs text-muted-foreground">加载中…</div>
          ) : history.length === 0 ? (
            <div className="text-xs text-muted-foreground">无历史记录</div>
          ) : (
            <ul className="flex max-h-48 flex-col gap-1 overflow-auto">
              {history.map((h) => (
                <li
                  key={h.checkpointId}
                  className="rounded-md px-2 py-1 text-[11px] transition-colors hover:bg-accent"
                >
                  <div className="flex items-center gap-1.5 [&>span]:translate-y-[var(--text-vcenter-offset)]">
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {h.checkpointId.slice(0, 8)}
                    </span>
                    <span className="truncate text-foreground">{h.nodeId}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {h.createdAt
                        ? timeFormatter.format(new Date(h.createdAt))
                        : '—'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  )
}

export default InterruptPanel
