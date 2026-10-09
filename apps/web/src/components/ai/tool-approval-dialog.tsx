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
import { AlertTriangle, Check, Globe, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react'
import { postToolApprovalResponse, sendToolApprovalResponse } from '@ihui/api-client'
import type { ToolApprovalRequest, ToolApprovalScope } from '@ihui/types'
import { AGENT_TASK_EVENTS, parseToolApprovalEvent } from '@ihui/shared'
import { Modal, confirmDialog } from '@/components/feedback'

/** 全局审批请求事件名(executeAgentStream 等消费方收到 SSE tool-approval 后可派发)。 */
export const TOOL_APPROVAL_EVENT = 'ihui:tool-approval'

/**
 * D159(2026-09-30 立):审批弹窗上的**逐请求事实**(视图形态,camelCase)。
 *
 * 线格式是 snake_case,权威清单在 `packages/shared/src/sse/contract.ts`
 * 的 `ToolApprovalExecEnvironmentWire` / `ToolApprovalNetworkTargetWire`,与本型的
 * 键**逐字对应**(只差大小写命名法,与 `approval_id → approvalId` 同一映射规矩)。
 * 本型住在组件这一层,是因为 `@ihui/types` 与两个解析面都不在本票文件清单内 ——
 * 见下方 `ChatStreamToolApprovalRequest` 的注释。
 */
export interface ToolApprovalExecEnvironment {
  /**
   * false = 服务端上报了这件事但**读不到**这次的真值 ⇒ 界面只能写"未上报"。
   * 与"整字段缺席"(回退开关关档)是两态,合成一态就是拿通用文案冒充事实。
   */
  available: boolean
  inSandbox?: boolean
  backend?: string
  /** 只有 local(不隔离)与 docker(隔离)有可读语义;其余 ⇒ undefined,界面不出这行 */
  networkIsolated?: boolean
  degraded?: boolean
  degradeNote?: string
}

/** 本次要连的网络目标(`display` 恒为 `host:port`,不显示归一键/哈希)。 */
export interface ToolApprovalNetworkTarget {
  host: string
  port: number
  protocol: string
  display: string
  reason?: string
}

/** 归一后的词表(未知原因 ⇒ 'unknown',界面按"未知"渲染,不把后端原文当文案直出)。 */
export const NETWORK_DENIAL_REASON_UNKNOWN = 'unknown'

/**
 * V3 #58(2026-09-26 立):主对话流审批请求在通用 ToolApprovalRequest 上附加的路由标记。
 * 两条审批链路的决策回传端点不同,弹窗必须按 channel 分流:
 * - channel='chat-stream' → 主对话流(llm.py _approval_sessions),决策经
 *   postToolApprovalResponse 直连 ai-service `/llm/complete/stream/{id}/approval-response`;
 * - 无 channel(agent 任务流)→ agent_loop_v2 审批注册表,走既有
 *   sendToolApprovalResponse(网关 /agent/approval-response 代理)。
 * 两套注册表互不相通,回错端点会让等待方 120s 超时 —— 这是路由标记存在的理由。
 *
 * D159(2026-09-30 立)再附加**逐请求的执行环境/网络目标事实**。三个字段都是可选:
 * - 全部缺席 = 服务端回退开关 `IHUI_APPROVAL_ENV_REPORT=0` ⇒ 环境区块整块不渲染
 *   (回到本票落地前的形态,不是"渲染成未上报");
 * - `execEnvironment.available === false` = 开关开着而服务端**读不到** ⇒ 必须显示
 *   "未上报"。把这一态渲染成"沙箱内/沙箱外"就是误导用户放行,比不显示更糟
 *   (票第 8 栏爆炸半径;反向对照用例 `tool-approval-environment.test.tsx` 钉住)。
 * `@ihui/types` 的 `ToolApprovalRequest` 不在本票文件清单内,所以扩展形态住在这里 ——
 * 载荷字段清单的权威在 `packages/shared/src/sse/contract.ts`(两份同形,由守门对账)。
 */
export interface ChatStreamToolApprovalRequest extends ToolApprovalRequest {
  channel: 'chat-stream'
  /** 逐请求执行环境(缺席 = 未上报开关关档) */
  execEnvironment?: ToolApprovalExecEnvironment
  /** 本次要连的网络目标(在位才给"允许该目标"三档) */
  networkTarget?: ToolApprovalNetworkTarget
  /** 已被静态策略判死的目标清单("还没有规则"不算被拦) */
  blockedNetworkTargets?: ToolApprovalNetworkTarget[]
}

/** 弹窗内部使用的合并形态(agent 任务流也带得上环境字段,不受 channel 标记约束)。 */
export type ApprovalRequestView = ToolApprovalRequest &
  Partial<Omit<ChatStreamToolApprovalRequest, keyof ToolApprovalRequest>>

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

// ---------------------------------------------------------------------------
// D161(2026-09-29 立):审批卡上的四个「决策信息字段」推导层(纯函数)。
//
// 信息源红线:四字段只准从**引擎侧已有的事实**推导(危险档 / 会话归属 / 检查点通道),
// 不得新造人工登记表;推不出来 ⇒ undefined ⇒ 整行不渲染(不显示空标签或"—")。
// 出口「在上下文中处理」本票不做:跳回锚点(待批工具调用在消息流里的落点)对全局
// EventSource 通道的跨会话请求不可机检(目标会话未必挂载),且可见跳转必须关掉
// 决策面(关掉 = 交给后端超时拒绝,语义陷阱)—— 只做字段展示(报告已登记)。
// ---------------------------------------------------------------------------

/** 状态四档(竞品词表对齐;四档标签 key 全部入词表,零死 key)。 */
export type ApprovalCardState = 'blocking' | 'requested' | 'waitingForMe' | 'overdue'

/**
 * 状态四档推导。入参全部是引擎侧/弹窗自身事实:
 * - overdue:审批截止通道(引擎侧今天没有 —— 恒 false,不伪造"已过期");
 * - isCurrent:是否正在展示中(弹窗逐条只渲染 current,排队中的请求不渲染卡片);
 * - belongsToOpenConversation:该审批是否正阻塞当前打开的会话(排队中的条目才分得出
 *   "阻塞眼前"与"等待处理";弹窗目前不渲染排队条目 ⇒ 该通道暂时不可达,词表先挂上)。
 */
export function deriveApprovalCardState(args: {
  isCurrent: boolean
  belongsToOpenConversation: boolean
  overdue: boolean
}): ApprovalCardState {
  if (args.overdue) return 'overdue'
  if (args.isCurrent) return 'waitingForMe'
  if (args.belongsToOpenConversation) return 'blocking'
  return 'requested'
}

/** 四档 → 词表 key(整 Record 覆盖,五语言齐 + 零死 key 的引用面)。 */
const DECISION_STATE_LABEL_KEYS: Record<ApprovalCardState, string> = {
  blocking: 'stateBlocking',
  requested: 'stateRequested',
  waitingForMe: 'stateWaitingForMe',
  overdue: 'stateOverdue',
}

/** 审批门认识的危险档(与 @ihui/types ToolApprovalDangerLevel 同源)。 */
const KNOWN_DANGER_LEVELS: ReadonlySet<string> = new Set(['high', 'medium', 'low'])

/**
 * whyNow(为什么现在):审批门在执行前拦下该调用、未决策不执行 —— 这两条都是
 * 引擎侧文档化事实;但**危险档读不出已知值**时,"为什么"就说不完整 ⇒ 无值。
 */
export function deriveWhyNow(
  req: Pick<ApprovalRequestView, 'toolName' | 'dangerLevel'>,
): { toolName: string; dangerLevel: string } | undefined {
  const toolName = typeof req.toolName === 'string' ? req.toolName.trim() : ''
  const dangerLevel = typeof req.dangerLevel === 'string' ? req.dangerLevel : ''
  if (toolName === '' || !KNOWN_DANGER_LEVELS.has(dangerLevel)) return undefined
  return { toolName, dangerLevel }
}

/**
 * whyYou(为什么找我):审批请求经**你自己的**通道送达(全局任务流 / 本地回调),
 * 归属靠会话 id 说清;chat-stream 通道的 sessionId 可缺席 ⇒ 缺席即无值(不猜归属)。
 */
export function deriveWhyYou(req: Pick<ApprovalRequestView, 'sessionId'>): {
  sessionId: string
} | undefined {
  const sessionId = typeof req.sessionId === 'string' ? req.sessionId.trim() : ''
  return sessionId === '' ? undefined : { sessionId }
}

/**
 * afterDecision(决定后):批准 ⇒ 工具立即执行;拒绝 ⇒ 不执行、结果以 error 回填 LLM
 * (引擎侧既有语义,弹窗头注即此口径)。工具名缺席 ⇒ 无法点名将执行什么 ⇒ 无值。
 */
export function deriveAfterDecision(req: Pick<ApprovalRequestView, 'toolName'>): {
  toolName: string
} | undefined {
  const toolName = typeof req.toolName === 'string' ? req.toolName.trim() : ''
  return toolName === '' ? undefined : { toolName }
}

/** 可逆性通道读数:idle=无会话可查;loading=在读(先不出行);novalue=读失败;value=真值。 */
type ReversibilityRead =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'novalue' }
  | { kind: 'value'; checkpointCount: number }

interface ApprovalDialogState {
  /** 当前展示中的审批请求(一次一个,其余排队) */
  current: ApprovalRequestView | null
  /** 排队等待的审批请求 */
  queue: ApprovalRequestView[]
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 依赖刻意取 state.current(值本身),把整个 ref 对象列进依赖等于每渲染一次就重发一次
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

  // D159(2026-09-30 立):这一条审批**带网络目标**时,同样三档的措辞要换成"允许该目标"
  // —— 用户点下的不是"这个工具以后都别问我",而是"这个 host:port 可以"。档位值
  // (once/session/always)一字不改,改的只有标签:回传端点与授权落点都按
  // 条目上记着的那个目标走(见 llm.py `_persist_network_grant`),客户端传不了目标。
  const networkTarget = current?.networkTarget
  const SCOPE_LABEL_KEYS: ReadonlyArray<string> = networkTarget
    ? ['envAllowTargetOnce', 'envAllowTargetSession', 'envAllowTargetAlways']
    : SCOPE_OPTIONS.map((opt) => opt.labelKey)

  // D159:执行环境区块是否渲染。**判据是"服务端有没有上报",不是"档位看起来像什么"**:
  // 三个字段全缺席 = 回退开关 IHUI_APPROVAL_ENV_REPORT=0 ⇒ 整块不渲染;
  // 而在位但 available=false ⇒ 必须渲染那一行"未上报",绝不因为"这档通常是沙箱"
  // 就替它写一个值(票第 8 栏:显示"沙箱内"而实际 plain = 误导用户放行)。
  const envReportPresent =
    !!current &&
    (current.execEnvironment !== undefined ||
      current.networkTarget !== undefined ||
      current.blockedNetworkTargets !== undefined)
  const execEnv: ToolApprovalExecEnvironment | undefined = current?.execEnvironment

  // D158:第四档仅在 chat-stream 通道 + run_command 时展示(见上方判据注释);
  // 前缀展示与高危判定都从 argsPreview 尽力还原(argv / command 双形态兜底)。
  const isChatStream = (current as ChatStreamToolApprovalRequest | null)?.channel === 'chat-stream'
  const showGrantRule = isChatStream && current?.toolName === 'run_command'
  const runCommandArgv = current ? extractRunCommandArgv(current.argsPreview) : []
  const grantPrefix = runCommandArgv.slice(0, GRANT_RULE_TOKENS).join(' ')
  const grantDangerous = isDangerousCommand(runCommandArgv)

  // D161:四字段推导(同步三字段纯函数;可逆性是异步通道,见下方 effect)。
  const whyNow = current ? deriveWhyNow(current) : undefined
  const whyYou = current ? deriveWhyYou(current) : undefined
  const afterDecision = current ? deriveAfterDecision(current) : undefined

  // D161:可逆性**真读**检查点可用性(apps/ai-service 的 /api/checkpoints 列表端点,
  // 前端单源是 @/api/checkpoint-api::listCheckpoints)。动态 import 是刻意的:静态 import
  // 会把 @/lib/api 的模块图拖进每一个部分 mock 了 @ihui/api-client 的测试(36 个文件),
  // 它们的 factory 没有 setTokenProvider ⇒ 模块图初始化即崩;动态加载 + 全 catch 让
  // "读不到通道"在任何环境下都退化为无值不渲染,而不是把测试面炸掉。
  const [reversibility, setReversibility] = React.useState<ReversibilityRead>({ kind: 'idle' })
  const reversibilitySessionId =
    typeof current?.sessionId === 'string' ? current.sessionId.trim() : ''
  React.useEffect(() => {
    if (reversibilitySessionId === '') {
      setReversibility({ kind: 'idle' })
      return
    }
    let cancelled = false
    setReversibility({ kind: 'loading' })
    import('@/api/checkpoint-api')
      .then((m) => m.listCheckpoints(reversibilitySessionId))
      .then((r) => {
        if (cancelled) return
        const count =
          typeof r.total === 'number' ? r.total : (r.checkpoints?.length ?? 0)
        setReversibility({ kind: 'value', checkpointCount: count })
      })
      .catch(() => {
        // 通道读失败 ⇒ 无值不渲染(绝不伪造"可回退/不可回退"的结论)
        if (!cancelled) setReversibility({ kind: 'novalue' })
      })
    return () => {
      cancelled = true
    }
  }, [reversibilitySessionId, current?.approvalId])

  // D161:区块渲染判据 —— 有任一行 ⇒ 行;零行且未在读取中 ⇒ 块级空态(仍不出任何字段行);
  // 零行且读取中 ⇒ 等读数落地再定(不把"没读完"说成"没有")。
  const reversibilityRow = reversibility.kind === 'value' ? reversibility : undefined
  const decisionRowCount =
    (whyNow ? 1 : 0) + (whyYou ? 1 : 0) + (afterDecision ? 1 : 0) + (reversibilityRow ? 1 : 0)
  const showDecisionBlock = !!current && (decisionRowCount > 0 || reversibility.kind !== 'loading')
  // 当前展示中的这条恒为 waitingForMe;blocking/requested 只对排队条目可分、overdue 需
  // 引擎侧截止通道 —— 两者的推导入参今天都不可达(见 deriveApprovalCardState 注),不伪造。
  const approvalState = deriveApprovalCardState({
    isCurrent: true,
    belongsToOpenConversation: false,
    overdue: false,
  })

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
          {/* D161(2026-09-29 立):决策信息四字段 —— 把审批从"风险标签"升级为"决策依据"。
              信息源红线:全部由引擎侧既有事实推导(危险档/会话归属/检查点通道),读不到 ⇒
              整行不渲染(不得显示空标签或"—");零行 ⇒ 块级空态;准入声明恒在块头。
              状态四档词表(阻塞中/等待处理/等我判断/已过期)经 deriveApprovalCardState 挂接。 */}
          {showDecisionBlock && (
            <div
              className="rounded-md border border-border bg-muted/30 p-2.5"
              data-testid="tool-approval-decision"
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="text-xs font-medium text-muted-foreground">
                  {t('decisionLabel')}
                </div>
                <span
                  data-testid="tool-approval-state"
                  className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
                >
                  {t(DECISION_STATE_LABEL_KEYS[approvalState])}
                </span>
              </div>
              <p className="mb-1.5 text-xs leading-relaxed text-muted-foreground/80">
                {t('decisionAdmission')}
              </p>
              {decisionRowCount === 0 ? (
                <div className="text-xs leading-relaxed" data-testid="tool-approval-decision-empty">
                  <p className="font-medium">{t('decisionEmptyTitle')}</p>
                  <p className="text-muted-foreground">{t('decisionEmptyDescription')}</p>
                </div>
              ) : (
                <div className="space-y-1 text-xs leading-relaxed">
                  {whyNow && (
                    <div className="flex gap-1.5" data-testid="tool-approval-why-now">
                      <span className="shrink-0 font-medium text-muted-foreground">
                        {t('decisionWhyNow')}
                      </span>
                      <span>{t('decisionWhyNowValue', whyNow)}</span>
                    </div>
                  )}
                  {whyYou && (
                    <div className="flex gap-1.5" data-testid="tool-approval-why-you">
                      <span className="shrink-0 font-medium text-muted-foreground">
                        {t('decisionWhyYou')}
                      </span>
                      <span className="break-all">{t('decisionWhyYouValue', whyYou)}</span>
                    </div>
                  )}
                  {reversibilityRow && (
                    <div className="flex gap-1.5" data-testid="tool-approval-reversibility">
                      <span className="shrink-0 font-medium text-muted-foreground">
                        {t('decisionReversibility')}
                      </span>
                      <span>
                        {reversibilityRow.checkpointCount > 0
                          ? t('decisionReversible', { count: reversibilityRow.checkpointCount })
                          : t('decisionIrreversible')}
                      </span>
                    </div>
                  )}
                  {afterDecision && (
                    <div className="flex gap-1.5" data-testid="tool-approval-after-decision">
                      <span className="shrink-0 font-medium text-muted-foreground">
                        {t('decisionAfterDecision')}
                      </span>
                      <span>{t('decisionAfterDecisionValue', afterDecision)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {/* D159(2026-09-30 立):执行环境与网络目标 —— 点"允许"之前要能读出
              "这次在哪儿跑 / 网络通不通 / 哪个目标被拦",读不到就明写"未上报"。
              整块缺席(三个字段都没有)= 服务端回退开关关档 ⇒ 一行都不渲染。 */}
          {envReportPresent && (
            <div className="rounded-md border border-border bg-muted/30 p-2.5" data-testid="tool-approval-environment">
              <div className="mb-1 text-xs font-medium text-muted-foreground">
                {t('envLabel')}
              </div>
              {!execEnv || execEnv.available === false ? (
                <p
                  className="text-xs leading-relaxed text-amber-700 dark:text-amber-400"
                  data-testid="tool-approval-env-unknown"
                >
                  {t('envUnknown')}
                </p>
              ) : (
                <div className="space-y-1 text-xs leading-relaxed">
                  <div className="flex items-center gap-1.5" data-testid="tool-approval-env-sandbox">
                    {/* degraded ⇒ **不得**再宣称"在沙箱中运行":降级链意味着隔离实际没生效,
                        此时喊沙箱就是把用户往"放行"那一侧推(票第 8 栏爆炸半径)。 */}
                    {execEnv.inSandbox === true && execEnv.degraded !== true ? (
                      <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                    )}
                    <span>
                      {execEnv.inSandbox === true && execEnv.degraded !== true
                        ? t('envInSandbox')
                        : t('envOutsideSandbox')}
                      {execEnv.backend
                        ? ` · ${t('envBackend', { backend: execEnv.backend })}`
                        : ''}
                    </span>
                  </div>
                  {execEnv.degraded === true && (
                    <p
                      className="text-amber-700 dark:text-amber-400"
                      data-testid="tool-approval-env-degraded"
                    >
                      {execEnv.degradeNote || t('envDegraded')}
                    </p>
                  )}
                  {execEnv.networkIsolated === true && (
                    <p data-testid="tool-approval-env-network-off">{t('envNetworkOff')}</p>
                  )}
                  {execEnv.networkIsolated === false && (
                    <div
                      className="flex items-center gap-1.5"
                      data-testid="tool-approval-env-network-open"
                    >
                      <Globe className="h-3.5 w-3.5 shrink-0" />
                      <span>{t('envNetworkOpen')}</span>
                    </div>
                  )}
                </div>
              )}
              {networkTarget && (
                <div className="mt-1.5" data-testid="tool-approval-network-target">
                  <div className="text-xs font-medium text-muted-foreground">
                    {t('envNetworkSection')}
                  </div>
                  <code
                    className="mt-0.5 block truncate font-mono text-xs"
                    data-testid="tool-approval-network-target-display"
                  >
                    {networkTarget.display}
                  </code>
                </div>
              )}
              {current?.blockedNetworkTargets && current.blockedNetworkTargets.length > 0 && (
                <div className="mt-1.5" data-testid="tool-approval-network-blocked">
                  <div className="text-xs font-medium text-muted-foreground">
                    {t('envNetworkBlocked')}
                  </div>
                  <ul className="mt-0.5 space-y-0.5">
                    {current.blockedNetworkTargets.map((target) => (
                      <li
                        key={`${target.host}:${target.port}:${target.protocol}`}
                        className="truncate font-mono text-xs text-amber-700 dark:text-amber-400"
                        data-testid={`tool-approval-network-blocked-${target.host}`}
                      >
                        {t('envNetworkBlockedOne', {
                          host: target.host,
                          port: target.port,
                          reason: target.reason || NETWORK_DENIAL_REASON_UNKNOWN,
                        })}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {/* D84:审批作用域(批准时生效;授权按 工具+参数 精确匹配,不放大到全局) */}
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">{t('scopeLabel')}</div>
            <div
              className="flex gap-1"
              role="radiogroup"
              aria-label={t('scopeLabel')}
              data-testid="tool-approval-scope"
            >
              {SCOPE_OPTIONS.map((opt, index) => (
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
                  {t(SCOPE_LABEL_KEYS[index] ?? opt.labelKey)}
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
