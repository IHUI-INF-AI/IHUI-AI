// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import type { ToolApprovalRequest, ToolApprovalScope } from '@ihui/types'
import { AGENT_TASK_EVENTS, parseToolApprovalEvent } from '@ihui/shared'
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

  const handleDecision = React.useCallback(
    async (decision: 'approve' | 'reject', scope: ToolApprovalScope, reason: string) => {
      const current = stateRef.current.current
      if (!current || stateRef.current.sending) return
      setState((prev) => ({ ...prev, sending: true }))
      try {
        await sendToolApprovalResponse({
          approvalId: current.approvalId,
          decision,
          // 作用域仅在批准时有意义(拒绝不落任何授权);once 显式传,防旧默认(session)意外放大授权
          ...(decision === 'approve' ? { scope } : {}),
          // 空原因不携带(与后端"空值不写 key"语义一致)
          ...(reason.trim() !== '' ? { reason: reason.trim() } : {}),
        })
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
    },
    [],
  )

  // 通道 1:EventSource 订阅 /api/agents/tasks/stream(tool-approval SSE 事件)
  React.useEffect(() => {
    if (typeof window === 'undefined' || !('EventSource' in window)) return
    const es = new EventSource('/api/agents/tasks/stream')
    // t4(2026-09-19):wire 解析迁移至共享 parseToolApprovalEvent(type 守卫 + session_id
    // 顶层优先/payload 内兜底 + danger_level 缺省 high),此处仅保留入队去重职责。
    const onApproval = (e: MessageEvent) => {
      const evt = parseToolApprovalEvent(e.data)
      if (!evt) return
      // 视图形态字段与 @ihui/types ToolApprovalRequest 一一对应,仅 dangerLevel 收窄
      enqueue({ ...evt, dangerLevel: evt.dangerLevel as ToolApprovalRequest['dangerLevel'] })
    }
    es.addEventListener(AGENT_TASK_EVENTS.TOOL_APPROVAL, onApproval)
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

  // D84:作用域选择(批准时生效,默认"允许一次"=最小特权)与原因输入;
  // 新请求入栈时重置,避免上一条的授权范围/原因串到下一条。
  const [scope, setScope] = React.useState<ToolApprovalScope>('once')
  const [reason, setReason] = React.useState('')
  React.useEffect(() => {
    setScope('once')
    setReason('')
  }, [current?.approvalId])

  const SCOPE_OPTIONS: ReadonlyArray<{ value: ToolApprovalScope; labelKey: string }> = [
    { value: 'once', labelKey: 'scopeOnce' },
    { value: 'session', labelKey: 'scopeSession' },
    { value: 'always', labelKey: 'scopeAlways' },
  ]

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
            onClick={() => void handleDecision('reject', scope, reason)}
            disabled={state.sending}
            data-testid="tool-approval-reject"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
          >
            <AlertTriangle className="h-4 w-4" />
            {t('reject')}
          </button>
          <button
            type="button"
            onClick={() => void handleDecision('approve', scope, reason)}
            disabled={state.sending}
            data-testid="tool-approval-approve"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-cta px-4 text-sm font-medium text-cta-foreground transition-colors hover:bg-cta/90 disabled:opacity-50"
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
          {/* D84:审批作用域(批准时生效;授权按 工具+参数 精确匹配,不放大到全局) */}
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">{t('scopeLabel')}</div>
            <div
              className="flex gap-1"
              role="radiogroup"
              aria-label={t('scopeLabel')}
              data-testid="tool-approval-scope"
            >
              {SCOPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={scope === opt.value}
                  onClick={() => setScope(opt.value)}
                  data-testid={`tool-approval-scope-${opt.value}`}
                  className={`inline-flex h-7 items-center rounded-md border px-2.5 text-xs font-medium transition-colors ${
                    scope === opt.value
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-border bg-background text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {t(opt.labelKey)}
                </button>
              ))}
            </div>
          </div>
          {/* D84:原因输入(可选,拒绝理由为主;随决策透传审计) */}
          <div>
            <label
              htmlFor="tool-approval-reason"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              {t('reasonLabel')}
            </label>
            <textarea
              id="tool-approval-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('reasonPlaceholder')}
              maxLength={500}
              rows={2}
              data-testid="tool-approval-reason"
              className="w-full resize-none rounded-md border border-border bg-background px-2.5 py-1.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-border"
            />
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
