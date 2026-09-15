// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
 *  - apps/api 网关 extraFirstEvents 以顶层 key 判别:`{"repair":{...}}` / `{"compaction":{...}}` /
 *    `{"resumed":{...}}`(chat-resume.ts 用 `{"resume":{...}}`)。
 *  本契约以 `type` 判别联合为规范形态,网关侧顶层 key 编码为历史遗留,逐步统一。
 *
 * agentId 顶层注入:当流绑定到某 agent 时,网关在每条 data JSON 注入 `agentId` 顶层字段
 * (见 ai-chat-stream.ts streamToClient),前端据此分流到对应 subagent 卡片;缺失表示单 agent/无 agent。
 * 故 `agentId?: string` 出现在每个判别成员的元信息中,而非独立事件。
 */

/** SSE 事件名常量(单一事实源)。值即实际 wire 上的事件判别名。 */
export const SSE_EVENTS = {
  CHUNK: 'chunk',
  TOKEN: 'token',
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
  THINKING_DELTA: 'thinking_delta',
  DONE: 'done',
  ERROR: 'error',
  COMPACTION: 'compaction',
  REPAIR: 'repair',
  RESUMED: 'resumed',
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
  // 增量 token / 文本片段(chunk 与 token 为同一语义的两种命名)
  | SSEEventWithMeta<{ type: 'chunk'; content: string }>
  | SSEEventWithMeta<{ type: 'token'; content: string }>
  // 思维链增量
  | SSEEventWithMeta<{ type: 'reasoning'; content: string }>
  // 思考增量(部分模型/适配器)
  | SSEEventWithMeta<{ type: 'thinking_delta'; content?: string }>
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
  // 流结束(含 usage)
  | SSEEventWithMeta<{
      type: 'done'
      usage?: Record<string, unknown>
      model?: string
      stub?: boolean
    }>
  // 错误
  | SSEEventWithMeta<{
      type: 'error'
      message: string
      errorCode?: string
    }>
  // 上下文压缩通知(88% 阈值自动压缩)
  | SSEEventWithMeta<{
      type: 'compaction'
      triggered: boolean
      tokensBefore?: number
      tokensAfter?: number
      removedCount?: number
      usageRatio?: number
    }>
  // 消息修复通知(P38 跨端消息结构修复)
  | SSEEventWithMeta<{
      type: 'repair'
      removed: number
    }>
  // 续流/断点续传通知
  | SSEEventWithMeta<{
      type: 'resumed'
      // 待收紧:questionId / fromReplay 等续流上下文字段
      payload?: Record<string, unknown>
    }>

/** 事件名数组(去重,用于契约对账/测试)。 */
export const SSE_EVENT_NAMES: readonly SSEEventName[] = Object.values(SSE_EVENTS)

/** 判断字符串是否为已知 SSE 事件名(类型守卫)。 */
export function isSSEEventName(value: string): value is SSEEventName {
  return (SSE_EVENT_NAMES as readonly string[]).includes(value)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
