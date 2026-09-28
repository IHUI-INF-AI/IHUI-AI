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
import { AlertTriangle, Check, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react'
import { postToolApprovalResponse, sendToolApprovalResponse } from '@ihui/api-client'
import type { ToolApprovalRequest, ToolApprovalScope } from '@ihui/types'
import { AGENT_TASK_EVENTS, parseToolApprovalEvent } from '@ihui/shared'
import { Modal, confirmDialog } from '@/components/feedback'

/** 全局审批请求事件名(executeAgentStream 等消费方收到 SSE tool-approval 后可派发)。 */
export const TOOL_APPROVAL_EVENT = 'ihui:tool-approval'

/**
 * V3 #58(2026-09-26 立):主对话流审批请求在通用 ToolApprovalRequest 上附加的路由标记。
 * 两条审批链路的决策回传端点不同,弹窗必须按 channel 分流:
 * - channel='chat-stream' → 主对话流(llm.py _approval_sessions),决策经
 *   postToolApprovalResponse 直连 ai-service `/llm/complete/stream/{id}/approval-response`;
 * - 无 channel(agent 任务流)→ agent_loop_v2 审批注册表,走既有
 *   sendToolApprovalResponse(网关 /agent/approval-response 代理)。
 * 两套注册表互不相通,回错端点会让等待方 120s 超时 —— 这是路由标记存在的理由。
 */
export interface ChatStreamToolApprovalRequest extends ToolApprovalRequest {
  channel: 'chat-stream'
}

/** 派发审批请求到全局弹窗(供 executeAgentStream / send-message 等消费方桥接)。 */
export function dispatchToolApprovalRequest(
  req: ToolApprovalRequest | ChatStreamToolApprovalRequest,
): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(TOOL_APPROVAL_EVENT, { detail: req }))
}

// ---------------------------------------------------------------------------
// D158(2026-09-28):审批第四档「批准并把这类命令加入放行」的前端判据。
// 规则是 scope 的正交扩展(独立 state,不塞进 ToolApprovalScope 三档联合);
// 仅 chat-stream 通道 + run_command 显示 —— agent 任务流的网关 schema 会静默
// 丢弃 grant_rule,对那条通道展示该选项等于"看起来有、其实没装车"。
// ---------------------------------------------------------------------------

/** D158 第四档上送的固定口径:按 argv 前 2 个 token 落前缀规则(与后端预填一致)。 */
const GRANT_RULE_TOKENS = 2

/** D158:高危命令片段最小表(命令全文命中任一片段即要求二次确认)。 */
const DANGEROUS_COMMAND_PATTERNS: readonly string[] = [
  'rm -rf',
  'rm -fr',
  'mkfs',
  'dd if=',
  'shutdown',
  'reboot',
  'halt',
  'del /f',
  'rd /s',
  ':(){',
]

/** 从 argsPreview(JSON,可能被 200 字符截断)尽力还原 run_command 的 argv。 */
function extractRunCommandArgv(argsPreview: string): string[] {
  try {
    const parsed: unknown = JSON.parse(argsPreview)
    if (parsed && typeof parsed === 'object') {
      const argv = (parsed as { argv?: unknown }).argv
      if (Array.isArray(argv)) {
        const tokens = argv.filter((x): x is string => typeof x === 'string' && x.trim() !== '')
        if (tokens.length > 0) return tokens
      }
      const command = (parsed as { command?: unknown }).command
      if (typeof command === 'string' && command.trim() !== '') {
        return command.trim().split(/\s+/)
      }
    }
  } catch {
    // 截断的 JSON 落到这里,退回原文按空白切词兜底
  }
  const text = argsPreview.trim()
  return text === '' ? [] : text.split(/\s+/)
}

/** 命令全文(小写)是否命中高危片段表。 */
function isDangerousCommand(argv: readonly string[]): boolean {
  const cmdline = argv.join(' ').toLowerCase()
  return DANGEROUS_COMMAND_PATTERNS.some((p) => cmdline.includes(p))
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

// ---------------------------------------------------------------------------
// V3 #65/D71:「正在等人决策」这件事的**唯一事实源**。
//
// 为什么要在弹窗这一侧发布、而不是让消费方去猜:审批请求经 DOM CustomEvent 单向流进弹窗,
// 外面**没有任何可查询的状态**,于是 D71 `turn-status` 里最要紧的那一格 `waitingConfirm`
// 在 web 侧结构性拿不到 —— 徽章头注写的"现状无处可见,是用户中断的直接成因",缺的就是
// 这一个出口。在弹窗内部发布 = 状态与它的真正持有者同处一地,不会出现第二套判定。
// ---------------------------------------------------------------------------

let pendingApprovalRequest: ToolApprovalRequest | null = null
const pendingApprovalListeners = new Set<() => void>()

function publishToolApprovalPending(req: ToolApprovalRequest | null): void {
  if (pendingApprovalRequest === req) return
  pendingApprovalRequest = req
  for (const listener of pendingApprovalListeners) listener()
}

/** 订阅"是否有一条审批在等人决策"(供 useSyncExternalStore 用)。 */
export function subscribeToolApprovalPending(listener: () => void): () => void {
  pendingApprovalListeners.add(listener)
  return () => {
    pendingApprovalListeners.delete(listener)
  }
}

/** 当前等待决策的审批请求;null = 没有。SSR 快照恒 null(弹窗不在服务端渲染)。 */
export function getToolApprovalPending(): ToolApprovalRequest | null {
  return typeof window === 'undefined' ? null : pendingApprovalRequest
}

function getToolApprovalPendingSnapshot(): boolean {
  return pendingApprovalRequest !== null
}

/** 是否有一条高危工具审批正等待用户决策 —— `waitingConfirm` 的事实源。 */
export function useToolApprovalPending(): boolean {
  return React.useSyncExternalStore(
    subscribeToolApprovalPending,
    getToolApprovalPendingSnapshot,
    () => false,
  )
}

export function ToolApprovalDialog() {
  const t = useTranslations('editor.toolApproval')
  const [state, setState] = React.useState<ApprovalDialogState>(INITIAL_STATE)
  const stateRef = React.useRef(state)
  stateRef.current = state

  // 把"现在正等谁决策"发布给同页订阅者(D71 徽章的 waitingConfirm)。
  // 卸载时必须清一次:弹窗被路由切换摘掉而审批还没答完时,留着旧值会让徽章永远显示
  // "等你确认" —— 那比"看不见"更糟,因为它是个假事实。
  React.useEffect(() => {
    publishToolApprovalPending(state.current)
  }, [state.current])
  React.useEffect(
    () => () => {
      publishToolApprovalPending(null)
    },
    [],
  )

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
    async (
      decision: 'approve' | 'reject',
      scope: ToolApprovalScope,
      reason: string,
      withGrantRule = false,
    ) => {
      const current = stateRef.current.current
      if (!current || stateRef.current.sending) return
      setState((prev) => ({ ...prev, sending: true }))
      try {
        // V3 #58(2026-09-26 立):按 channel 分流决策回传端点(见类型注释)。
        if ((current as ChatStreamToolApprovalRequest).channel === 'chat-stream') {
          // 主对话流:直连 ai-service 流级审批端点(与 postToolResult 同族通道)。
          // sessionId 缺失时回传必然失败 —— 走 catch 关闭弹窗,后端按超时兜底,
          // 与"响应失败不阻塞后续"的既有策略一致。
          await postToolApprovalResponse({
            sessionId: current.sessionId ?? '',
            approvalId: current.approvalId,
            decision,
            // 作用域仅在批准时有意义(拒绝不落任何授权);once 显式传,防后端缺省意外放大
            ...(decision === 'approve' ? { scope } : {}),
            // 空原因不携带(与后端"空值不写 key"语义一致)
            ...(reason.trim() !== '' ? { reason: reason.trim() } : {}),
            // D158:第四档「批准并把这类命令加入放行」随 approve 一并上送
            // (scope 的正交扩展;拒绝路径永不携带)
            ...(decision === 'approve' && withGrantRule
              ? { grantRule: { kind: 'exec_prefix' as const, tokens: GRANT_RULE_TOKENS } }
              : {}),
          })
        } else {
          // agent 任务流:既有通道(网关 /agent/approval-response → ai-service 注册表)
          await sendToolApprovalResponse({
            approvalId: current.approvalId,
            decision,
            // 作用域仅在批准时有意义(拒绝不落任何授权);once 显式传,防旧默认(session)意外放大授权
            ...(decision === 'approve' ? { scope } : {}),
            // 空原因不携带(与后端"空值不写 key"语义一致)
            ...(reason.trim() !== '' ? { reason: reason.trim() } : {}),
          })
        }
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
  // D158:第四档(顺带生成放行规则)是独立 state,与 scope 正交,同样随请求重置。
  const [scope, setScope] = React.useState<ToolApprovalScope>('once')
  const [reason, setReason] = React.useState('')
  const [grantRule, setGrantRule] = React.useState(false)
  React.useEffect(() => {
    setScope('once')
    setReason('')
    setGrantRule(false)
  }, [current?.approvalId])

  const SCOPE_OPTIONS: ReadonlyArray<{ value: ToolApprovalScope; labelKey: string }> = [
    { value: 'once', labelKey: 'scopeOnce' },
    { value: 'session', labelKey: 'scopeSession' },
    { value: 'always', labelKey: 'scopeAlways' },
  ]

  // D158:第四档仅在 chat-stream 通道 + run_command 时展示(见上方判据注释);
  // 前缀展示与高危判定都从 argsPreview 尽力还原(argv / command 双形态兜底)。
  const isChatStream = (current as ChatStreamToolApprovalRequest | null)?.channel === 'chat-stream'
  const showGrantRule = isChatStream && current?.toolName === 'run_command'
  const runCommandArgv = current ? extractRunCommandArgv(current.argsPreview) : []
  const grantPrefix = runCommandArgv.slice(0, GRANT_RULE_TOKENS).join(' ')
  const grantDangerous = isDangerousCommand(runCommandArgv)

  const handleApproveClick = React.useCallback(() => {
    void (async () => {
      // D158:高危命令选第四档必须二次确认(原生 confirm 禁用,走项目自有确认框)
      if (showGrantRule && grantRule && grantDangerous) {
        const ok = await confirmDialog({
          title: t('grantRuleConfirmTitle'),
          content: t('grantRuleConfirmContent', { prefix: grantPrefix }),
          variant: 'danger',
          confirmText: t('approve'),
          cancelText: t('grantRuleConfirmCancel'),
        })
        if (!ok) return
      }
      await handleDecision('approve', scope, reason, showGrantRule && grantRule)
    })()
  }, [showGrantRule, grantRule, grantDangerous, grantPrefix, scope, reason, t, handleDecision])

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
            className={
              // 与 ui-react Button default 定稿同档(h-9/px-4/rounded-sm);门的 panel 类别来自
              // "模态文件"的容器推断而非元素本身,逐档裁决见 PROJECT_PLAN 圆角线条目。
              // radius-role-exempt: 页脚两个按钮是控件不是容器,到期由该门持有人改判据或本处改回
              'inline-flex h-9 items-center gap-1.5 rounded-sm border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50'
            }
          >
            <AlertTriangle className="h-4 w-4" />
            {t('reject')}
          </button>
          <button
            type="button"
            onClick={handleApproveClick}
            disabled={state.sending}
            data-testid="tool-approval-approve"
            className={
              // 同上:主按钮实底 + 前景已成对(bg-cta / text-cta-foreground,守门 83 R5 认这套),
              // 半径取控件档,门的 panel 类别来自"模态文件"的容器推断而非元素本身。
              // radius-role-exempt: 页脚主按钮是控件不是容器,到期由该门持有人改判据或本处改回
              'inline-flex h-9 items-center gap-1.5 rounded-sm bg-cta px-4 text-sm font-medium text-cta-foreground transition-colors hover:bg-cta/90 disabled:opacity-50'
            }
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
                  className={`inline-flex h-7 items-center rounded-sm border px-2.5 text-xs font-medium transition-colors ${
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
          {/* D158:第四档「批准并把这类命令加入放行」(scope 的正交扩展,独立 state;
              仅 chat-stream + run_command 展示,见上方判据注释) */}
          {showGrantRule && (
            <div>
              <button
                type="button"
                role="checkbox"
                aria-checked={grantRule}
                onClick={() => setGrantRule((v) => !v)}
                data-testid="tool-approval-grant-rule"
                className={`inline-flex h-7 items-center gap-1.5 rounded-sm border px-2.5 text-xs font-medium transition-colors ${
                  grantRule
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:bg-accent'
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                {t('grantRuleToggle')}
              </button>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {t('grantRuleDesc', { prefix: grantPrefix })}
              </p>
            </div>
          )}
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
              className="w-full resize-none rounded-sm border border-border bg-background px-2.5 py-1.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-border"
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
