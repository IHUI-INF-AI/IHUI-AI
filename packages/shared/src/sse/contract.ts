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
}

/** 携带元信息的事件(判别联合成员的基础)。 */
export type SSEEventWithMeta<T extends Record<string, unknown>> = T & SSEEventMeta

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
  // agent 流执行开始(V3 #48 补登:agents.py,断点续跑时 resume_from 指向续传位点)
  | SSEEventWithMeta<{
      type: 'start'
      task_id: string
      session_id?: string
      resume_from?: string
    }>
  // 主聊天流工具审批(V3 #58:llm.py 工具执行前拦截;前端 ToolApprovalDialog 消费,
  // decision 经 approval-response 端点回传;payload 与 agent 任务流 tool-approval 同形)
  | SSEEventWithMeta<{
      type: 'tool-approval'
      approval_id: string
      tool_name: string
      tool_call_id: string
      args_preview?: string
      danger_level: 'low' | 'medium' | 'high'
      session_id?: string
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
// **为什么它是独立一段,而不是 SSE_EVENTS 的第 29 个成员 —— 三条实测证据:**
//
//  1. **零生产点**:wire 上的 `form_request` 在后端两侧全量 grep 均为 0 命中
//     (`apps/api/src` 与 `apps/ai-service/app`)。`SSE_EVENTS` 的既有纪律是
//     「契约 ⊆ 生产」由 `scripts/check-agent-event-parity.mjs` 的 **对账 0b**
//     (llm.py 生产事件 ⊆ 契约)与 **对账 0**(两端集合一致)双向看护 ——
//     把一帧无人生产的名字塞进去,就是把「已生效契约」与「目标形态」重新混回一处,
//     正是 D34 第 36 轮收回 `settings_applied` / `terminal_output`、V3 #48 收回
//     `token` 时清算的那一型(空心帧)。
//  2. **跨语言集合由机器强制**:`SSE_EVENTS` 与 `apps/ai-service/app/core/sse_contract.py`
//     的 `SSE_EVENTS` frozenset 必须逐名等值(对账 0,**blocking**)。本票写面不含
//     ai-service,单侧加名 = 把一道与任何提交都无关的恒红门装进提交链(§12e 同型)。
//     ⇒ **解阻前置**见下方 `FORM_FRAME_EVENTS` 注释第③条。
//  3. **方向不同**:同一段里的 `form_response` 是**上行**帧(POST 到
//     `/llm/complete/stream/{sessionId}/form-response`),不是 SSE 下行事件。
//     把它列进 SSE_EVENTS 会让「前端监听对账」把一次 POST 当成 SSE 监听去要后端
//     SSE 生产点 —— 判据与语义互咬。
//
// **这一段是不是死声明?不是**:它有真实消费方 ——
// `apps/web/src/hooks/use-chat/form-request-frame.ts`(线帧 → 端内渲染态的唯一投影)
// 与 `apps/web/src/hooks/use-chat/send-message.ts`(`streamChat` 的 `onFormRequest`)。
// 类型与 `@ihui/api-client` 的 `FormRequestEvent` 逐字段同形,并由
// `apps/web/src/components/chat/__tests__/form-request-contract.test.ts` 的**双向
// 可赋值断言**钉住(漂移即 tsc 红)—— 那是本段唯一能自动化执行的看护。
// **不得**为让这段"看起来有牙"把它并进 SSE_EVENTS:那只会让 parity 门恒红。

/**
 * 对话流业务表单两帧的判别名(V3 #63 登记)。
 *
 * ① `form_request` = 下行帧:后端请在消息流内渲染一张业务表单(邮件撰写 / 日历
 *    创建·更新)时发出;解析通道已在 `@ihui/api-client`(`StreamChatOptions.onFormRequest`,
 *    畸形帧在该层即丢:缺 `requestId` 或 `actions` 不成对)。
 * ② `form_response` = 上行应答(用户批准/拒绝),不是 SSE 事件(见上方第 3 条)。
 * ③ **生产侧待补(解阻前置,三条缺一不可,全在 ai-service 面)**:
 *    (a) 一个会请求用户填写业务表单的工具执行点(llm.py tool loop 内,与
 *        tool-delegate / tool-approval 同一拦截位)—— 决定"谁在什么条件下发这帧";
 *    (b) `apps/ai-service/app/api|router` 侧 `form-response` 接收端(现全仓 0 处),
 *        否则用户按「批准」后应答无处落地 —— 端内已按"发不出去就如实置 failed"实现,
 *        不会假装已提交;
 *    (c) `sse_contract.py` 的 `SSE_EVENTS` 同步登记 —— 与 (a) 同批落地,
 *        之后本段成员并入 `SSE_EVENTS` 并由 parity 门接管。
 */
export const FORM_FRAME_EVENTS = {
  /** 下行:请前端在消息流内渲染一张业务表单 */
  REQUEST: 'form_request',
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
