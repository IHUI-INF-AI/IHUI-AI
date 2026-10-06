// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SSE 事件契约 —— 单一事实源(#25)
 *
 * 本文件集中定义 AI 对话流式(ai-service → apps/api 网关 → 前端)的全部 SSE 事件名
 * 与精确 payload 类型,替代此前散落在 llm.py / ai-chat-stream.ts 的隐式字符串字面量。
 *
 * 事件名在两端保持对齐:
 *  - TS 侧:`SSE_EVENTS`(as const)+ 判别联合 `SSEEventPayload`
 *  - Python 侧:`apps/ai-service/app/core/sse_contract.py` 的 `SSE_EVENTS`(frozenset)
 *  由 `scripts/check-agent-event-parity.mjs` 断言两侧集合完全一致。
 *
 * 已知编码差异(待后续收敛,不阻塞本次契约):
 *  - ai-service 以 `type` 字段判别事件:`{"type":"chunk","content":"..."}`
 *  - apps/api 网关 extraFirstEvents 以顶层 key 判别:`{"compaction":{...}}`
 *    (chat-resume.ts 用 `{"resume":{...}}`)。
 *  本契约以 `type` 判别联合为规范形态,网关侧顶层 key 编码为历史遗留,逐步统一。
 *
 * agentId 顶层注入:当流绑定到某 agent 时,网关在每条 data JSON 注入 `agentId` 顶层字段
 * (见 ai-chat-stream.ts streamToClient),前端据此分流到对应 subagent 卡片;缺失表示单 agent/无 agent。
 * 故 `agentId?: string` 出现在每个判别成员的元信息中,而非独立事件。
 */

import type { GoalStatus } from '@ihui/types'
// b76-13 票2:帧级字段 schema 用(本文件下方 SSE_FRAME_SCHEMAS;shared 的既有依赖)
import { z as zod } from 'zod'

/** SSE 事件名常量(单一事实源)。值即实际 wire 上的事件判别名。 */
export const SSE_EVENTS = {
  CHUNK: 'chunk',
  REASONING: 'reasoning',
  TOOL_CALL_START: 'tool-call-start',
  TOOL_RESULT: 'tool-result',
  TOOL_DELEGATE: 'tool-delegate',
  TOOL_SUMMARY: 'tool-summary',
  CITATIONS: 'citations',
  QUESTION: 'question',
  SUBAGENT_SPAWN: 'subagent_spawn',
  SUBAGENT_PROGRESS: 'subagent_progress',
  SUBAGENT_END: 'subagent_end',
  PLAN_STEP: 'plan-step',
  THINKING: 'thinking',
  PLAN_UPDATED: 'plan_updated',
  TERMINAL_START: 'terminal_start',
  TERMINAL_END: 'terminal_end',
  // V3 #48(2026-09-26)补登:终端命令逐行增量。生产在 mcp_server._emit_terminal_delta
  // (dict 形态 {"type": "terminal_delta"}),此前 parity 门只扫 _sse(...)/event: 形态漏网。
  TERMINAL_DELTA: 'terminal_delta',
  // D151(2026-09-29 立,用户批「默认开 + 单次等待 300s」):命令停在"等键盘输入"时的一帧。
  // 生产点 mcp_server._await_terminal_input(经 llm.py 注入的 push 通道直投,与
  // terminal_delta 同一承载面);载荷 {terminalId, promptTail, waitingSinceMs, inputMode,
  // maxInputChars, messageId?}。键入送回是**上行** POST
  // /llm/complete/stream/{session_id}/terminal-input(snake_case),同 form_response 族,
  // 不进本集合。必须与 apps/ai-service/app/core/sse_contract.py 同步。
  TERMINAL_INTERACTION: 'terminal_interaction',
  DONE: 'done',
  ERROR: 'error',
  FALLBACK: 'fallback',
  USAGE: 'usage',
  COMPACTION: 'compaction',
  STEER: 'steer',
  BUDGET: 'budget',
  // D34(2026-09-22 立,G-40/G-44):运行环境交代两帧。
  // 事件名是我方协议自定(snake_case,同 plan_updated/terminal_end 家族);
  // 实证部分只有**字段形状**(kind 八枚举 / collapsed + 可展开全文 / attempt+maxRetries+retryInMs+httpStatus)。
  // 上两批曾加的 settings_applied / terminal_output 已于第 36 轮收回(空契约与重复帧),
  // 理由见 sse_contract.py 的"收回记录"注释与 PROJECT_PLAN.md D34 段。
  INJECTION_APPLIED: 'injection_applied',
  RETRY_SCHEDULED: 'retry_scheduled',
  // V3 #48(2026-09-26)补登:agent 流执行开始(agents.py:1011,断点续跑带 resume_from)。
  START: 'start',
  // V3 #58(2026-09-26):主聊天流工具审批帧(llm.py 工具执行前拦截,决策回传
  // POST /llm/complete/stream/{session_id}/approval-response;payload 与 agent
  // 任务流 tool-approval 同形,前端 ToolApprovalDialog 同一弹窗消费)。
  TOOL_APPROVAL: 'tool-approval',
  // D113(2026-09-27,G-227):文件写类工具流中 diff 预览帧(llm.py 执行前纯参数推导,
  // 载荷 {toolCallId, seq, partialText, truncated?},tool-result 到达即清;不入库)。
  TOOL_DELTA: 'tool-delta',
  // V3 #63(2026-09-27 落地生产者,解阻前置三条已在 ai-service 面收口):对话流业务
  // 表单**下行**帧。此前它单列在下方 FORM_FRAME_EVENTS 一段里,理由只有一条 ——
  // 「契约 ⊆ 生产」(llm.py 零生产点 ⇒ 并进 SSE_EVENTS 会让
  // scripts/check-agent-event-parity.mjs 的对账 0b 恒红)。生产点已真在
  // llm.py 的工具循环里落下(request_business_form 拦截位),该理由随之消失,
  // 于是按本文件自己写在 FORM_FRAME_EVENTS 注释第③条(c) 的指令并回来。
  // **只并 REQUEST 这一条**:RESPONSE 是上行 POST 的 body,不是 SSE 事件
  // (上方第 3 条实测证据仍然成立),且 Python 侧 SSE_EVENTS 里也只有 form_request,
  // 并两条会让跨语言 parity 对账 0 直接红。
  FORM_REQUEST: 'form_request',
  // D152(2026-09-29 立,用户拍板「服务化但存会话元数据、不建新表」):会话目标状态的
  // 下行帧。**单帧带 status:'cleared'**(不建 goal_cleared 第二帧)。生产点
  // ai-service `POST /llm/sessions/{session_id}/goal`(写服务端主副本后推进该会话的
  // 活跃流)+ **流首**带出当前目标(新接入的端不必等下一次 set)。上行出口是 REST,
  // 不进本集合。必须与 apps/ai-service/app/core/sse_contract.py 同步。
  // 六档状态是**第三个域**,与 AGENT_TASK_STATUSES / WORKSPACE_AGENT_TASK_STATUSES
  // 不得并集(AGENTS §30 + 守门 check-agent-status-vocabulary-parity)。
  GOAL_UPDATED: 'goal_updated',
  // G-815976(2026-10-04 收口入契约):流式中断标记帧。生产点 llm_gateway.py 的
  // astream 异常中断分支 —— 已发出过 chunk 时不可中途换 provider,也不重试,
  // yield 本帧后流终止(**不会有 done**)。此前它只有生产者:客户端解析层对它
  // 静默返回 null ⇒ 半截回答与完整回答在端上完全同形("静默变短等于伪造完整性"
  // 同一条禁令)。消费:api-client `onPartialDone` → web send-message.ts 告知截断。
  // 必须与 apps/ai-service/app/core/sse_contract.py 同步。
  PARTIAL_DONE: 'partial_done',
} as const

/**
 * V3 #48(2026-09-26):Anthropic Messages API 兼容面事件,单列不入对话流契约。
 * 由 apps/ai-service llm.py 的 Anthropic 兼容端点产出(常量事实源:
 * agent_events.py:88-93 SSE_MESSAGE_START 等),wire 形态与 Anthropic 官方一致;
 * 不是对话流 UI 事件,混进 SSE_EVENTS 会让前端监听对账与文档失真。
 * 与 Python 侧 sse_contract.py 的 SSE_COMPAT_EVENTS 由 parity 门做双端一致断言。
 */
export const SSE_COMPAT_EVENTS = {
  MESSAGE_START: 'message_start',
  CONTENT_BLOCK_START: 'content_block_start',
  CONTENT_BLOCK_DELTA: 'content_block_delta',
  CONTENT_BLOCK_STOP: 'content_block_stop',
  MESSAGE_DELTA: 'message_delta',
  MESSAGE_STOP: 'message_stop',
} as const

/** 全部 SSE 事件名的联合类型。 */
export type SSEEventName = (typeof SSE_EVENTS)[keyof typeof SSE_EVENTS]

/** 每个事件的共享元信息(顶层注入字段)。 */
export interface SSEEventMeta {
  /** 网关在 agent 绑定的流上注入,用于前端 subagent 卡片分流(见 ai-chat-stream.ts)。 */
  agentId?: string
  /**
   * D174(2026-09-30 立):帧级 trace id —— 本轮请求的 W3C trace-id,**小写 32 hex**。
   *
   * 为什么帧里还要带一遍(响应头 `X-Trace-Id` 早已在,D147):头在整趟流式响应上只出现
   * 一次,而一条响应有几十到几千帧 ⇒ 拿头只能定位到"这一整轮",定位不到"这一帧"。
   *
   * 三条判据与生产侧逐字同形(`apps/ai-service/app/core/sse_contract.py` 的
   * `SSE_TRACE_ID_PAYLOAD_KEY` + `app/core/trace_context.py::sse_frame_trace_id`):
   *  ① 注入点是**唯一**的帧工厂 `llm.py::_sse()`,不在各 yield 站点各写一遍;
   *  ② 值必须是小写 32 hex,**全 0 是 W3C 非法值** ⇒ 不写;
   *  ③ 本轮没有有效 trace 时**整字段缺席** —— 不是空串、不是 null。"空串"与"没有"
   *     必须可分,所以消费侧一律按 `typeof === 'string'` 判,不得写 `?? ''`。
   *
   * ⚠️ **它是关联键,不是授权凭据**:值来自客户端可自写的 `traceparent` 头,任何归属/
   * 权限判定都不得读它(读了等于让调用方自报"我属于哪条链")。阳性对照:
   * `apps/ai-service/tests/test_sse_trace_frame_d174.py::test_foreign_trace_id_does_not_change_ownership`。
   */
  traceId?: string
}

/**
 * D174:帧级 traceId 的**线格式键名**(唯一真相源)。
 *
 * 生产侧的对应常量是 `apps/ai-service/app/core/sse_contract.py::SSE_TRACE_ID_PAYLOAD_KEY`,
 * 值同为 `'traceId'`(camelCase,与 messageId / terminalId 一族)。两份语言各有一份是
 * 跨语言的必然,但两侧测试喂的是**同一张判例表**(见 `normalizeSSEFrameTraceId` 注释)。
 */
export const SSE_TRACE_ID_PAYLOAD_KEY = 'traceId'

/**
 * D174:把一个候选值归一成**可以进帧/可以采信**的 trace id;不合格一律 `undefined`。
 *
 * 与 `apps/ai-service/app/core/trace_context.py::normalize_trace_id` 同规则:
 * 小写 32 hex、**全 0 非法**(W3C:all-zero trace-id 表示无效)、其余(短/长/非 hex/
 * 非字符串/空串)一律 `undefined`。判例表在两侧的测试里逐字同形:
 * `packages/shared/src/sse/__tests__/sse-frame-trace-id.test.ts` 与
 * `apps/ai-service/tests/test_sse_trace_frame_d174.py`。
 */
const TRACE_ID_RE = /^[0-9a-fA-F]{32}$/
const ALL_ZERO_TRACE_ID = '0'.repeat(32)

export function normalizeSSEFrameTraceId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const candidate = value.trim().toLowerCase()
  if (!TRACE_ID_RE.test(candidate)) return undefined
  if (candidate === ALL_ZERO_TRACE_ID) return undefined
  return candidate
}

/** 携带元信息的事件(判别联合成员的基础)。 */
export type SSEEventWithMeta<T extends Record<string, unknown>> = T & SSEEventMeta

// ---------------------------------------------------------------------------
// D159(2026-09-30 立,用户批"三档到底"):tool-approval 帧新增的**载荷字段类型**
//
// 住在这一层而不是 `@ihui/types` 的 `ToolApprovalRequest`:本票不新增帧,新字段是
// 既有 `tool-approval` 帧的载荷清单的一部分,与 `sse_contract.py::SSE_EVENT_CONTRACTS`
// 的 `("…", "exec_environment", "network_target", "blocked_network_targets")` 逐字同形
// (两份清单由 `scripts/check-agent-event-parity.mjs` 对账)。
//
// ⚠️ **字段在框架上 ≠ 已经到端**:wire → 弹窗中间还隔着两个解析面
// (`packages/api-client/src/client.ts::tryParseToolApproval` 与
// `packages/shared/src/sse/agent-events.ts::parseToolApprovalEvent`),两处都是
// **显式挑字段**的收窄写法,未列出的键会被整格丢掉。把这两处接上是本票的落地前置,
// 不在本票文件清单内 —— 在那之前,弹窗上的这一区块只会走"未上报"分支。
// ---------------------------------------------------------------------------

/**
 * 网络拒绝原因码 —— 与生产侧 `apps/ai-service/app/services/network_approval.py`
 * 的 `DENIAL_REASONS` 同集合(值表**只有一份语义**:后端产出的就是这三个词)。
 * 用 `as const` 数组派生联合,不用裸 `string` 兜底(AGENTS §3 类型零债)。
 */
export const TOOL_APPROVAL_DENIAL_REASONS = ['not_allowed', 'not_allowed_local', 'denied'] as const

export type ToolApprovalDenialReason = (typeof TOOL_APPROVAL_DENIAL_REASONS)[number]

/**
 * `tool-approval` 帧的执行环境字段(**线格式**)。
 *
 * 与生产侧逐字同形:`apps/ai-service/app/services/approval_persistence.py::
 * describe_exec_environment` 的 dict 键。**两层命名法刻意不同**:外层帧键跟着
 * tool-approval 帧的 snake_case 族(`exec_environment` / `network_target`),
 * 内层对象键是 camelCase(`inSandbox` / `networkIsolated` / `degradeNote`)——
 * 与票面 §11.3 第 1 栏声明的字段名逐字一致。**别"顺手统一"其中一层**:那会把
 * 生产侧与这份清单同时改歪,而两端仍然自洽、只有真机上不对(AGENTS §4 同型)。
 */
export type ToolApprovalExecEnvironmentWire = {
  /**
   * false = 服务端**读不到**这次的事实 ⇒ 界面必须写"未上报"。
   * 与"整个字段缺席"是两件事:缺席 = 回退开关 `IHUI_APPROVAL_ENV_REPORT=0`,
   * 界面**整块不渲染**。把两态合一态,就等于用一句通用文案冒充"读到了"。
   */
  available: boolean
  /** 仅 available=true 时出现 */
  inSandbox?: boolean
  /** 后端实际分派用的那一个值(local / docker / ssh / modal / daytona / singularity) */
  backend?: string
  /** 已知语义:local 不隔离网络、docker 是 `--network=none`;其余后端**不下发该字段**(不猜) */
  networkIsolated?: boolean
  /** ai-service 侧没有可读的降级链 ⇒ 生产侧恒不下发 true。渲染分支保留给真有该事实的一路 */
  degraded?: boolean
  degradeNote?: string
}

/** 本次要连的网络目标(**线格式**);`display` 恒 `host:port`,不显示归一键/哈希。 */
export type ToolApprovalNetworkTargetWire = {
  host: string
  port: number
  protocol: string
  display: string
  /** 仅被**静态策略**判死时出现;"还没有规则覆盖它"不算被拦(那是这条审批本身要问的事) */
  reason?: ToolApprovalDenialReason
}

/**
 * SSE 判别联合(精确 payload 类型)。
 * 待收紧字段用 `Record<string, unknown>` + 注释标注;禁用 `any`。
 */
export type SSEEventPayload =
  // 增量文本片段(V3 #48 收回 token:全仓零生产点,真正在用的是 chunk;两者曾是
  // "同一语义的两种命名"双写,现只保留 chunk)
  | SSEEventWithMeta<{ type: 'chunk'; content: string }>
  // 思维链增量
  | SSEEventWithMeta<{ type: 'reasoning'; content: string }>
  // 思考增量(部分模型/适配器)
  | SSEEventWithMeta<{ type: 'thinking'; content?: string }>
  // 工具调用开始
  | SSEEventWithMeta<{
      type: 'tool-call-start'
      toolCallId: string
      name: string
      args?: unknown
    }>
  // 工具执行结果
  | SSEEventWithMeta<{
      type: 'tool-result'
      toolCallId: string
      result: unknown
    }>
  // 工具委托执行(浏览器端 fs 工具代理,2026-08-02 立)
  | SSEEventWithMeta<{
      type: 'tool-delegate'
      // 待收紧:delegate 载荷字段未完全结构化
      payload: Record<string, unknown>
    }>
  // 工具调用汇总(一轮工具调用统计,2026-07-31 立)
  | SSEEventWithMeta<{
      type: 'tool-summary'
      // 待收紧:linesAdded/linesDeleted/callCount 等聚合字段
      summary: Record<string, unknown>
    }>
  // D34(2026-09-22):运行环境交代两帧(第三、四帧已收回,理由见 SSE_EVENTS 处注释)
  | SSEEventWithMeta<{
      type: 'injection_applied'
      /** 被注入/生效的上下文类别 —— **与后端一一对应**
       *  (apps/ai-service `app/routers/llm.py` 的 injection_frames 四处 +
       *  apps/web `components/ai/progress-sections/injection-bar.tsx` 的 INJECTION_KIND_KEYS)。
       *  kind 只当"取哪个本地化文案"的键用,界面措辞一律出自 5 语言词表,
       *  不渲染后端中文文本(collapsed 仅作未知 kind 的兜底)。
       *  历史值 agents_md / environments 已于第 42 轮拆分:二者曾共用 environments,
       *  前端无法区分"Repo Wiki 百科"与"自动检索上下文"。 */
      kind: 'developer_instructions' | 'workspace_memory' | 'repo_wiki' | 'auto_context'
      /** 折叠态一行摘要(界面默认显示;未知 kind 时的兜底文本) */
      collapsed: string
      /** 展开全文;后端在超出可携带上限时**整字段省略**,界面据此不给"展开"控件
       *  (不发截断文本冒充全文 —— 与 terminal_end 的 truncated 同一纪律的另一面) */
      fullText?: string
      /** auto_context 专用:检索并注入的代码上下文段数(措辞走 ICU plural) */
      count?: number
    }>
  | SSEEventWithMeta<{
      type: 'retry_scheduled'
      attempt: number
      maxRetries: number
      retryInMs: number
      httpStatus?: number
    }>
  // 引用溯源(#11,2026-09-13 立)
  | SSEEventWithMeta<{
      type: 'citations'
      citations: unknown
    }>
  // AI 主动提问
  | SSEEventWithMeta<{
      type: 'question'
      question: Record<string, unknown>
    }>
  // 子 agent 派发/进度/结束
  | SSEEventWithMeta<{
      type: 'subagent_spawn'
      payload: Record<string, unknown>
    }>
  | SSEEventWithMeta<{
      type: 'subagent_progress'
      payload: Record<string, unknown>
    }>
  | SSEEventWithMeta<{
      type: 'subagent_end'
      payload: Record<string, unknown>
    }>
  // 计划步骤(W1,2026-09-12 立)
  | SSEEventWithMeta<{
      type: 'plan-step'
      // 待收紧:plan[].status 等字段与 packages/types PlanUpdateEvent 对齐
      payload: Record<string, unknown>
    }>
  // 计划更新(对话流,与 plan-step 同源;字段与 llm.py L154-162 对齐)
  | SSEEventWithMeta<{
      type: 'plan_updated'
      plan: Array<{
        step: string
        status: string
        durationMs?: number
      }>
      explanation: string
      timestamp: string
      messageId?: string
    }>
  // 终端命令开始(对话流执行终端命令;与 llm.py L1951-1960 对齐)
  | SSEEventWithMeta<{
      type: 'terminal_start'
      terminalId: string
      command: string
      status: 'running'
      startedAt: string
      messageId?: string
    }>
  // 终端命令结束(与 packages/types/src/ai.ts TerminalEndEvent 对齐,字段名为 terminalId)
  | SSEEventWithMeta<{
      type: 'terminal_end'
      terminalId: string
      status: 'completed' | 'failed'
      endedAt: string
      durationMs: number
      output?: string
      /** 输出是否被截断(第 39 轮起后端真下发:仅在确实截断时为 true) */
      truncated?: boolean
      /** 截断前的原始字符数;未截断时等于 output 长度 */
      totalChars?: number
      /** D151(2026-09-29):本轮被用户代答过几次。**仅 >0 时下发** —— 零交互的旧帧形状一字不变。
       *  计数原本只活在 tool-result 的 dict 里(模型看得见、用户看不见),而"我刚才替它答过
       *  一次"是用户复盘这条命令时的第一个问题。 */
      interactionCount?: number
      /**
       * formattedOutput 已于第 39 轮删除:我方无生产点也无消费方(后端不做输出排版,
       * stdout/stderr 的结构化由 tool-result 帧分别承载),契约里不留空壳字段。
       */
      exitCode?: number
      messageId?: string
    }>
  // 终端命令逐行增量(V3 #48 补登:实时 stdout/stderr,terminal_start 与 terminal_end 之间)
  | SSEEventWithMeta<{
      type: 'terminal_delta'
      terminalId: string
      /** 输出流:stdout / stderr */
      stream: 'stdout' | 'stderr'
      text: string
    }>
  // 命令在等键盘输入(D151):mcp_server 观察到"输出静默 + 尾行像提示符"时发出。
  // 与 terminal_delta 的区别就一句话 —— 后者是"它在输出",前者是"它停住了、在等你敲一行"。
  // promptTail 是那句提示原文(已脱敏路径与凭据形态,但不保证不含敏感内容:它来自命令输出,
  // 所以渲染面**不得**把它写进本地持久化)。inputMode 目前恒 'line'(整行送回,含回车)。
  | SSEEventWithMeta<{
      type: 'terminal_interaction'
      terminalId: string
      /** 上行出口路径里带 {session_id}(POST /llm/complete/stream/{session_id}/terminal-input),
       *  所以帧必须自带它 —— 前端只知道自己那条流的上下文,不带就只能猜,而猜错的表现为
       *  "点了发送什么都没发生且不报错"。空串 = 服务端当轮没有会话 id(未鉴权开发态)。 */
      sessionId: string
      promptTail: string
      /** 从判定"在等人"到发帧的毫秒数(观察器每 0.5s 一轮,故这是量出来的值不是装饰) */
      waitingSinceMs: number
      inputMode: 'line'
      /** 单次键入长度封顶,与 mcp_server.TERMINAL_INTERACTION_MAX_INPUT_CHARS 同值 */
      maxInputChars: number
      messageId?: string
    }>
  // agent 流执行开始(V3 #48 补登:agents.py,断点续跑时 resume_from 指向续传位点)
  | SSEEventWithMeta<{
      type: 'start'
      task_id: string
      session_id?: string
      resume_from?: string
    }>
  // 主聊天流工具审批(V3 #58:llm.py 工具执行前拦截;前端 ToolApprovalDialog 消费,
  // decision 经 approval-response 端点回传;payload 与 agent 任务流 tool-approval 同形)
  //
  // D159(2026-09-30 立,用户批"三档到底")后三个字段是**可选新增**,不是新帧:
  // 审批载荷字段挂在既有 tool-approval 帧上(本票不新增 SSE 帧,事件名一个都没加)。
  // - `exec_environment`:逐请求的"这次在哪儿跑"。生产侧只有一份实现
  //   (`apps/ai-service/app/services/network_approval.py::approval_env_payload`)。
  //   **`available: false` 与"字段缺席"是两件事**:前者 = 服务端上报了但读不到事实
  //   (弹窗必须喊"未上报"),后者 = 回退开关 `IHUI_APPROVAL_ENV_REPORT=0` 整块不发
  //   (弹窗整块不渲染)。合成一个就是"把没判写成判过了"那一型。
  // - `network_target`:本次要连的目标;`display` 恒 `host:port`(票面:弹窗不显示哈希)。
  // - `blocked_network_targets`:已被**静态策略**判死的目标;"还没有规则"不算被拦。
  | SSEEventWithMeta<{
      type: 'tool-approval'
      approval_id: string
      tool_name: string
      tool_call_id: string
      args_preview?: string
      danger_level: 'low' | 'medium' | 'high'
      session_id?: string
      exec_environment?: ToolApprovalExecEnvironmentWire
      network_target?: ToolApprovalNetworkTargetWire
      blocked_network_targets?: ToolApprovalNetworkTargetWire[]
    }>
  // 对话流业务表单请求(V3 #63:llm.py 的 request_business_form 拦截位发出;
  // 前端 BusinessFormSection 消费,应答经 form-response 端点回传)。
  // ⚠️ **本帧字段是 camelCase**,与上方 tool-approval 的 snake_case 不同族 —— 不是笔误,
  // 而是解析层 packages/api-client/src/client.ts 的 tryParseFormRequest 读的就是
  // requestId / sessionId / messageId 三个 camel 键(写成 snake 会被**整帧静默丢弃**)。
  // 生产端必须与本类型 + 那个解析层同形;改任何一侧都要看另一侧(下行的 camel 与
  // 上行的 snake_case 是**两条不同通道**,别把它们统一掉)。
  //
  // 为什么这里不套 `SSEEventWithMeta<…>`:那个泛型的约束是 `T extends Record<string, unknown>`,
  // 而 **interface 没有隐式索引签名**(TS 的已知限制),把 `FormRequestFramePayload` 当类型参
  // 数喂进去会直接 TS2344。改成与 `SSEEventMeta` 直接求交 ⇒ 同一个 agentId? 定义、零复制,
  // 只绕开那条对本类型不成立的约束。
  | (FormRequestFramePayload & SSEEventMeta & { type: 'form_request' })
  // 会话目标状态更新(D152,2026-09-29 立):服务端主副本变了就发这一帧。
  // **单帧承载清除**:`status:'cleared'` 即"目标已清除"(拍板:不建 goal_cleared 第二帧)。
  // 生产点 ai-service `POST /llm/sessions/{session_id}/goal` 与**流首**(新端接入即见当前目标)。
  // ⚠️ `sessionId` 恒在:上行出口路径里带 {session_id},帧不给它前端只能猜,而猜错的表现是
  // "点了什么都没发生且不报错"(D151 的 terminal_interaction 同一课)。
  // `status` 的封闭集在 `@ihui/types` 的 `GOAL_STATUSES`(六档 + cleared 是**线格式**的
  // 第七个判别值,只代表"已清除",不落库为状态 —— 库里清除就是整键消失)。
  | SSEEventWithMeta<{
      type: 'goal_updated'
      /** 会话 id(= 上行出口路径里的 {session_id});空串 = 服务端当轮没有会话 id */
      sessionId: string
      status: GoalStatus | 'cleared'
      /** 目标原文;status==='cleared' 时缺省(清除后没有目标可带) */
      objective?: string
      /** 累计耗时(ms),GoalCard 的 D89 耗时条取它 */
      elapsedMs?: number
      /** 累计 token 用量(与 usage 帧同族口径,由服务端计量,不是本地估算) */
      tokenUsage?: number
      /** 服务端写入时刻(epoch 秒),多端据此判"谁的更新更新"(最后写入以库为准) */
      updatedAt?: number
    }>
  // 流结束(含 usage)
  | SSEEventWithMeta<{
      type: 'done'
      usage?: Record<string, unknown>
      model?: string
      stub?: boolean
      /** P1 #27(2026-09-16 立)记忆更新可视化:本轮新增写入长期记忆(LTM)的条目摘要。
       *  由 llm.py 在 done 前同步提炼(超时/异常降级为空数组),经网关原样透传到前端,
       *  MessageItem 据此渲染「已记住」提示条(MemoryNoticeBar)。空数组/缺省表示本轮无新记忆。 */
      memoryUpdates?: string[]
    }>
  // 错误
  | SSEEventWithMeta<{
      type: 'error'
      message: string
      errorCode?: string
    }>
  // 模型降级通知(P4-2,2026-09-19 入契约):主模型失败切换备用模型时,
  // llm_gateway 在 chunk 产出前 yield,llm.py 各 astream 循环转发
  // (字段与 client.ts FallbackEvent / llm_gateway.py 三处 yield 严格对齐)。
  | SSEEventWithMeta<{
      type: 'fallback'
      /** 失败的主模型 */
      primary_model: string
      /** 切换到的备用模型 */
      backup_model: string
      /** 切换原因(timeout/rate_limit/api_error/unknown) */
      reason: string
    }>
  // 上下文压缩通知(88% 阈值自动压缩)
  | SSEEventWithMeta<{
      type: 'compaction'
      triggered: boolean
      tokensBefore?: number
      tokensAfter?: number
      removedCount?: number
      usageRatio?: number
      /** G-150:压缩触发来源(llm / truncated / incompressible …)。
       *  incompressible = 已到上限仍压不下去,界面须给"开新对话/减少上下文"这类**动作**而非静默。 */
      trigger?: string
    }>
  // 中途引导注入确认(Steer,2026-09-19 立):
  // 流式对话期间用户经 steer 端点提交引导文本,tool loop 每轮 LLM 调用前
  // drain 注入 messages 时由 llm.py 发出;前端 MessageItem 据此换 badge 展示。
  | SSEEventWithMeta<{
      type: 'steer'
      /** 当前仅 "injected"(已注入 messages);预留扩展。 */
      phase: 'injected'
      /** 用户引导文本(注入 messages 的原文,≤4000 字符)。 */
      text: string
      /** 入队时间(ISO,来自 steer 端点)。 */
      timestamp?: string
      /** 所属 assistant 消息 ID(流启动即确定,便于前端挂 badge)。 */
      messageId?: string
    }>
  // 预算档位提醒(2026-09-19 立,网关发):流开始前网关按用户当日 AI 用量分档,
  // 80%~95% 发 level:warning、95%~100% 发 level:critical(均放行,流首命名帧,
  // 前端 toast 提示用量进度,不中断流);≥100% 为 HTTP 429 硬中断
  // (errorCode: BUDGET_EXHAUSTED,不走本事件)。
  | SSEEventWithMeta<{
      type: 'budget'
      /** 档位:warning(80%~95%)| critical(95%~100%) */
      level: 'warning' | 'critical'
      /** 当日已用占限额百分比(0~100) */
      percent?: number
      /** 当日已用 tokens */
      usedTokens?: number
      /** 当日限额 tokens */
      limitTokens?: number
      /** 用户预算档位名(如 VIP 等级名,可选) */
      tier?: string
      /** 限额重置时间(ISO,次日 0 点,可选) */
      resetAt?: string
    }>
  // 消息级计量帧(D1/D7 于 2026-09-19 立;2026-09-28 由 D132 补入判别联合)。
  // 字段清单的权威在 `apps/ai-service/app/core/sse_contract.py` 的
  // `SSEEventContract("usage", ("messageId","usage","timing","model","costUsd"))`,
  // 发射点是 `app/routers/llm.py` 流收尾处的 `_usage_frame`。本类型描述**命名帧**的
  // camelCase 线格式;`packages/api-client` 的 `onUsage` 另兼容旧 OpenAI 的 snake_case
  // 无名帧(那一路上 `messageId`/`timing` 为 null),不在此联合内重复建模。
  //
  // G-724(2026-09-29)线面真值更正 —— 契约此前比生产端乐观的两格:
  //  ① messageId —— 唯一发射路径落的是 `_resolve_message_id() -> str | None` 的返回值
  //     (llm.py `_usage_frame` 写 `"messageId": message_id`),**键恒写、值可空** ⇒ 类型是
  //     `string | null` 而不是可选键(写成 `messageId?:` 等于把"键在而值为 null"抹掉);
  //     消费端 `packages/api-client` 的 `UsageEvent.messageId` 早已按可空处理。
  //  ② costUsd —— 发射处(llm.py `_usage_frame`)写死 `None`,**这条流上恒为 null**;
  //     真实成本走 D33 的 usageDetail 持久化通道(经模型定价推算后落库供回放),不进本帧。
  //     **要读成本请调查询接口,不要从 usage 帧取**;补发射端下发真值属产品口径(另计一票)。
  | SSEEventWithMeta<{
      type: 'usage'
      /** 挂载到哪条 assistant 消息;生产端取不到时为 null(键仍然下发) */
      messageId: string | null
      usage: {
        promptTokens: number | null
        completionTokens: number | null
        totalTokens: number | null
        /**
         * 思考链用量。G-721(2026-10-01 立)—— 两态分工逐字写明,不许消费端各猜:
         *  · **显式 null** = 发射处(llm.py 流收尾的 `_usage_frame`)写了这个键、而上游 usage 里
         *    没有该档(`.get()` 取空)⇒ 报的是"这一轮没有推理用量可交代"(非推理模型 / provider 不报);
         *  · **缺席**(JSON 里没有这个键)⇒ 帧代际差:该字段是后加的,**旧帧与旧 OpenAI 无名帧不发它**,
         *    读作"未知",不是"清除"。
         *  两态在类型层是三值(`number | null | undefined`),**必须保持可分** —— api-client 的
         *  `UsageEvent.reasoningTokens` 同为可选,折叠只许发生在渲染位,不许发生在解析位。
         *  共同禁止项:折成 `0`(0 = "确实一个推理 token 都没花"的肯定结论)、或读成"把已累计的
         *  推理用量抹掉"(清除由消息级重建/回退语义承载,从来不靠这个键缺席表达)。
         *  ⚠️ 两态在真消费端**曾被各猜一次**(实测,归各自票,本票不改它们):
         *  `apps/web/src/hooks/use-chat/history-message.ts` 的 `nullable()` 把 undefined/null 同折 null
         *  (正确形态);`apps/web/src/hooks/use-chat/stream-handlers.ts` 的 `!== null ? Number(x) : null`
         *  只挡 null,缺席会算出 **NaN** 并被徽章直接渲染 —— 这就是本票立项要的"由消费端各猜"的后果样本。 */
        reasoningTokens?: number | null
        /**
         * prompt 缓存命中读 token。G-403(2026-10-07 入契约)—— 三态分工与 reasoningTokens
         * 同一条"两态绝不并桶"纪律,判据方向相反:
         *  · **数字(含 0)** = 上游 usage 里报了缓存档,0 就是"一次都没命中"这个结论本身
         *    (发射处 llm.py `_usage_frame` 经 usage_cache.has_cache_signals 判定后,由
         *    extract_cache_metrics 归一取数,OpenAI/Anthropic/DeepSeek 别名都认);
         *  · **显式 null** = 上游这条链路**没采到**缓存维(usage 里没有任何缓存别名键)
         *    ⇒ 报"未知",消费端呈现"—/不可得",绝不许折成 0(G-394 禁令);
         *  · **缺席** = 帧代际差:该字段 2026-10-07 前的帧与旧 OpenAI 无名帧不发它,读作"未知"。
         *  三值(`number | null | undefined`)必须保持可分 —— 折叠只许发生在渲染位,
         *  不许发生在解析位(api-client 的 `UsageEvent.cacheReadTokens` 同为可选)。 */
        cacheReadTokens?: number | null
        /** prompt 缓存**写入** token 数(Anthropic 系才有原生字段);三态同上, */
        cacheWriteTokens?: number | null
      }
      timing: {
        /** 首 token 耗时;流未产出首 token 时为 null */
        firstTokenMs: number | null
        durationMs: number
      }
      model: string | null
      /** 未计费/定价缺失时为 null(前端成本段不渲染)。
       *  G-724:发射处当前写死 `None` —— 本帧恒为 null,真成本走 usageDetail 持久化通道
       *  (要读成本请调查询接口,不要从 usage 帧取)。 */
      costUsd: number | null
    }>
  // 文件写类工具的流中 diff 预览帧(D113 于 2026-09-27 立;2026-09-28 由 D132 补入联合)。
  // 字段清单同样以 `sse_contract.py` 的 `SSEEventContract("tool-delta", …)` 为准;
  // 消费方 `packages/api-client/src/client.ts` 的 `tryParseToolDelta` 与
  // `packages/shared/src/utils/sse-parse.ts` 都按这四个键取值。
  //
  // 载荷语义 = **累积式整帧替换**(此前本段把方向写反过,说成"每帧只带新增的那一段",谁照它写
  // 消费端就把正文翻倍)。口径逐字取自生产端,不得凭本注释反推实现:
  // `apps/ai-service/app/routers/llm.py::_file_edit_preview_frames` 的 docstring 原文是
  // 「把预览文本切成 (partialText, truncated) 帧序列(累积式)」,其产帧语句取的是
  // `"\n".join(kept[: i + _PREVIEW_LINES_PER_FRAME])` —— 切片下标从 0 起,所以第 N 帧带的是
  // **从头到当前批次的整段正文**,后一帧必然以前一帧为前缀。该事实由跨语言台账
  // `apps/ai-service/tests/fixtures/file-edit-preview-cases.json` 逐帧核前缀,锁在
  // `packages/shared/src/sse/__tests__/contract.test.ts`(G-816035 组)。
  // 六个消费端一律按 toolCallId 把整帧**覆盖**进 `partialDiff`:web `stream-handlers.ts` 的
  // `createToolDeltaHandler`、extension `lib/tool-call-frames.ts::applyToolDelta`、小程序
  // `pkg-ai/ai/cards/types.ts`、RN `utils/chat-render-model.ts::applyToolDelta`、
  // `packages/api-client` 的 `tryParseToolDelta`、本包 `utils/sse-parse.ts`。
  //
  // **谁不得怎么做**:以上任何消费端都不得对 `partialText` 做 `+=` / `+` 拼接 / `.concat(` 累加,
  // 也不得"先读旧 `partialDiff` 再拼新帧"。覆盖式写入只在累积语义下安全;按增量实现时,每帧都
  // 含已显示过的那段 ⇒ 正文静默翻倍,且不报错、不红任何 typecheck(本仓"判据失效的表现永远是
  // 安静"那一族)。反向锁见上述测试文件第 ② 条。
  //
  // `seq` 当前**不参与**排序或收敛:上述消费端只按 toolCallId 覆盖、不读 seq 判新旧
  // (extension 头注原文即「`seq` 不参与判断」),因此同帧重放与乱序天然幂等。seq 的现职是
  // 可观测性(排查"这是第几帧"),不是判据;若将来改成按 seq 收敛,必须同步改掉本段与六个消费端,
  // 不得只改一处。
  //
  // 这一维目前没有任何跨语言判据看守:parity 门 `scripts/check-agent-event-parity.mjs` 只提
  // **事件名**,对本帧载荷语义零判据(该边界由上述测试第 ③ 条钉住 —— 它开始判这一维时那条必须红,
  // 届时请把本段这句"零判据"改掉,不要留着替坏状态背书)。
  | SSEEventWithMeta<{
      type: 'tool-delta'
      /** 对应的 tool-call-start 的 toolCallId */
      toolCallId: string
      /** 同一 toolCallId 内的递增序号;当前**不参与**排序/收敛(消费端只按 toolCallId 整帧覆盖) */
      seq: number
      /** 累积式正文:从本工具调用开头到当前批次的**整段**预览文本,消费端整帧替换、不得拼接 */
      partialText: string
      /** 超长截断标记;缺席表示未截断(生产端只在末帧置真) */
      truncated?: boolean
    }>
  // 流式中断标记帧(G-815976 收口入契约,2026-10-04)。字段与 llm_gateway.py 的
  // yield 字面量逐字对齐;reason 现值只有 'stream_interrupted',按封闭串建模。
  | SSEEventWithMeta<{
      type: 'partial_done'
      /** 恒 false:本帧只在"未走 fallback、已发过 chunk、不可撤回"那一格发出 */
      fallback_applied: boolean
      /** 中断原因,现值 'stream_interrupted' */
      reason: string
      /** 本轮实际使用的模型(可缺省) */
      model?: string
    }>

/** 事件名数组(去重,用于契约对账/测试)。 */
export const SSE_EVENT_NAMES: readonly SSEEventName[] = Object.values(SSE_EVENTS)

/** 判断字符串是否为已知 SSE 事件名(类型守卫)。 */
export function isSSEEventName(value: string): value is SSEEventName {
  return (SSE_EVENT_NAMES as readonly string[]).includes(value)
}

// ===========================================================================
// V3 #63(2026-09-27 立):对话流业务表单帧 —— form_request / form_response
// ===========================================================================
//
// **本段今天仍然单列,但只剩一条理由 —— 原有三条里有两条已被 2026-09-27 那一票消解:**
//
//  1. ~~**零生产点**~~(**已失效,2026-09-27 V3 #63 落地生产者**)。当时
//     `apps/api/src` 与 `apps/ai-service/app` 两侧对 `form_request` 全量 grep 均 0 命中,
//     而 `SSE_EVENTS` 的既有纪律是「契约 ⊆ 生产」(由
//     `scripts/check-agent-event-parity.mjs` 的 **对账 0b** 与 **对账 0** 双向看护),
//     塞一帧无人生产的名字进去就是 D34 第 36 轮收回 `settings_applied` / `terminal_output`、
//     V3 #48 收回 `token` 时清算的那一型(空心帧)。**现在生产点在
//     `app/routers/llm.py` 工具循环的 request_business_form 拦截位,该理由不再成立** ⇒
//     `REQUEST` 已按本文件当时自己写下的指令并入 `SSE_EVENTS`(见上方 FORM_REQUEST 成员)。
//  2. ~~**跨语言集合由机器强制,本票不含 ai-service**~~(**已失效**:落地那一票同时改
//     `sse_contract.py` 与本文件,两侧逐名等值,对账 0 不红)。
//  3. **仍然成立 —— 这是本段保留的唯一理由**:`form_response` 是**上行**帧(POST 到
//     `/llm/complete/stream/{sessionId}/form-response`),不是 SSE 下行事件。
//     把它列进 SSE_EVENTS 会让「前端监听对账」把一次 POST 当成 SSE 监听去要后端
//     SSE 生产点 —— 判据与语义互咬。所以 `RESPONSE` 留在本段,`REQUEST` 已并入。
//
// **这一段不是死声明**:它有真实消费方 ——
// `apps/web/src/hooks/use-chat/form-request-frame.ts`(线帧 → 端内渲染态的唯一投影)
// 与 `apps/web/src/hooks/use-chat/send-message.ts`(`streamChat` 的 `onFormRequest`)。
// 类型与 `@ihui/api-client` 的 `FormRequestEvent` 逐字段同形,并由
// `apps/web/src/components/chat/__tests__/form-request-contract.test.ts` 的**双向
// 可赋值断言**钉住(漂移即 tsc 红)。

/**
 * 对话流业务表单两帧的判别名(V3 #63 登记)。
 *
 * ① `form_request` = 下行帧:后端请在消息流内渲染一张业务表单(邮件撰写 / 日历
 *    创建·更新)时发出;解析通道已在 `@ihui/api-client`(`StreamChatOptions.onFormRequest`,
 *    畸形帧在该层即丢:缺 `requestId` 或 `actions` 不成对)。
 *    **值取自 `SSE_EVENTS.FORM_REQUEST`,本处不再写第二份字面量** —— 并入契约后
 *    两处各写一遍就是"同一事实两份真相",漂移的表现是 parity 门与消费方看到不同名。
 * ② `form_response` = 上行应答(用户批准/拒绝),不是 SSE 事件(见上方第 3 条)。
 * ③ **解阻前置三条已收口(2026-09-27)**,如实登记落地位置与仍然开着的那一格:
 *    (a) ✅ 工具执行点:`apps/ai-service/app/routers/llm.py` 主对话流 tool loop 内,
 *        与 tool-approval 同一拦截位(工具名 `request_business_form`,注册在
 *        `mcp_server._TOOLS`);
 *    (b) ✅ 接收端:`POST /llm/complete/stream/{session_id}/form-response`
 *        (同一文件,照 approval-response 的模板);
 *    (c) ✅ `sse_contract.py` 的 `SSE_EVENTS` 同步登记,并按本条原指令把
 *        `REQUEST` 并回 `SSE_EVENTS`。
 *    **仍然开着的一格**:预填值走不到端上 —— 下行帧的线格式里没有承载 `prefill` 的槽位
 *    (api-client 的解析层只保留 requestId/kind/fields/actions/sessionId/messageId,
 *    多余键整帧丢弃时不报错、也不透传),故工具入参的 `prefill` 只在**服务端**与用户
 *    提交的 values 合并后回灌给模型,表单卡上看不见预填。补齐要动
 *    `packages/api-client`(解析层 + `FormRequestFramePayload` 各加一个可选槽),
 *    不属本票射程(见交付报告"残余")。
 */
export const FORM_FRAME_EVENTS = {
  /** 下行:请前端在消息流内渲染一张业务表单(值即 SSE_EVENTS.FORM_REQUEST) */
  REQUEST: SSE_EVENTS.FORM_REQUEST,
  /** 上行:用户对那张表单的批准/拒绝应答(POST body,非 SSE 帧) */
  RESPONSE: 'form_response',
} as const

/** 业务表单帧的判别名联合。 */
export type FormFrameEventName = (typeof FORM_FRAME_EVENTS)[keyof typeof FORM_FRAME_EVENTS]

/**
 * form_request 的字段项形状。
 *
 * **字段表本身的唯一真相源是 `packages/shared/src/chat/business-forms.ts` 的
 * `BUSINESS_FORM_FIELDS`**(键集合 / 输入类型 / 必填位全在那一侧);本类型只是
 * **线格式**(后端可以下发"这次只填其中几项"),因此刻意宽松到 `string`:
 * 未知 `kind` / 未知 `type` 在端内投影处一律不渲染(不给一张填不了的表单),
 * 校验规则**不得**在本类型上再写一遍。
 */
export interface FormRequestFieldPayload {
  /** 字段键(同时是 values 的键与 i18n 键片段 `fields.<key>`) */
  key: string
  /** 输入类型,取值见判定层 FORM_FIELD_TYPES;未知值端内不渲染 */
  type: string
  required: boolean
  /** 占位文案键(留空则渲染层用 label 兼作占位) */
  placeholderKey?: string
}

/**
 * 下行 `form_request` 帧的**解析后事件**形状(V3 #63 登记)。
 *
 * 与 `@ihui/api-client` 的 `FormRequestEvent` **逐字段同形**(该类型未列进 index
 * 导出面,故本处是它唯一的可导入替身;两侧漂移由
 * `apps/web/src/components/chat/__tests__/form-request-contract.test.ts` 的
 * 双向可赋值断言在 tsc 层拦下)。
 *
 * ⚠️ 本类型**刻意不含 `type` 字段**:wire 上的 data JSON 确实带
 * `"type":"form_request"`,但那是解析层的判别依据(该层同时要求 `requestId`
 * 非空、`fields` 非空、`actions` 含 approve+reject,不满足即整帧丢弃),
 * 递给消费方的对象里没有它。写成必填会让解析层的产物不满足自己的契约 ——
 * 契约描述"到达端的东西",不是"线上那一行"。
 *
 * `kind` 的合法取值集在判定层 `BUSINESS_FORM_KINDS`,`actions` 恒为成对二元组
 * (`FORM_ACTION_PAIR`)。
 */
export interface FormRequestFramePayload {
  /** 应答锚点:提交 form_response 时原样带回 */
  requestId: string
  /** 上行回传通道会话 ID(与 tool-delegate 的 session_id 同族);缺省时端内不得自造 */
  sessionId?: string
  /** 表单种类,合法取值见 BUSINESS_FORM_KINDS */
  kind: string
  /** 字段集(形状权威在判定层,本处只是线格式;解析层保证非空) */
  fields: FormRequestFieldPayload[]
  /** 成对动作,恒含 'approve' 与 'reject'(解析层已判,缺一条整帧丢弃) */
  actions: string[]
  /** 挂载到哪条 assistant 消息;缺省时端内回退到本轮流消息 */
  messageId?: string
}

/**
 * 上行 `form_response` 的 **HTTP body 线格式**(V3 #63 登记)。
 *
 * `POST {ai-service}/llm/complete/stream/{session_id}/form-response`。
 * 字段名 snake_case,与同一条会话通道上的 `tool-result`(`tool_call_id`)同族 ——
 * **TS 侧的中间对象是 camelCase**(`@ihui/api-client` 的 `FormResponseEvent`,
 * 由 `buildFormResponseEvent()` 产出、`postFormResponse()` 在发出那一刻转成下面的
 * snake_case body)。本类型登记的是**跨语言那一面**,即后端接收端必须实现的形状;
 * 端内不得自拼 body,一律经上述唯一出口。
 *
 * 成对判据(由 `buildFormResponseEvent()` 强制):
 *  · `action='approve'` → 带 `values`,**不写** `reject_reason`;
 *  · `action='reject'`  → 带 `reject_reason`,**整字段省略 `values`**
 *    (拒绝零副作用:给空对象会诱导后端建一条空草稿/空日程);
 *  · 理由为空串时**省略该字段而非写空串**(空串 = 声称"用户说了个空原因")。
 */
export interface FormResponseWireBody {
  request_id: string
  kind: string
  action: 'approve' | 'reject'
  /** 仅 approve 携带 */
  values?: Record<string, string | readonly string[]>
  /** 仅 reject 携带;用户没填理由时整字段省略 */
  reject_reason?: string
  message_id?: string
}

// ===========================================================================
// D155(2026-09-29 立):下行告警族另外三档 —— config-warning / deprecation-notice /
// guardian-warning(独立声明段,**暂不入 SSE_EVENTS**,理由见下)
// ===========================================================================
//
// 额度告警档已由 `budget`(SSE_EVENTS.BUDGET)覆盖,本票不新建它。缺的是同族另外
// 三档,语义是我方自有口径(**不按竞品名反推界面长相**,竞品侧只证明了"存在这类
// 通知变体",显示文案零取证):
//   ① config-warning —— 生效配置有问题(如模型 base URL 被覆盖到非预期端点);
//   ② deprecation-notice —— 某能力/模型/端点即将弃用;
//   ③ guardian-warning —— 自动审查(guardian)发现风险。
//
// **为什么独立成段而不进 SSE_EVENTS**(两条硬判据,缺一不可):
//   a. 对账 0(scripts/check-agent-event-parity.mjs)要求 contract.ts 与
//      `apps/ai-service/app/core/sse_contract.py` 的 SSE_EVENTS **逐名等值**,而 PY 侧
//      文件在本票射程外(apps/ai-service 整树他人现场在飞,禁碰)——单侧加名即红;
//   b. 「契约 ⊆ 生产」纪律(D34 第 36 轮收回 settings_applied / terminal_output 的
//      同一判据):三档的**生产判定点**都在 ai-service 侧(base URL 覆盖判定在
//      provider/vendor 解析层、能力弃用判定在 provider 层、guardian 审查在 agent
//      loop),TS 侧(apps/api / web)现读零生产点可接。零生产的名字进 SSE_EVENTS
//      就是空心帧。
//  ⇒ 本段先落"契约声明 + 消费端通道"(api-client 解析 + web 落点,与 budget 帧同构),
//    生产端在 ai-service 现场释放时把三档名**同时并进两侧 SSE_EVENTS**(对账 0 会强制
//    两端同步),本段声明随之收编进主契约、此段降级为索引。
//
// wire 形态与 budget 命名帧同构:`event: <名>` + `data: {JSON}`,顶层 `type` 判别,
// 载荷 camelCase;severity 是三档共用的强度域(与 budget.level 同位但跨档同域),
// **消费端对未知 severity 值回退 'warning'**(不崩、不静默丢帧 —— D34/D40 教训:
// 至少 message/severity 要进落点,未知字段不得整帧丢弃)。
export const SSE_ALERT_EVENTS = {
  /** 配置告警:生效配置有问题(如 base URL 被覆盖到非预期端点) */
  CONFIG_WARNING: 'config-warning',
  /** 弃用预告:某能力/模型/端点即将下线(sunsetAt 之前仍可用) */
  DEPRECATION_NOTICE: 'deprecation-notice',
  /** 守护告警:自动审查(guardian)发现风险 */
  GUARDIAN_WARNING: 'guardian-warning',
} as const

/** 告警三档事件名联合。 */
export type SSEAlertEventName = (typeof SSE_ALERT_EVENTS)[keyof typeof SSE_ALERT_EVENTS]

/** 告警三档事件名数组(去重派生,用于契约对账/测试)。 */
export const SSE_ALERT_EVENT_NAMES: readonly SSEAlertEventName[] = Object.values(SSE_ALERT_EVENTS)

/** 判断字符串是否为已知告警档事件名(类型守卫)。 */
export function isSSEAlertEventName(value: string): value is SSEAlertEventName {
  return (SSE_ALERT_EVENT_NAMES as readonly string[]).includes(value)
}

/** 三档告警共用的强度域(封闭集合;解析端对表外值回退 warning,不整帧丢弃)。 */
export const SSE_ALERT_SEVERITIES = ['info', 'warning', 'critical'] as const

export type SSEAlertSeverity = (typeof SSE_ALERT_SEVERITIES)[number]

/**
 * severity 归一:表上三值原样放行,其余(缺省/空/未知串/非串)一律回退 'warning'。
 * "未知强度"是可上屏的事实(按 warning 提示),不是丢弃整帧的理由。
 */
export function normalizeSSEAlertSeverity(value: unknown): SSEAlertSeverity {
  return (SSE_ALERT_SEVERITIES as readonly unknown[]).includes(value)
    ? (value as SSEAlertSeverity)
    : 'warning'
}

/**
 * 告警三档的判别联合(独立于 `SSEEventPayload`:后者的成员与 SSE_EVENTS 逐名对齐,
 * 由 `packages/shared/src/sse/__tests__/contract.test.ts` 的穷尽性断言钉住;三档在
 * 并进 SSE_EVENTS 之前不进该联合,避免制造"联合里有、事件注册表里没有"的第二种漂移)。
 */
export type SSEAlertEventPayload =
  | SSEEventWithMeta<{
      type: 'config-warning'
      severity: SSEAlertSeverity
      /** 人可读的问题描述(生产端措辞;界面把它作为正文渲染,chrome 文案走 i18n) */
      message: string
      /** 出问题的配置项(如 'baseUrl' / 'apiKey' / 'model');缺省表示未定位到单项 */
      field?: string
      /** 关联的供应商标识(如 'deepseek');缺省表示全局配置问题 */
      provider?: string
      /** 当前生效值;**生产端判定值可能敏感(如含 key)时整字段省略**,端上不回显猜值 */
      effectiveValue?: string
    }>
  | SSEEventWithMeta<{
      type: 'deprecation-notice'
      severity: SSEAlertSeverity
      /** 人可读的弃用说明(哪些能力、影响什么) */
      message: string
      /** 即将弃用的能力标识(模型名/端点名/参数名) */
      capability?: string
      /** 建议的替代品(模型名/新端点);缺省表示暂无替代 */
      alternative?: string
      /** 彻底停用时间(ISO);在此之前能力仍可用 */
      sunsetAt?: string
    }>
  | SSEEventWithMeta<{
      type: 'guardian-warning'
      severity: SSEAlertSeverity
      /** 人可读的风险描述(发现了什么、建议怎么处理) */
      message: string
      /** 风险类别(值域由生产端定义,端上不做枚举校验、只原样透传) */
      category?: string
      /** 触发本次审查的审查器 id(便于对账 guardian-runner 日志) */
      reviewId?: string
    }>

// ===========================================================================
// b76-02(2026-09-30 立):失败 kind 决定「可重试」还是「必须换一条路」
// ===========================================================================
//
// 机制(照上游 zcode ssh-backend 的 uploadFailureKind 尺子改写到我方词汇):
// 上游把"这类失败下一步做什么"写成**字段级结论**而非文案猜测。我方现状里
// 判据来源只有 HTTP 码区间与 retry-after 头(client.ts 抽查 :527/:555-578/:627-634/
// :1485-1519),没有"哪类失败必须换通道/换端点"的字段级结论;UI 侧的重试按钮
// 也就只能按"有没有错误文案"猜。本段把这把尺子落成共享层唯一出口:
//
//  - `retry-same-path`:重发同一请求**可能得到不同结果**(限流窗口滑过、瞬时抖动恢复)
//    ⇒ 产出重试计划;UI 的重试按钮只在 canRetry===true(本档)时存在。
//  - `switch-path`:重发同路**必然同败**(凭据被拒、端点不可用)⇒ 换一条路
//    (换通道/换端点/重新登录),且**不得**自动重发同路。
//  - `terminal`:确定失败(契约不匹配/schema 过旧、调用方主动放弃)⇒ 重发与换路
//    都不会改变结果,UI **不渲染**重试入口(同上游"登录必需/已过期/schema 过旧
//    一律不给重试"的尺子)。
//
// 与既有两帧的关系:RETRY_SCHEDULED(:70)承载"立即重试"的**计划帧**、
// FALLBACK(:59)承载"换模型"的**降级帧** —— 它们是本判据在 wire 上的两个出口,
// 本段是它们共同的判据源,不是第三条平行通道。

/** 失败 kind 有限枚举(封闭集合;表外值不得自造,新增档位必须连处置一起改)。 */
export const SSE_FAILURE_KINDS = [
  /** 限流(通常带 retry-after):窗口滑过后重发可能成功 */
  'rate_limited',
  /** 瞬时故障(超时/网关 5xx/连接抖动):重发可能成功 */
  'transient',
  /** 凭据被拒(401/403):同路重发必然同败,必须换路(重新登录/换凭据) */
  'credentials_rejected',
  /** 端点/通道不可用(404/502/503/504):必须换一条路径,不是等一等能好的 */
  'endpoint_unavailable',
  /** 契约不匹配(schema 过旧/载荷形状对不上):确定失败,重发与换路都无效 */
  'contract_mismatch',
  /** 调用方主动放弃:不是失败,处置恒 terminal 且不得再动作 */
  'aborted',
] as const

export type SseFailureKind = (typeof SSE_FAILURE_KINDS)[number]

/** 失败处置的有限枚举(字段级结论,消费方据此分流,不再读文案猜)。 */
export const SSE_FAILURE_DISPOSITIONS = ['retry-same-path', 'switch-path', 'terminal'] as const

export type SseFailureDisposition = (typeof SSE_FAILURE_DISPOSITIONS)[number]

/** 失败判据的产出形状(消费方拿到的就是这份字段级结论)。 */
export interface SseFailureDispositionResult {
  failureKind: SseFailureKind
  disposition: SseFailureDisposition
  /**
   * 「重发同一请求可能得到不同结果」⇒ true。
   * UI 侧的重试按钮**只**在该值为 true 时渲染;false 时重试入口一律不给
   * (登录必需/已过期/schema 过旧等 switch-path/terminal 档均为 false)。
   */
  canRetry: boolean
  /** 仅 disposition==='retry-same-path' 时出现(与 retry_scheduled 帧字段同族) */
  retryPlan?: { attempt: number; maxRetries: number; retryInMs: number }
}

/** retry-same-path 档的最大重试次数(与 retry_scheduled 帧的 maxRetries 同口径)。 */
export const SSE_FAILURE_RETRY_MAX_ATTEMPTS = 3
/** retry-same-path 档无 retry-after 提示时的退避基数(ms)。 */
export const SSE_FAILURE_RETRY_BASE_MS = 1000

/**
 * 把一个失败 kind 解析成字段级处置结论(纯函数,唯一出口)。
 *
 * - rate_limited:retryAfterSeconds 有值按它定 retryInMs,无值按基数退避;
 * - switch-path / terminal 档**不产出 retryPlan**(写了就是允许自动重发同路);
 * - attempt 传入表示"已经重试到第几次",超出 maxRetries 后连可重试档也转 terminal
 *   (重试预算耗尽不是"再试一次"的理由,与 client.ts 既有 maxRetries 闸同口径)。
 */
export function resolveSseFailureDisposition(
  failureKind: SseFailureKind,
  options?: { retryAfterSeconds?: number; attempt?: number },
): SseFailureDispositionResult {
  const attempt = options?.attempt ?? 0
  if (failureKind === 'rate_limited' || failureKind === 'transient') {
    if (attempt >= SSE_FAILURE_RETRY_MAX_ATTEMPTS) {
      return { failureKind, disposition: 'terminal', canRetry: false }
    }
    const retryInMs =
      failureKind === 'rate_limited' && typeof options?.retryAfterSeconds === 'number'
        ? Math.max(0, options.retryAfterSeconds) * 1000
        : SSE_FAILURE_RETRY_BASE_MS * 2 ** attempt
    return {
      failureKind,
      disposition: 'retry-same-path',
      canRetry: true,
      retryPlan: { attempt, maxRetries: SSE_FAILURE_RETRY_MAX_ATTEMPTS, retryInMs },
    }
  }
  if (failureKind === 'credentials_rejected' || failureKind === 'endpoint_unavailable') {
    return { failureKind, disposition: 'switch-path', canRetry: false }
  }
  return { failureKind, disposition: 'terminal', canRetry: false }
}

/**
 * 把 HTTP 失败(HTTP status + 可选 errorCode)归到失败 kind(纯函数,唯一出口)。
 *
 * api-client 把 HttpError 转.ApiResult 时调用本函数取得 kind,再交
 * resolveSseFailureDisposition 得处置 —— 两步拆开是为了让"哪个码算哪类失败"
 * 与"这类失败下一步做什么"各自只有一个真相源。
 */
export function classifyHttpFailureKind(status: number, errorCode?: string): SseFailureKind {
  if (errorCode === 'SCHEMA_MISMATCH' || errorCode === 'CONTRACT_MISMATCH') {
    return 'contract_mismatch'
  }
  if (status === 401 || status === 403) return 'credentials_rejected'
  if (status === 429) return 'rate_limited'
  if (status === 404 || status === 502 || status === 503 || status === 504) {
    return 'endpoint_unavailable'
  }
  if (status >= 500) return 'transient'
  return 'contract_mismatch'
}

// ===========================================================================
// b76-13 票2(2026-09-30 立):帧的字段级 schema + 装饰载荷的降级隔离
// ===========================================================================
//
// 机制(照上游 zcode wire-assembler/transport 的尺子改写到我方词汇):
//   · 进/出帧过**字段级 schema**:`.strict()`(枚举闭合、未知字段不静默收)+
//     `superRefine`(**跨字段结构不变量**:必填对、跨字段等值);校验失败 ⇒
//     typed fault(SCHEMA_MISMATCH),不是丢弃或放行 —— 丢是静默的,放行是把
//     畸形当事实;
//   · **装饰性**载荷显式标成一档(`.optional().catch(undefined)`):展示数据坏了
//     只让那张卡退化成纯文本,**不决定 row/帧/订阅的生死**。
//
// 为什么需要:我方 SSE 消费面此前没有字段级 schema(agent-events 的 parseXxx
// 是"显式挑字段"收窄,畸形即整格丢),出站侧 tool-approval 载荷形状甚至只住在
// 注释里;而既有守门(check-agent-event-parity / check-sse-dispatch-parity)判的
// 全是**事件名集合**,字段级对错无人看守。
//
// 本段只登记**有跨字段不变量或枚举闭合可判**的帧(子集,逐票扩);表外事件名
// 在 parseSseFrameSchema 里判"不在射程",交由既有解析层,不冒充判过。
// 生产侧同表实现:apps/ai-service/app/core/sse_contract.py::sse_frame_schema_fault
// (两份清单由本段注释与两侧测试钉住,先例:D174 traceId 判例表)。

/** 装饰性字段登记(**点号路径** `frame.field`):坏了只降级展示,不杀帧。 */
export const SSE_DECORATIVE_FIELDS: readonly string[] = [
  'terminal_end.output',
  'terminal_end.totalChars',
  'injection_applied.collapsed',
  'injection_applied.fullText',
  'tool-approval.args_preview',
]

/** form_response 的成对判据(与 FormResponseWireBody 注释逐字同族):approve 带 values 无理由, reject 带理由无 values。 */
const formResponseSchema = zod
  .object({
    request_id: zod.string().min(1),
    kind: zod.string().min(1),
    action: zod.enum(['approve', 'reject']),
    values: zod.record(zod.string(), zod.unknown()).optional().catch(undefined),
    reject_reason: zod.string().optional().catch(undefined),
    message_id: zod.string().optional().catch(undefined),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.action === 'approve') {
      if (v.values === undefined) {
        ctx.addIssue({
          code: 'custom',
          message: 'action=approve 必须带 values(拒绝零副作用不适用)',
        })
      }
      if (v.reject_reason !== undefined) {
        ctx.addIssue({ code: 'custom', message: 'action=approve 不得带 reject_reason' })
      }
    } else {
      if (v.reject_reason === undefined) {
        ctx.addIssue({
          code: 'custom',
          message: 'action=reject 必须带 reject_reason(空理由则整字段省略是生产侧纪律)',
        })
      }
      if (v.values !== undefined) {
        ctx.addIssue({ code: 'custom', message: 'action=reject 不得带 values(拒绝零副作用)' })
      }
    }
  })

/** terminal_end:status 枚举闭合;truncated=true 而 totalChars 缺席 ⇒ "截断却不知道截掉多少"的假话帧。 */
const terminalEndSchema = zod
  .object({
    terminalId: zod.string().min(1),
    status: zod.enum(['completed', 'failed']),
    // 装饰档:output 坏了 ⇒ 整字段按缺省处理(卡片退化成纯文本),不杀帧
    output: zod.string().optional().catch(undefined),
    totalChars: zod.number().int().nonnegative().optional().catch(undefined),
    truncated: zod.boolean().optional(),
    exitCode: zod.number().int().optional().catch(undefined),
    durationMs: zod.number().nonnegative().optional(),
    endedAt: zod.string().optional(),
    interactionCount: zod.number().int().nonnegative().optional().catch(undefined),
    messageId: zod.string().optional().catch(undefined),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.truncated === true && v.totalChars === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'truncated=true 必须携带 totalChars(截断前的原始字符数)',
      })
    }
  })

/** retry_scheduled:三计数字段闭合(负 attempt/退避 ⇒ 假话帧)。 */
const retryScheduledSchema = zod
  .object({
    attempt: zod.number().int().nonnegative(),
    maxRetries: zod.number().int().nonnegative(),
    retryInMs: zod.number().nonnegative(),
    httpStatus: zod.number().int().optional().catch(undefined),
  })
  .strict()

/** tool-delta:toolCallId 必需;truncated 缺席表示未截断(结构不变量:不能 truncated 而无 seq)。 */
const toolDeltaSchema = zod
  .object({
    toolCallId: zod.string().min(1),
    seq: zod.number().int().nonnegative(),
    partialText: zod.string(),
    truncated: zod.boolean().optional(),
  })
  .strict()

/** form_request:动作必须成对(恒含 approve 与 reject),字段集非空。 */
const formRequestSchema = zod
  .object({
    requestId: zod.string().min(1),
    sessionId: zod.string().optional().catch(undefined),
    kind: zod.string().min(1),
    fields: zod
      .array(zod.object({ key: zod.string(), type: zod.string(), required: zod.boolean() }))
      .min(1),
    actions: zod.array(zod.string()),
    messageId: zod.string().optional().catch(undefined),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (!(v.actions.includes('approve') && v.actions.includes('reject'))) {
      ctx.addIssue({
        code: 'custom',
        message: 'actions 必须成对(恒含 approve 与 reject),缺一条整帧不可用',
      })
    }
  })

/** 帧名 → 字段级 schema(**唯一登记处**;新帧带跨字段不变量时同票在此登记)。 */
export const SSE_FRAME_SCHEMAS: Record<string, zod.ZodTypeAny> = {
  form_response: formResponseSchema,
  terminal_end: terminalEndSchema,
  retry_scheduled: retryScheduledSchema,
  'tool-delta': toolDeltaSchema,
  form_request: formRequestSchema,
}

/** 字段级校验失败的 typed fault(不是静默丢弃,也不是放行)。 */
export interface SseFrameSchemaFault {
  code: 'SCHEMA_MISMATCH'
  event: string
  issues: readonly string[]
}

export type SseFrameSchemaResult =
  { ok: true; data: unknown } | { ok: false; fault: SseFrameSchemaFault }

/**
 * 帧级字段校验唯一出口:登记表内的帧过 schema(strict + superRefine);
 * 表外事件名 ⇒ ok(不在本尺子射程,交由既有解析层,不冒充判过)。
 */
export function parseSseFrameSchema(event: string, payload: unknown): SseFrameSchemaResult {
  const schema = SSE_FRAME_SCHEMAS[event]
  if (!schema) return { ok: true, data: payload }
  const parsed = schema.safeParse(payload)
  if (parsed.success) return { ok: true, data: parsed.data }
  return {
    ok: false,
    fault: {
      code: 'SCHEMA_MISMATCH',
      event,
      issues: parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
    },
  }
}
// ⁠​‌​​
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
