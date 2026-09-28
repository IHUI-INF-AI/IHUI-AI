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
  // 命令在等键盘输入(D151):mcp_server 观察到"输出静默 + 尾行像提示符"时发出。
  // 与 terminal_delta 的区别就一句话 —— 后者是"它在输出",前者是"它停住了、在等你敲一行"。
  // promptTail 是那句提示原文(已脱敏路径与凭据形态,但不保证不含敏感内容:它来自命令输出,
  // 所以渲染面**不得**把它写进本地持久化)。inputMode 目前恒 'line'(整行送回,含回车)。
  | SSEEventWithMeta<{
      type: 'terminal_interaction'
      terminalId: string
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
  | SSEEventWithMeta<{
      type: 'tool-approval'
      approval_id: string
      tool_name: string
      tool_call_id: string
      args_preview?: string
      danger_level: 'low' | 'medium' | 'high'
      session_id?: string
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
  | SSEEventWithMeta<{
      type: 'usage'
      messageId: string
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
      /** 未计费/定价缺失时为 null(前端成本段不渲染) */
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
