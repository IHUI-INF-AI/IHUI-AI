// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Agent 任务流 SSE 事件契约 —— 单一事实源(t4 runtime 收敛,2026-09-19 立)。
 *
 * 覆盖端点:/agents/tasks/stream(ai-service agents.py 经 hook_engine 订阅
 * AGENT_SUBSCRIBE_EVENTS,按 HOOK_EVENT_TO_SSE 映射为前端 kebab-case 命名事件)。
 *
 * 本文件集中定义该流的事件名常量 + wire payload 形态(snake_case) + 视图事件形态
 * (camelCase) + 逐事件解析器,替代此前散落在 apps/web use-agent-runtime.ts /
 * tool-approval-dialog.tsx 的内联字符串与解析模板。
 *
 * 命名对齐:Python 侧权威源为
 *   apps/ai-service/app/services/agent_events.py 的 HOOK_EVENT_TO_SSE(值侧)
 * 由 scripts/check-agent-event-parity.mjs 段 1d 提取后端生产面;本模块
 * AGENT_TASK_EVENTS 的值侧与其一一对应,前端消费点改用常量引用后由守门段 2a
 * 解析常量映射继续对账。
 *
 * 与对话流契约的关系:packages/shared/src/sse/contract.ts 的 SSE_EVENTS 覆盖
 * /v1/chat/completions 对话流(24 事件);本模块覆盖 agent 任务流。两流在
 * 'thinking'/'plan-step'/'compaction' 等名字上有交集属正常(同名义事件
 * 在两条流上各自生产)。
 */

import { z } from 'zod'
import {
  projectToolApprovalEnvFacts,
  type ToolApprovalExecEnvironment as ApiToolApprovalExecEnvironment,
  type ToolApprovalNetworkTarget as ApiToolApprovalNetworkTarget,
} from '@ihui/api-client'
// G-816042:分发工厂的"未识别事件名"分支必须计数并报名,而不是静默 null(与 isAgentTaskEventName
// 同族的另一面 —— 那个谓词回答"这个名字在不在契约里",这里回答"不在的时候有没有人知道")。
import { recordUnknownSseEventName } from './unknown-event-telemetry'

/** Agent 任务流事件名常量(单一事实源)。值即 wire 上的 `event: <名>`。 */
export const AGENT_TASK_EVENTS = {
  /** hook session.start → 会话建立 */
  SESSION: 'session',
  /** hook session.end → 会话结束摘要 */
  SESSION_END: 'session_end',
  /** hook tool.before → 工具调用开始(onmessage JSON 事件) */
  TOOL_CALL: 'tool_call',
  /** hook tool.after → 工具执行结果(onmessage JSON 事件) */
  TOOL_RESULT: 'tool_result',
  /** hook tool.approval → 高危工具审批请求 */
  TOOL_APPROVAL: 'tool-approval',
  /** hook message.send → 本轮 LLM 请求即将发出 */
  MESSAGE_SEND: 'message_send',
  /** hook message.receive → LLM 响应到达 */
  MESSAGE: 'message',
  /** hook error → 错误 */
  ERROR: 'error',
  /** hook permission.mode → 权限模式切换 */
  PERMISSION_MODE: 'permission-mode',
  /** hook self_heal → 自愈循环事件 */
  SELF_HEAL: 'self-heal',
  /** hook thinking.delta → 思考增量 */
  THINKING: 'thinking',
  /** hook plan.step → 计划步骤时间线 */
  PLAN_STEP: 'plan-step',
  /** hook terminal.delta → 终端逐行输出增量 */
  TERMINAL_DELTA: 'terminal-delta',
  /** hook compaction → 上下文压缩通知 */
  COMPACTION: 'compaction',
  /** hook agent.status → agent 瞬态状态(resuming/pausing/cancelling) */
  AGENT_STATUS: 'agent-status',
} as const

/** 全部 Agent 任务流事件名的联合类型。 */
export type AgentTaskEventName = (typeof AGENT_TASK_EVENTS)[keyof typeof AGENT_TASK_EVENTS]

/** 事件名数组(去重,用于契约对账/测试)。 */
export const AGENT_TASK_EVENT_NAMES: readonly AgentTaskEventName[] =
  Object.values(AGENT_TASK_EVENTS)

/** 判断字符串是否为已知 Agent 任务流事件名(类型守卫)。 */
export function isAgentTaskEventName(value: string): value is AgentTaskEventName {
  return (AGENT_TASK_EVENT_NAMES as readonly string[]).includes(value)
}

// ============================================================================
// wire payload 形态(snake_case,agents.py _format_sse 序列化输出)
// ============================================================================
//
// G-721(2026-10-01 立)—— 下面这些"可选 + 可空"字段(票面计 10 处)的两态词汇表,逐字段写在各自行上:
//   · **缺席**(JSON 里没有这个键 ⇒ TS 侧 `undefined`)= 发这帧的代码**没报**这个指标;
//   · **显式 null**(键在、值为 null)= 发这帧的代码**报了"没有值"**。
//   下面这些解析器把两者都折叠成视图的 `null`,所以"折叠后同形"是**视图层的事实**,
//   推论是:**要区分只能读 wire,不得从视图对象反推**。
//   两态的共同禁止项(这才是本票要钉的东西):
//   ① 不得把任何一种读成**显式清除**指令 —— 相变/清除在 agent 任务流上一律由**显式判别字段**
//      承载(self-heal 的 `phase`、plan-step 的 `status`),永远不由"键缺席"承载;
//   ② 不得把 null 折成 `0` / `''` / `false` 这类**肯定结论** —— 0 = "确实没有失败项"、
//      '' = "确实有一条空决策"、false = "确实修复失败",都是报了值,不是没报值。

/** wire 通用信封:命名事件的 data JSON,载荷挂在 payload 下,顶层带 type 与 session_id。 */
export interface AgentTaskWireEnvelope<TPayload = Record<string, unknown>> {
  type?: string
  session_id?: string
  payload?: TPayload
}

/** self-heal wire 载荷。 */
export interface SelfHealWirePayload {
  session_id?: string
  /**
   * 两个发射点(agent_loop_v2._maybe_self_heal 的 started / finished 帧)都写整数。
   * 缺席 = 这帧没报轮次;null = 同上(他方发射点)。**两者都不是"第 0 轮"**,也不是"轮次已被清零"。
   */
  iteration?: number | null
  /** 唯一的相变载体:started/finished 决定 failed·ok·attempts 三档该不该有值(见上 G-721 ①)。 */
  phase?: 'started' | 'finished'
  command?: string
  /** started 相写(number,**0 是合法肯定值**"确无失败项");finished 相整键缺席 = 该相不报此指标。缺席 ≠ 0,也 ≠ 清除。 */
  failed?: number | null
  /** 仅 finished 相写,且取 `outcome.get("ok")` ⇒ 键可在而值为 null = "结果读不到";started 相整键缺席 = 该相不适用。**两态都 ≠ false**(false = "修复失败"的肯定结论)。 */
  ok?: boolean | null
  /** 同 `ok`:仅 finished 相写、值可 null = "尝试次数读不到";缺席 = 该相不适用;**不得折成 0**(0 = "一次都没试")。 */
  attempts?: number | null
  rollbacks?: number
}

/** thinking wire 载荷。 */
export interface ThinkingWirePayload {
  run_id?: string
  content?: string
  /** 发射点(emit_thinking)恒写整数;缺席/null 只来自他方或旧帧 ⇒ 视图折 null,**不得折 0**。 */
  iteration?: number | null
  is_final?: boolean
}

/** plan-step wire 载荷。 */
export interface PlanStepWirePayload {
  run_id?: string
  step_index?: number
  tool_name?: string
  status?: string
  /** emit_plan_step 形参默认 None ⇒ **键恒发、值可 null** = "本步此刻没有决策"(started 帧就是这一态);缺席 = 非该发射器(旧帧/他方)。**两态都 ≠ ''**('' 会被读成"有一条空决策")。 */
  decision?: string | null
  /** 同 `decision`:null = 未给出原因(键在);缺席 = 旧帧/他方;**不得折成 ''**('' 是"清空了但仍有一条原因")。 */
  reason?: string | null
}

/** session_end wire 载荷。 */
export interface SessionEndWirePayload {
  session_id?: string
  user_id?: string
  success?: boolean
  stop_reason?: string
  total_iterations?: number
  total_duration_ms?: number
}

/** permission-mode wire 载荷。 */
export interface PermissionModeWirePayload {
  mode?: string
  tool?: string
  decision?: string
  session_id?: string
}

/** terminal-delta wire 载荷。 */
export interface TerminalDeltaWirePayload {
  session_id?: string
  run_id?: string
  command?: string
  stream?: string
  text?: string
  /** hook 通道恒写 `ctx.get("iteration")` ⇒ 键在、值可 null(contextvar 没注入轮次);缺席 = 进程内 push 通道(那一侧不写这组 snake 键)。两者都不得折成 0。 */
  iteration?: number | null
  /**
   * **本字段是十处里唯一"两态语义不同"的一格**,诚实登记如下:
   *   · null = 发射方**显式报"这行输出没有工具调用归属"**(工具直调、contextvar 未 set 的降级路径,实测存在);
   *   · 缺席 = 这条通道**根本不用 snake 键承载归属**(push 通道用 camelCase `terminalId` 写自己的 id)。
   * 所以"缺席"**不等于**"无归属" —— 它是"归属住在别的键里"。视图层把两者一起折进
   * `id = `${p.tool_call_id ?? p.run_id ?? 'unknown'}-…``,**这一格的区分在视图上不可恢复,只能读 wire**;
   * 而两态都**不得**折成 ''('' 会让 id 以 '-' 开头,把"没键"读成"有一条空归属"这种肯定结论)。
   */
  tool_call_id?: string | null
}

/** agent-status wire 载荷。 */
export interface AgentStatusWirePayload {
  session_id?: string
  status?: string
}

/** message_send wire 载荷。 */
export interface MessageSendWirePayload {
  session_id?: string
  iteration?: number
  messages_count?: number
}

/** tool-approval wire 载荷(session_id 可能在 payload 内或信封顶层)。 */
export interface ToolApprovalWirePayload {
  approval_id?: string | number
  tool_name?: string
  tool_call_id?: string | number
  args_preview?: string
  danger_level?: string
  session_id?: string
  /**
   * D159(2026-09-30 立):执行环境/网络目标事实。外层键 snake、内层键 camel,
   * 字段清单的权威在 `./contract.ts`(与 Python 侧 sse_contract.py 由守门对账)。
   * 这里刻意**不重列内层形状**:把哪些线字段算作一条环境事实的判据只有
   * `@ihui/api-client` 的 `projectToolApprovalEnvFacts` 一处,在此再画一份类型
   * 就是允许两边各自漂开(AGENTS"两处算同一件事必漂移")。
   */
  exec_environment?: Record<string, unknown>
  network_target?: Record<string, unknown>
  blocked_network_targets?: Record<string, unknown>[]
}

// ============================================================================
// 字段级判据(单一字段表 + 边界宽松候选 + 严格投影 typed fault)(b76-05 票1)
// ============================================================================

/**
 * 此前本模块只有事件名面(AGENT_TASK_EVENTS + G-816042 计数),字段面全靠逐解析器
 * 手搓 typeof 守卫 —— "任一字段 typeof 不符 ⇒ 整个事件丢弃(return null)",字段被
 * 静默吞掉与"流断了"在消费端完全同形,而 typecheck/lint/其余守门全都不响。本节把
 * 字段面立成三件可指认的事实:
 *
 * 1. **单一字段表**(SELF_HEAL_FIELDS 等九张 zod 全型表):每个 wire 事件一张,
 *    是"payload 上有哪些键、各是什么型"的唯一运行时真相。各解析器的路由闸用
 *    `.pick().shape` 从同一张表派生(looseObject 包一层 = 未知键放行),不另画第二份
 *    (两处算同一件事必漂移)。
 * 2. **边界宽松候选**(*_ROUTE):路由层只验"可安全路由/可计量"的最小外形状 ——
 *    未知键照常放行(交给 auditUnknownFields 计数),只查路由必需字段。完整校验
 *    推迟到严格投影:边界直接丢弃会把内容问题伪装成网络问题(store 永久等待)。
 * 3. **严格投影 typed fault**(parseAgentTaskEventStrict):逐字段全型校验,违规返回
 *    带 code 的 SseFieldFault(不是 null、不是可跳过的 console.warn 形状);
 *    未知键(payload 带、字段表没有)进 unknownSseFieldCounts 计数并一次性报名,
 *    与 G-816042 的名称面同构。
 *
 * 与主解析器的返回契约关系:parseXxxEvent / parseAgentTaskEvent 的返回形状**不变**
 * (事件对象或 null)—— apps/web use-agent-runtime 等消费点按 `if (!evt) return`
 * 接线,fault 对象若从主通道返回会伪装成事件对象污染下游状态(消费端不在本票
 * 受影响文件清单里,不得被顺手改语义)。因此 typed fault 走严格工厂通道;主解析器
 * 保留"返回 null"的 wire 兼容行为,但每次丢弃都落账(recordSseFieldFault 计数)——
 * "没读全"与"读不懂"在账面上从此不同形。
 */

/** 字段级 typed fault 的稳定码。判定侧只认这个字符串,不认 message 文本。 */
export const SSE_FIELD_FAULT_CODE = 'fault.sse.fieldRejected' as const

/** 严格投影的违规形状:一行 code + 事件名 + 字段路径 + expected/got。 */
export interface SseFieldFault {
  readonly code: typeof SSE_FIELD_FAULT_CODE
  readonly eventName: string
  readonly field: string
  readonly expected: string
  readonly got: string
}

/** 判型守卫:严格工厂的返回结果里,事件对象与 fault 靠这一谓词分辨。 */
export function isSseFieldFault(value: unknown): value is SseFieldFault {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return v.code === SSE_FIELD_FAULT_CODE && typeof v.eventName === 'string' && typeof v.field === 'string'
}

/**
 * 最小结构化的 zod 判定面(避免本文件依赖 zod 泛型内部拼写):
 * 只要 safeParse 的返回形状对得上就够了,换 zod 大版本时只动这里。
 */
interface FieldIssueLike {
  readonly path?: readonly PropertyKey[]
  readonly code?: string
  readonly expected?: string
  readonly input?: unknown
}
interface FieldResultLike {
  readonly success: boolean
  readonly error?: { readonly issues: readonly FieldIssueLike[] }
}
type FieldSchemaLike = { safeParse(input: unknown): FieldResultLike }

/** 非法值的可读描述(不装原值,与 unknown_field 的 describeType 口径一致)。 */
function describeGot(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

/** 按 issue 的 path 从原 payload 取实得值(zod v4 的 issue 不携带 input)。 */
function valueAtPath(p: unknown, path: readonly PropertyKey[]): unknown {
  let cur: unknown = p
  for (const key of path) {
    if (typeof cur !== 'object' || cur === null) return undefined
    cur = (cur as Record<string, unknown>)[String(key)]
  }
  return cur
}

function faultFromIssue(eventName: string, issue: FieldIssueLike, payload: unknown): SseFieldFault {
  const path = issue.path ?? []
  return {
    code: SSE_FIELD_FAULT_CODE,
    eventName,
    field: path.length > 0 ? path.map(String).join('.') : '(payload)',
    expected: typeof issue.expected === 'string' ? issue.expected : (issue.code ?? 'invalid'),
    got: describeGot(valueAtPath(payload, path)),
  }
}

// ---- 字段面遥测(与 unknown-event-telemetry 的名称面同构) --------------------

export type UnknownSseFieldKind = 'unknown-field' | 'field-rejected'

/** 一次字段面报名携带的事实:事件名、字段名、种类与累计次数。 */
export interface UnknownSseFieldNotice {
  readonly eventName: string
  readonly field: string
  readonly kind: UnknownSseFieldKind
  readonly count: number
}

export type UnknownSseFieldReporter = (notice: UnknownSseFieldNotice) => void

const unknownFieldCounts = new Map<string, Map<string, number>>()
const fieldFaultCounts = new Map<string, Map<string, number>>()

function defaultFieldReporter(notice: UnknownSseFieldNotice): void {
  // 英文运行时串:packages/shared/src 在守门 70(硬编码中文)射程内,中文只能留在注释里。
  const what = notice.kind === 'unknown-field' ? 'unrecognized payload field' : 'payload field rejected'
  console.warn(
    `[sse] ${what} on agent-stream event ${notice.eventName}: ${notice.field} (seen ${notice.count}x; reported once per field)`,
  )
}

let fieldReporter: UnknownSseFieldReporter = defaultFieldReporter

/** 换字段面报名出口;传 null 恢复默认控制台报名。 */
export function setUnknownSseFieldReporter(next: UnknownSseFieldReporter | null): void {
  fieldReporter = next ?? defaultFieldReporter
}

function bumpFieldCount(map: Map<string, Map<string, number>>, eventName: string, field: string): number {
  let perEvent = map.get(eventName)
  if (!perEvent) {
    perEvent = new Map()
    map.set(eventName, perEvent)
  }
  const next = (perEvent.get(field) ?? 0) + 1
  perEvent.set(field, next)
  return next
}

/** 记一次"未知 payload 字段"(首次报名,计数随时可查)。 */
function recordUnknownSseField(eventName: string, field: string): void {
  const count = bumpFieldCount(unknownFieldCounts, eventName, field)
  if (count === 1) fieldReporter({ eventName, field, kind: 'unknown-field', count })
}

/** 记一次"声明字段被严格投影拒绝"(首次报名,计数随时可查)。 */
function recordSseFieldFault(eventName: string, field: string): void {
  const count = bumpFieldCount(fieldFaultCounts, eventName, field)
  if (count === 1) fieldReporter({ eventName, field, kind: 'field-rejected', count })
}

/** 未知字段计数快照:{[事件名]: {[字段名]: 次数}}(拷贝,调用方改了不影响内部状态)。 */
export function unknownSseFieldCounts(): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {}
  for (const [eventName, perField] of unknownFieldCounts) {
    out[eventName] = {}
    for (const [field, count] of perField) out[eventName]![field] = count
  }
  return out
}

/** 声明字段被拒计数快照(形状同 unknownSseFieldCounts)。 */
export function sseFieldFaultCounts(): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {}
  for (const [eventName, perField] of fieldFaultCounts) {
    out[eventName] = {}
    for (const [field, count] of perField) out[eventName]![field] = count
  }
  return out
}

/** 清空字段面计数与报名状态(测试隔离用;宿主一般不需要)。 */
export function resetSseFieldTelemetry(): void {
  unknownFieldCounts.clear()
  fieldFaultCounts.clear()
  fieldReporter = defaultFieldReporter
}

// ---- 单一字段表(九张全型表)+ 路由候选(.pick 派生) --------------------------

const SELF_HEAL_FIELDS = z.object({
  session_id: z.string().optional(),
  iteration: z.number().nullable().optional(),
  phase: z.enum(['started', 'finished']),
  command: z.string().optional(),
  failed: z.number().nullable().optional(),
  ok: z.boolean().nullable().optional(),
  attempts: z.number().nullable().optional(),
  rollbacks: z.number().optional(),
})
const SELF_HEAL_ROUTE = z.looseObject(SELF_HEAL_FIELDS.pick({ phase: true }).shape)

const THINKING_FIELDS = z.object({
  run_id: z.string().optional(),
  content: z.string().min(1),
  iteration: z.number().nullable().optional(),
  is_final: z.boolean().optional(),
})
const THINKING_ROUTE = z.looseObject(THINKING_FIELDS.pick({ content: true }).shape)

const PLAN_STEP_FIELDS = z.object({
  run_id: z.string().optional(),
  step_index: z.number(),
  tool_name: z.string(),
  status: z.enum(['started', 'completed', 'blocked']),
  decision: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
})
const PLAN_STEP_ROUTE = z.looseObject(
  PLAN_STEP_FIELDS.pick({ step_index: true, tool_name: true, status: true }).shape,
)

const SESSION_END_FIELDS = z.object({
  session_id: z.string().optional(),
  user_id: z.string().optional(),
  success: z.boolean().optional(),
  stop_reason: z.string().optional(),
  total_iterations: z.number().optional(),
  total_duration_ms: z.number().optional(),
})
const SESSION_END_ROUTE = z.looseObject(SESSION_END_FIELDS.pick({}).shape)

const PERMISSION_MODE_FIELDS = z.object({
  mode: z.string().optional(),
  tool: z.string().optional(),
  decision: z.string().optional(),
  session_id: z.string().optional(),
})
const PERMISSION_MODE_ROUTE = z.looseObject(PERMISSION_MODE_FIELDS.pick({}).shape)

const TERMINAL_DELTA_FIELDS = z.object({
  session_id: z.string().optional(),
  run_id: z.string().optional(),
  command: z.string().optional(),
  stream: z.enum(['stdout', 'stderr']),
  text: z.string(),
  iteration: z.number().nullable().optional(),
  tool_call_id: z.string().nullable().optional(),
})
const TERMINAL_DELTA_ROUTE = z.looseObject(
  TERMINAL_DELTA_FIELDS.pick({ text: true, stream: true }).shape,
)

const AGENT_STATUS_FIELDS = z.object({
  session_id: z.string().optional(),
  status: z.enum(['resuming', 'pausing', 'cancelling']),
})
const AGENT_STATUS_ROUTE = z.looseObject(AGENT_STATUS_FIELDS.pick({ status: true }).shape)

const MESSAGE_SEND_FIELDS = z.object({
  session_id: z.string().optional(),
  iteration: z.number(),
  messages_count: z.number().optional(),
})
const MESSAGE_SEND_ROUTE = z.looseObject(MESSAGE_SEND_FIELDS.pick({ iteration: true }).shape)

const TOOL_APPROVAL_FIELDS = z.object({
  approval_id: z.union([z.string(), z.number()]).optional(),
  tool_name: z.string().optional(),
  tool_call_id: z.union([z.string(), z.number()]).optional(),
  args_preview: z.string().optional(),
  danger_level: z.string().optional(),
  session_id: z.string().optional(),
  exec_environment: z.record(z.string(), z.unknown()).optional(),
  network_target: z.record(z.string(), z.unknown()).optional(),
  blocked_network_targets: z.array(z.record(z.string(), z.unknown())).optional(),
})
const TOOL_APPROVAL_ROUTE = z.looseObject(TOOL_APPROVAL_FIELDS.pick({}).shape)

/** 未知键审计:payload 带、字段表没声明的键,计数 + 首次报名(不丢弃事件)。 */
function auditUnknownFields(eventName: string, declared: Record<string, unknown>, p: object): void {
  for (const key of Object.keys(p as Record<string, unknown>)) {
    if (!(key in declared)) recordUnknownSseField(eventName, key)
  }
}

/** 路由闸失败落账:每次"读不懂"都进 field-rejected 计数,而不是静默 null。 */
function recordRouteRejections(eventName: string, result: FieldResultLike, payload: unknown): void {
  for (const issue of result.error?.issues ?? []) {
    recordSseFieldFault(eventName, faultFromIssue(eventName, issue, payload).field)
  }
}

// ============================================================================
// 视图事件形态(camelCase,前端消费层的稳定接口)
// ============================================================================

/**
 * 自愈事件(2-3 第四批 2026-09-12):agent_loop_v2._maybe_self_heal 推送。
 * phase=started(检测到失败 pytest,heal 启动)/ finished(ok=修复结果)。
 */
export interface SelfHealEvent {
  id: string
  sessionId: string
  iteration: number | null
  phase: 'started' | 'finished'
  command: string
  failed: number | null
  ok: boolean | null
  attempts: number | null
  rollbackCount: number
  /** wire 原值(timestamp/ts),缺席即整个键不在(G-998099:客户端禁止拿本地时钟造事件时间)。 */
  ts?: number
}

/** thinking 增量事件(P0-5):同一 run 多次事件拼接累积,is_final 收尾。 */
export interface ThinkingDeltaEvent {
  runId: string
  content: string
  iteration: number | null
  isFinal: boolean
}

/**
 * plan 步骤事件(P0-5):agent_loop_v2.emit_plan_step 推送。
 * status=started/completed;blocked 由拦截/审批路径承载(本层不发射,契约保留)。
 */
export interface AgentPlanStepEvent {
  runId: string
  stepIndex: number
  toolName: string
  status: 'started' | 'completed' | 'blocked'
  decision: string | null
  reason: string | null
  /** wire 原值(timestamp/ts),缺席即整个键不在(G-998099)。 */
  ts?: number
}

/** session 结束摘要(P1,2026-09-19)。 */
export interface AgentSessionEndEvent {
  sessionId: string
  success: boolean
  stopReason: string
  totalIterations: number
  totalDurationMs: number
  /** wire 原值(timestamp/ts),缺席即整个键不在(G-998099)。 */
  ts?: number
}

/** 权限模式切换(P1,2026-09-19):高危工具审批门模式/决策变化。 */
export interface AgentPermissionModeEvent {
  mode: string
  tool: string
  decision: string
  /** wire 原值(timestamp/ts),缺席即整个键不在(G-998099)。 */
  ts?: number
}

/** 运行时终端增量输出(P1,2026-09-19):run_command 逐行 stdout/stderr(4 行/帧节流)。 */
export interface AgentTerminalDeltaEvent {
  id: string
  command: string
  stream: 'stdout' | 'stderr'
  text: string
  iteration: number | null
  /** wire 原值(timestamp/ts),缺席即整个键不在(G-998099)。 */
  ts?: number
}

/** agent 瞬态状态(P1,2026-09-19):pause/cancel 过渡。 */
export interface AgentTransientStatusEvent {
  sessionId: string
  status: 'resuming' | 'pausing' | 'cancelling'
  /** wire 原值(timestamp/ts),缺席即整个键不在(G-998099)。 */
  ts?: number
}

/** 本轮 LLM 请求发出通知(P1,2026-09-19)。 */
export interface AgentMessageSendEvent {
  iteration: number
  messagesCount: number
  /** wire 原值(timestamp/ts),缺席即整个键不在(G-998099)。 */
  ts?: number
}

/** 审批请求视图形态(与 @ihui/types ToolApprovalRequest 字段对齐)。 */
export interface ToolApprovalEvent {
  approvalId: string
  toolName: string
  toolCallId: string
  argsPreview: string
  dangerLevel: string
  sessionId: string
  /**
   * D159(2026-09-30 立)三个可选字段。类型直接取 @ihui/api-client 那一份 —— 不是偷懒:
   * 投影判据(`projectToolApprovalEnvFacts`)只有那一个实现,两条通道(chat-stream 与
   * agent 任务流)都调它,再声明一份同名字段就是允许两边各自漂开(AGENTS"两处算同一件
   * 事必漂移")。agent 任务流今天可能根本不发这些字段 ⇒ 缺席 ⇒ 弹窗整块不渲染,与开关
   * 关档同形,这是**正确**行为而不是漏接。
   */
  execEnvironment?: ApiToolApprovalExecEnvironment
  networkTarget?: ApiToolApprovalNetworkTarget
  blockedNetworkTargets?: ApiToolApprovalNetworkTarget[]
}

// ============================================================================
// 逐事件解析器(JSON.parse + 字段表路由闸 + snake→camel 格式化,无效载荷返回 null;
// 字段面判据见上方"字段级判据"节:未知键计数报名,声明字段被拒走严格工厂 typed fault)
// ============================================================================

/**
 * G-896418:信封显式校验守卫(替代原 `JSON.parse(...) as AgentTaskWireEnvelope` 断言)。
 * 路线 = 明写"信封只验结构性最小形状(声明键在时 type/session_id 为 string、payload 为
 * 非数组对象),字段级校验收口在各解析器的 zod 路由闸" —— 与 G-719(字段撤回兼容)互不
 * 重复:本守卫管信封层,G-719 管字段撤回。守卫不过 ⇒ 拒帧并落 G-816042 计数,不得静默。
 */
export function isAgentTaskWireEnvelope(data: unknown): data is AgentTaskWireEnvelope {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return false
  const rec = data as Record<string, unknown>
  if (rec['type'] !== undefined && typeof rec['type'] !== 'string') return false
  if (rec['session_id'] !== undefined && typeof rec['session_id'] !== 'string') return false
  if (
    rec['payload'] !== undefined &&
    (typeof rec['payload'] !== 'object' || rec['payload'] === null || Array.isArray(rec['payload']))
  ) {
    return false
  }
  return true
}

/** 信封拒帧在 G-816042 计数里的合成键(信封层没有事件名可挂,统一归这一格)。 */
const ENVELOPE_INVALID_COUNT_KEY = '<envelope-invalid>'

/** 安全 JSON.parse + 信封显式校验:非 JSON/形状不符一律返回 null(替代各消费点重复的 try/catch 模板)。 */
function parseEnvelope(raw: unknown): AgentTaskWireEnvelope | null {
  if (typeof raw !== 'string') return null
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isAgentTaskWireEnvelope(data)) {
    // G-896418:信封错型不得静默 —— 落 G-816042 的解析失败计数(同一键只报名一次)。
    recordUnknownSseEventName(ENVELOPE_INVALID_COUNT_KEY)
    return null
  }
  return data
}

/**
 * G-998099(2026-09-30 立):视图 ts 只允许来自 wire 原值(`timestamp`/`ts`),缺席即整个键不在。
 * 协议时间戳一律 Unix ms 且一律 CLI 时钟;客户端拿本地时钟造事件时间,会让"同一 payload
 * 重复解析"逐字节不同 —— 重放/合并后状态不可复现,去重与合并的权威坐标(id/ts)因此失稳。
 */
function wireTs(p: object): number | undefined {
  const rec = p as Record<string, unknown>
  if (typeof rec['timestamp'] === 'number') return rec['timestamp']
  if (typeof rec['ts'] === 'number') return rec['ts']
  return undefined
}

/** self-heal 解析:phase 仅接受 started/finished(路由闸),其余丢弃(落账后 null)。 */
export function parseSelfHealEvent(raw: unknown): SelfHealEvent | null {
  const data = parseEnvelope(raw)
  const p = data?.payload as SelfHealWirePayload | undefined
  const gate = SELF_HEAL_ROUTE.safeParse(p)
  if (!p || !gate.success) {
    if (p) recordRouteRejections(AGENT_TASK_EVENTS.SELF_HEAL, gate, p)
    return null
  }
  auditUnknownFields(AGENT_TASK_EVENTS.SELF_HEAL, SELF_HEAL_FIELDS.shape, p)
  const phase = gate.data.phase
  const ts = wireTs(p)
  return {
    // G-998099:id 只由线上稳定字段拼出(session/phase/iteration),同一 payload 重复解析逐字节同值。
    // (session_id ?? 'unknown') 的缺席折叠是既有形态,收敛它需先改视图接口与消费点(不在本票清单)。
    id: `${p.session_id ?? 'unknown'}-${phase}-${p.iteration ?? 0}`,
    sessionId: p.session_id ?? '',
    iteration: p.iteration ?? null,
    phase,
    command: p.command ?? '',
    failed: phase === 'started' ? (p.failed ?? null) : null,
    ok: phase === 'finished' ? (p.ok ?? null) : null,
    attempts: phase === 'finished' ? (p.attempts ?? null) : null,
    rollbackCount: p.rollbacks ?? 0,
    ...(ts !== undefined ? { ts } : {}),
  }
}

/** thinking 解析:空 content 丢弃(整段透传,由消费方决定拼接策略)。 */
export function parseThinkingEvent(raw: unknown): ThinkingDeltaEvent | null {
  const data = parseEnvelope(raw)
  const p = data?.payload as ThinkingWirePayload | undefined
  const gate = THINKING_ROUTE.safeParse(p)
  if (!p || !gate.success) {
    if (p) recordRouteRejections(AGENT_TASK_EVENTS.THINKING, gate, p)
    return null
  }
  auditUnknownFields(AGENT_TASK_EVENTS.THINKING, THINKING_FIELDS.shape, p)
  return {
    runId: p.run_id ?? '',
    content: gate.data.content,
    iteration: typeof p.iteration === 'number' ? p.iteration : null,
    isFinal: p.is_final === true,
  }
}

/** plan-step 解析:step_index/tool_name 必填,status 白名单(路由闸)。 */
export function parsePlanStepEvent(raw: unknown): AgentPlanStepEvent | null {
  const data = parseEnvelope(raw)
  const p = data?.payload as PlanStepWirePayload | undefined
  const gate = PLAN_STEP_ROUTE.safeParse(p)
  if (!p || !gate.success) {
    if (p) recordRouteRejections(AGENT_TASK_EVENTS.PLAN_STEP, gate, p)
    return null
  }
  auditUnknownFields(AGENT_TASK_EVENTS.PLAN_STEP, PLAN_STEP_FIELDS.shape, p)
  const status = gate.data.status
  const ts = wireTs(p)
  return {
    runId: p.run_id ?? '',
    stepIndex: gate.data.step_index,
    toolName: gate.data.tool_name,
    status,
    decision: typeof p.decision === 'string' ? p.decision : null,
    reason: typeof p.reason === 'string' ? p.reason : null,
    ...(ts !== undefined ? { ts } : {}),
  }
}

/** session_end 解析:payload 缺失即丢弃。 */
export function parseSessionEndEvent(raw: unknown): AgentSessionEndEvent | null {
  const data = parseEnvelope(raw)
  const p = data?.payload as SessionEndWirePayload | undefined
  const gate = SESSION_END_ROUTE.safeParse(p)
  if (!p || !gate.success) {
    if (p) recordRouteRejections(AGENT_TASK_EVENTS.SESSION_END, gate, p)
    return null
  }
  auditUnknownFields(AGENT_TASK_EVENTS.SESSION_END, SESSION_END_FIELDS.shape, p)
  const ts = wireTs(p)
  return {
    sessionId: p.session_id ?? '',
    success: Boolean(p.success),
    stopReason: p.stop_reason ?? '',
    totalIterations: p.total_iterations ?? 0,
    totalDurationMs: p.total_duration_ms ?? 0,
    ...(ts !== undefined ? { ts } : {}),
  }
}

/** permission-mode 解析:payload 缺失即丢弃。 */
export function parsePermissionModeEvent(raw: unknown): AgentPermissionModeEvent | null {
  const data = parseEnvelope(raw)
  const p = data?.payload as PermissionModeWirePayload | undefined
  const gate = PERMISSION_MODE_ROUTE.safeParse(p)
  if (!p || !gate.success) {
    if (p) recordRouteRejections(AGENT_TASK_EVENTS.PERMISSION_MODE, gate, p)
    return null
  }
  auditUnknownFields(AGENT_TASK_EVENTS.PERMISSION_MODE, PERMISSION_MODE_FIELDS.shape, p)
  const ts = wireTs(p)
  return {
    mode: p.mode ?? '',
    tool: p.tool ?? '',
    decision: p.decision ?? '',
    ...(ts !== undefined ? { ts } : {}),
  }
}

/** terminal-delta 解析:text 必填,stream 仅 stdout/stderr(路由闸)。 */
export function parseTerminalDeltaEvent(raw: unknown): AgentTerminalDeltaEvent | null {
  const data = parseEnvelope(raw)
  const p = data?.payload as TerminalDeltaWirePayload | undefined
  const gate = TERMINAL_DELTA_ROUTE.safeParse(p)
  if (!p || !gate.success) {
    if (p) recordRouteRejections(AGENT_TASK_EVENTS.TERMINAL_DELTA, gate, p)
    return null
  }
  auditUnknownFields(AGENT_TASK_EVENTS.TERMINAL_DELTA, TERMINAL_DELTA_FIELDS.shape, p)
  const stream = gate.data.stream
  const ts = wireTs(p)
  return {
    // G-998099:id 只由线上稳定字段拼出(tool_call_id/run_id + iteration),不再掺本地时钟。
    id: `${p.tool_call_id ?? p.run_id ?? 'unknown'}-${p.iteration ?? 0}`,
    command: p.command ?? '',
    stream,
    text: gate.data.text,
    iteration: typeof p.iteration === 'number' ? p.iteration : null,
    ...(ts !== undefined ? { ts } : {}),
  }
}

/** agent-status 解析:status 仅 resuming/pausing/cancelling(路由闸)。 */
export function parseAgentStatusEvent(raw: unknown): AgentTransientStatusEvent | null {
  const data = parseEnvelope(raw)
  const p = data?.payload as AgentStatusWirePayload | undefined
  const gate = AGENT_STATUS_ROUTE.safeParse(p)
  if (!p || !gate.success) {
    if (p) recordRouteRejections(AGENT_TASK_EVENTS.AGENT_STATUS, gate, p)
    return null
  }
  auditUnknownFields(AGENT_TASK_EVENTS.AGENT_STATUS, AGENT_STATUS_FIELDS.shape, p)
  const status = gate.data.status
  const ts = wireTs(p)
  return { sessionId: p.session_id ?? '', status, ...(ts !== undefined ? { ts } : {}) }
}

/** message_send 解析:iteration 必填(number,路由闸)。 */
export function parseMessageSendEvent(raw: unknown): AgentMessageSendEvent | null {
  const data = parseEnvelope(raw)
  const p = data?.payload as MessageSendWirePayload | undefined
  const gate = MESSAGE_SEND_ROUTE.safeParse(p)
  if (!p || !gate.success) {
    if (p) recordRouteRejections(AGENT_TASK_EVENTS.MESSAGE_SEND, gate, p)
    return null
  }
  auditUnknownFields(AGENT_TASK_EVENTS.MESSAGE_SEND, MESSAGE_SEND_FIELDS.shape, p)
  const ts = wireTs(p)
  return {
    iteration: gate.data.iteration,
    messagesCount: p.messages_count ?? 0,
    ...(ts !== undefined ? { ts } : {}),
  }
}

/** tool-approval 解析:session_id 顶层优先、payload 内兜底;danger_level 缺省 high。 */
export function parseToolApprovalEvent(raw: unknown): ToolApprovalEvent | null {
  const data = parseEnvelope(raw)
  if (!data || data.type !== AGENT_TASK_EVENTS.TOOL_APPROVAL) return null
  const p = data.payload as ToolApprovalWirePayload | undefined
  const gate = TOOL_APPROVAL_ROUTE.safeParse(p)
  if (!p || !gate.success) {
    if (p) recordRouteRejections(AGENT_TASK_EVENTS.TOOL_APPROVAL, gate, p)
    return null
  }
  auditUnknownFields(AGENT_TASK_EVENTS.TOOL_APPROVAL, TOOL_APPROVAL_FIELDS.shape, p)
  return {
    approvalId: String(p.approval_id ?? ''),
    toolName: String(p.tool_name ?? ''),
    toolCallId: String(p.tool_call_id ?? ''),
    argsPreview: String(p.args_preview ?? ''),
    dangerLevel: p.danger_level ?? 'high',
    sessionId: String(data.session_id ?? p.session_id ?? ''),
    // D159:与 chat-stream 通道共用同一份投影(见上 import 处注释)—— 判据只有一份,
    // 两条流各自"认哪些字段算环境事实"不可能漂开。
    ...projectToolApprovalEnvFacts(p),
  }
}

/**
 * 严格投影工厂(b76-05 票1):路由闸通过后,对整张字段表逐字段全型校验。
 * 声明字段违规 ⇒ 返回带 `fault.sse.fieldRejected` 码的 SseFieldFault(**不是 null**)——
 * 这一形状就是"读不懂"在账面上的样子;未知键照常进 unknownSseFieldCounts。
 * 全型通过 ⇒ 交回主工厂拿同一份事件对象(路由闸是字段表的 .pick 派生,严格通过
 * 则路由必通过,此处不会出现"严格绿而路由红")。
 * 字段表之外的事件名交回主工厂(含未知名计数),不造第二份路由判据。
 */
export function parseAgentTaskEventStrict(
  name: string,
  raw: unknown,
): AgentTaskEvent | SseFieldFault | null {
  const data = parseEnvelope(raw)
  if (!data) return null
  const p = data.payload
  if (!p) return null
  const strictByEvent: Record<string, FieldSchemaLike> = {
    [AGENT_TASK_EVENTS.SELF_HEAL]: SELF_HEAL_FIELDS,
    [AGENT_TASK_EVENTS.THINKING]: THINKING_FIELDS,
    [AGENT_TASK_EVENTS.PLAN_STEP]: PLAN_STEP_FIELDS,
    [AGENT_TASK_EVENTS.SESSION_END]: SESSION_END_FIELDS,
    [AGENT_TASK_EVENTS.PERMISSION_MODE]: PERMISSION_MODE_FIELDS,
    [AGENT_TASK_EVENTS.TERMINAL_DELTA]: TERMINAL_DELTA_FIELDS,
    [AGENT_TASK_EVENTS.AGENT_STATUS]: AGENT_STATUS_FIELDS,
    [AGENT_TASK_EVENTS.MESSAGE_SEND]: MESSAGE_SEND_FIELDS,
    [AGENT_TASK_EVENTS.TOOL_APPROVAL]: TOOL_APPROVAL_FIELDS,
  }
  const schema = strictByEvent[name]
  if (!schema) return parseAgentTaskEvent(name, raw)
  if (name === AGENT_TASK_EVENTS.TOOL_APPROVAL && data.type !== AGENT_TASK_EVENTS.TOOL_APPROVAL) {
    return null
  }
  const strict = schema.safeParse(p)
  if (!strict.success) {
    const issues = strict.error?.issues ?? []
    let first: SseFieldFault | null = null
    for (const issue of issues) {
      const fault = faultFromIssue(name, issue, p)
      recordSseFieldFault(name, fault.field)
      if (!first) first = fault
    }
    if (first) return first
  }
  return parseAgentTaskEvent(name, raw)
}

// ============================================================================
// 统一分发工厂(EventSink 协议的解析层:事件名 → 解析器路由)
// ============================================================================

/** Agent 任务流解析后视图事件的判别联合。 */
export type AgentTaskEvent =
  | { name: typeof AGENT_TASK_EVENTS.SELF_HEAL; event: SelfHealEvent }
  | { name: typeof AGENT_TASK_EVENTS.THINKING; event: ThinkingDeltaEvent }
  | { name: typeof AGENT_TASK_EVENTS.PLAN_STEP; event: AgentPlanStepEvent }
  | { name: typeof AGENT_TASK_EVENTS.SESSION_END; event: AgentSessionEndEvent }
  | { name: typeof AGENT_TASK_EVENTS.PERMISSION_MODE; event: AgentPermissionModeEvent }
  | { name: typeof AGENT_TASK_EVENTS.TERMINAL_DELTA; event: AgentTerminalDeltaEvent }
  | { name: typeof AGENT_TASK_EVENTS.AGENT_STATUS; event: AgentTransientStatusEvent }
  | { name: typeof AGENT_TASK_EVENTS.MESSAGE_SEND; event: AgentMessageSendEvent }
  | { name: typeof AGENT_TASK_EVENTS.TOOL_APPROVAL; event: ToolApprovalEvent }

/**
 * 按事件名路由到对应解析器(EventSink 协议统一入口)。
 * 未知事件名/无效载荷返回 null,调用方静默丢弃(与各消费点既有 try/catch 行为等价)。
 * 仅覆盖前端当前逐名消费的 9 个事件;session/tool_call/tool_result/message/error/
 * compaction 由 onmessage 泛型或对话流契约(SSE_EVENTS)承载,不经本工厂。
 */
export function parseAgentTaskEvent(name: string, raw: unknown): AgentTaskEvent | null {
  switch (name) {
    case AGENT_TASK_EVENTS.SELF_HEAL: {
      const event = parseSelfHealEvent(raw)
      return event ? { name, event } : null
    }
    case AGENT_TASK_EVENTS.THINKING: {
      const event = parseThinkingEvent(raw)
      return event ? { name, event } : null
    }
    case AGENT_TASK_EVENTS.PLAN_STEP: {
      const event = parsePlanStepEvent(raw)
      return event ? { name, event } : null
    }
    case AGENT_TASK_EVENTS.SESSION_END: {
      const event = parseSessionEndEvent(raw)
      return event ? { name, event } : null
    }
    case AGENT_TASK_EVENTS.PERMISSION_MODE: {
      const event = parsePermissionModeEvent(raw)
      return event ? { name, event } : null
    }
    case AGENT_TASK_EVENTS.TERMINAL_DELTA: {
      const event = parseTerminalDeltaEvent(raw)
      return event ? { name, event } : null
    }
    case AGENT_TASK_EVENTS.AGENT_STATUS: {
      const event = parseAgentStatusEvent(raw)
      return event ? { name, event } : null
    }
    case AGENT_TASK_EVENTS.MESSAGE_SEND: {
      const event = parseMessageSendEvent(raw)
      return event ? { name, event } : null
    }
    case AGENT_TASK_EVENTS.TOOL_APPROVAL: {
      const event = parseToolApprovalEvent(raw)
      return event ? { name, event } : null
    }
    default:
      // G-816042:未识别事件名不得静默当成"这条流没有这个事件" —— 计数 + 首次报名,出口只有一份。
      // 刻意**只报契约外的名字**:契约内而本工厂不路由的 6 个(session / tool_call / tool_result /
      // message / error / compaction)是既定职责边界,由别的通道消费;把它们也报名就是每帧刷屏。
      if (!isAgentTaskEventName(name)) recordUnknownSseEventName(name)
      return null
  }
}

// ============================================================================
// b76-13 票1(2026-09-30 立):帧水位与纪元(logEpoch + (fromSeq,toSeq] + gap 判据)
// ============================================================================
//
// 机制(照上游 zcode controller/transport 的尺子改写到我方词汇):
//   · 每帧可携带 `(fromSeq, toSeq]` 区间与 `subscriptionId` 代际;snapshot 帧
//     fromSeq 恒 0,且信封纪元必须等于载荷纪元;
//   · 消费侧用一个纯函数判 gap = **换代 ∨ 纪元变 ∷ cursor.seq !== frame.fromSeq**
//     (三条件取或,`isFrameGap`);
//   · 只读结果另带 `atSeq/atLogEpoch` 做陈旧读防护,读端契约"epoch 不符 ⇒ 整结果丢弃"。
//
// 为什么必须有:Last-Event-ID 只回答"服务端接着哪儿发",不回答"客户端手上的状态
// 属于哪个纪元"。会话重建/fork/rewind 后裸 id 游标仍能对上而内容属于另一个纪元,
// 消费端会**静默拼接两个纪元的状态** —— 正是"快照说完成、增量还在跑"那一型。
//
// 本出口是消费侧唯一判据(纯函数,不做 I/O、不持状态);线格式键名同时收
// camelCase 与 snake_case(生产侧 apps/ai-service/app/core/sse_contract.py 的
// StreamWatermark/apply_frame 是出站判定的同一张判例表)。api-client 因零依赖
// 包边界(package.json 只声明 @ihui/types)不得 import 本出口,其读环内的
// 同形移植由 packages/api-client/tests/frame-watermark-parity-b76-13.test.ts
// 的判例表对账钉住(先例:error-serialize / stream-trace-id)。

/** 帧水位字段(线格式;snapshot 帧 fromSeq 恒 0)。 */
export interface FrameWatermark {
  /** 订阅代际;换代 ⇒ 旧代状态整体作废 */
  subscriptionId: string
  /** 日志纪元;纪元变 ⇒ 手上状态属于另一个纪元,整结果丢弃 */
  logEpoch: number
  /** 本帧覆盖区间的开(不含);连续性要求 cursor.seq === fromSeq */
  fromSeq: number
  /** 本帧覆盖区间的闭(含);apply 后 cursor.seq 推进到 toSeq */
  toSeq: number
}

/** 消费侧手上的水位游标(apply 成功后的状态归属证明)。 */
export interface FrameWatermarkCursor {
  subscriptionId: string
  logEpoch: number
  seq: number
}

/** gap 三条件(判到哪条报哪条;多条同犯时报第一条)。 */
export type FrameGapKind = 'generation-change' | 'epoch-change' | 'seq-discontinuity'

/** readFrameWatermark 的三态结论:**不得**把"未判定"伪装成 `{}` 或部分字段。 */
export type FrameWatermarkRead =
  | { verdict: 'ok'; watermark: FrameWatermark }
  /** 帧上根本没有(完整)水位字段 —— 生产端未下发/旧帧,消费方原样放行 */
  | { verdict: 'undetermined' }
  /** 判死:toSeq < fromSeq(区间倒挂)或非有限数,任何情况下不得应用 */
  | { verdict: 'invalid'; reason: string }

function isFiniteInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isSafeInteger(v)
}

function readWatermarkField(frame: Record<string, unknown>, camel: string, snake: string): unknown {
  const v = frame[camel]
  return v !== undefined ? v : frame[snake]
}

/**
 * 从一帧(已解析的 data JSON)读水位:四字段**全部**读得出且合法 ⇒ ok;
 * 任一缺席/类型不对 ⇒ undetermined(不猜、不补默认值);区间倒挂 ⇒ invalid(判死)。
 * 兼容 camelCase(`subscriptionId/logEpoch/fromSeq/toSeq`)与 snake_case
 * (`subscription_id/log_epoch/from_seq/to_seq`)两族线格式键。
 */
export function readFrameWatermark(frame: unknown): FrameWatermarkRead {
  if (frame === null || typeof frame !== 'object' || Array.isArray(frame)) {
    return { verdict: 'undetermined' }
  }
  const f = frame as Record<string, unknown>
  const subscriptionId = readWatermarkField(f, 'subscriptionId', 'subscription_id')
  const logEpoch = readWatermarkField(f, 'logEpoch', 'log_epoch')
  const fromSeq = readWatermarkField(f, 'fromSeq', 'from_seq')
  const toSeq = readWatermarkField(f, 'toSeq', 'to_seq')
  // 四字段必须**全部在场**:只有部分 ⇒ "未判定"(absence ≠ 合法零值,不得混同)
  if (
    typeof subscriptionId !== 'string' ||
    subscriptionId.length === 0 ||
    !isFiniteInt(logEpoch) ||
    !isFiniteInt(fromSeq) ||
    !isFiniteInt(toSeq)
  ) {
    return { verdict: 'undetermined' }
  }
  if (logEpoch < 0 || fromSeq < 0 || toSeq < 0) {
    return { verdict: 'invalid', reason: '水位字段出现负值,不是合法的 (fromSeq, toSeq] 区间' }
  }
  if (toSeq < fromSeq) {
    return { verdict: 'invalid', reason: '区间倒挂(toSeq < fromSeq),判死,任何情况下不得应用' }
  }
  return { verdict: 'ok', watermark: { subscriptionId, logEpoch, fromSeq, toSeq } }
}

/**
 * gap 判据(纯函数,三条件取或):换代 ∨ 纪元变 ∷ cursor.seq !== frame.fromSeq。
 * 返回命中的第一条;三条件全不中 ⇒ null(连续帧,可 apply 并推进到 toSeq)。
 */
export function isFrameGap(
  cursor: FrameWatermarkCursor,
  watermark: FrameWatermark,
): FrameGapKind | null {
  if (cursor.subscriptionId !== watermark.subscriptionId) return 'generation-change'
  if (cursor.logEpoch !== watermark.logEpoch) return 'epoch-change'
  if (cursor.seq !== watermark.fromSeq) return 'seq-discontinuity'
  return null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
