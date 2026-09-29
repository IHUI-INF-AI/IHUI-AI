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
export const TOOL_APPROVAL_DENIAL_REASONS = [
  'not_allowed',
  'not_allowed_local',
  'denied',
] as const

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
        /** 思考链用量;不支持该档的模型下发 null,老帧缺席按 null 处理 */
        reasoningTokens?: number | null
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
  // 文件写类工具的流中 diff 预览增量帧(D113 于 2026-09-27 立;2026-09-28 由 D132 补入联合)。
  // 字段清单同样以 `sse_contract.py` 的 `SSEEventContract("tool-delta", …)` 为准;
  // 消费方 `packages/api-client/src/client.ts` 的 `tryParseToolDelta` 与
  // `packages/shared/src/utils/sse-parse.ts` 都按这四个键取值。
  | SSEEventWithMeta<{
      type: 'tool-delta'
      /** 对应的 tool-call-start 的 toolCallId */
      toolCallId: string
      /** 同一 toolCallId 内的递增序号(乱序/重传由消费端按 seq 收敛) */
      seq: number
      /** 本次增量的正文(不是全量) */
      partialText: string
      /** 超长截断标记;缺席表示未截断 */
      truncated?: boolean
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
