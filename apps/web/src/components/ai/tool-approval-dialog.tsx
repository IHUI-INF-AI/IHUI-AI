'use client'

/**
 * 工具调用审批弹窗(2026-08-30 立,对标 Codex 三档审批 + Claude Code Auto mode)。
 *
 * 高危工具(写文件/执行命令/删除/写库)执行前,agent_loop_v2 审批门通过 hook_engine
 * 发 tool.approval 事件 → ai-service SSE 转发为 tool-approval → 本组件弹窗请求用户决策。
 *
 * 事件来源(两条通道,任一命中即弹窗):
 * 1. EventSource 订阅 /api/agents/tasks/stream(全局广播,接收所有会话的审批请求)
 * 2. window 自定义事件 'ihui:tool-approval'(供 executeAgentStream 等消费方回调注入)
 *
 * 用户批准/拒绝 → sendToolApprovalResponse → api 层代理 → ai-service 审批注册表,
 * 唤醒阻塞中的工具协程;拒绝/超时的工具不执行,结果以 error 回填 LLM。
 */
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, Check, Loader2, ShieldAlert } from 'lucide-react'
import { sendToolApprovalResponse } from '@ihui/api-client'
import type { ToolApprovalRequest } from '@ihui/types'
import { Modal } from '@/components/feedback'

/** 全局审批请求事件名(executeAgentStream 等消费方收到 SSE tool-approval 后可派发)。 */
export const TOOL_APPROVAL_EVENT = 'ihui:tool-approval'

/** 派发审批请求到全局弹窗(供 executeAgentStream / executeAgentRuntimeStream 消费方桥接)。 */
export function dispatchToolApprovalRequest(req: ToolApprovalRequest): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(TOOL_APPROVAL_EVENT, { detail: req }))
}

interface ApprovalDialogState {
  /** 当前展示中的审批请求(一次一个,其余排队) */
  current: ToolApprovalRequest | null
  /** 排队等待的审批请求 */
  queue: ToolApprovalRequest[]
  /** 是否正在提交决策(按钮禁用,防重复提交) */
  sending: boolean
}

const INITIAL_STATE: ApprovalDialogState = { current: null, queue: [], sending: false }

export function ToolApprovalDialog() {
  const t = useTranslations('editor.toolApproval')
  const [state, setState] = React.useState<ApprovalDialogState>(INITIAL_STATE)
  const stateRef = React.useRef(state)
  stateRef.current = state

  const enqueue = React.useCallback((req: ToolApprovalRequest) => {
    if (!req?.approvalId) return
    setState((prev) => {
      if (prev.current) {
        // 已有展示中的请求,新请求排队(同一 approval_id 去重)
        if (prev.current.approvalId === req.approvalId) return prev
        if (prev.queue.some((r) => r.approvalId === req.approvalId)) return prev
        return { ...prev, queue: [...prev.queue, req] }
      }
      return { ...prev, current: req }
    })
  }, [])

  const handleDecision = React.useCallback(async (decision: 'approve' | 'reject') => {
    const current = stateRef.current.current
    if (!current || stateRef.current.sending) return
    setState((prev) => ({ ...prev, sending: true }))
    try {
      await sendToolApprovalResponse({ approvalId: current.approvalId, decision })
    } catch (e) {
      // 响应失败不阻塞后续:关闭当前审批,让后端按超时处理(安全兜底)
      console.error('[tool-approval] 审批响应失败', e)
    } finally {
      setState((prev) => {
        const queue = [...prev.queue]
        const next = queue.shift() ?? null
        return { current: next, queue, sending: false }
      })
    }
  }, [])

  // 通道 1:EventSource 订阅 /api/agents/tasks/stream(tool-approval SSE 事件)
  React.useEffect(() => {
    if (typeof window === 'undefined' || !('EventSource' in window)) return
    const es = new EventSource('/api/agents/tasks/stream')
    const onApproval = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data as string) as {
          type?: string
          session_id?: string
          payload?: Record<string, unknown>
        }
        if (data.type !== 'tool-approval' || !data.payload) return
        const p = data.payload
        enqueue({
          approvalId: String(p.approval_id ?? ''),
          toolName: String(p.tool_name ?? ''),
          toolCallId: String(p.tool_call_id ?? ''),
          argsPreview: String(p.args_preview ?? ''),
          dangerLevel: (p.danger_level as ToolApprovalRequest['dangerLevel']) ?? 'high',
          sessionId: String(data.session_id ?? p.session_id ?? ''),
        })
      } catch {
        /* 忽略非 JSON 事件 */
      }
    }
    es.addEventListener('tool-approval', onApproval)
    // 网络错误不 close,让 EventSource 内置自动重连生效(与 use-agent-runtime 同模式)
    return () => {
      es.close()
    }
  }, [enqueue])

  // 通道 2:window 自定义事件(executeAgentStream 等消费方桥接)
  React.useEffect(() => {
    const onLocal = (e: Event) => {
      enqueue((e as CustomEvent<ToolApprovalRequest>).detail)
    }
    window.addEventListener(TOOL_APPROVAL_EVENT, onLocal as EventListener)
    return () => window.removeEventListener(TOOL_APPROVAL_EVENT, onLocal as EventListener)
  }, [enqueue])

  const current = state.current
  const pendingCount = state.queue.length

  return (
    <Modal
      open={!!current}
      // 审批不能被"关闭"绕过(用户必须决策;直接点批准/拒绝即可)
      onClose={() => {}}
      size="md"
      title={
        <span className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-500" />
          {t('title')}
        </span>
      }
      description={t('description')}
      footer={
        <>
          <button
            type="button"
            onClick={() => void handleDecision('reject')}
            disabled={state.sending}
            data-testid="tool-approval-reject"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
          >
            <AlertTriangle className="h-4 w-4" />
            {t('reject')}
          </button>
          <button
            type="button"
            onClick={() => void handleDecision('approve')}
            disabled={state.sending}
            data-testid="tool-approval-approve"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {state.sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {t('approve')}
          </button>
        </>
      }
    >
      {current && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-950/30">
            <span className="truncate font-mono text-sm font-medium">{current.toolName}</span>
            <span className="shrink-0 rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
              {current.dangerLevel}
            </span>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">{t('argsPreview')}</div>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-md border border-border bg-muted/40 p-2.5 font-mono text-xs leading-relaxed">
              {current.argsPreview || '{}'}
            </pre>
          </div>
          {pendingCount > 0 && (
            <div className="text-xs text-muted-foreground" data-testid="tool-approval-pending">
              {t('pendingCount', { count: pendingCount })}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

export default ToolApprovalDialog
