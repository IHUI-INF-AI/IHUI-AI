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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
