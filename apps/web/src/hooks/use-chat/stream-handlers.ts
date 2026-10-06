// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useChatStore, type ToolCall } from '@/stores/chat'
import { useWorkPanelStore } from '@/stores/work-panel'
import { emitAgentHook } from '@/stores/agent-hooks'
import type { ToolDeltaEvent, ToolSummaryEvent, UsageEvent } from '@ihui/api-client'
import { PROVIDER_QUOTA_EXHAUSTED } from '@ihui/api-client'
import { BROWSER_TOOL_NAMES, extractToolUrl } from './tool-config'

/**
 * 厂商账号额度耗尽的人话覆盖(2026-09-22 批次 60 前端配套)。
 *
 * 为什么只认 errorCode:ai-service 的 status_map 未登记 PROVIDER_QUOTA_EXHAUSTED,
 * HTTP 仍回落默认 502 —— 按状态码分类会被误判成"AI 服务暂时不可用,请稍后重试",
 * 而该档下所有候选通道都已因欠费失败,重试必然再撞,文案会误导用户。
 *
 * 共享层 `formatSSEError` 已给出中文兜底 + `retryable: false`(供 extension/mobile-rn/cli/
 * miniapp-taro 等非 i18n 端直接使用);web 有 5 语言,故在端内按 errorCode 本地化覆盖,
 * 不复制第二套错误表。
 */
export function localizeQuotaExhausted(
  errorCode: string | undefined,
  t: (key: string) => string,
): { title: string; message: string } | null {
  if (errorCode !== PROVIDER_QUOTA_EXHAUSTED) return null
  return { title: t('quotaExhaustedTitle'), message: t('quotaExhaustedNotice') }
}

/** 回收"正在压缩上下文"预告态:仅清 compacting,done 态交给状态栏组件自行 3s 隐藏。
 *  2026-09-21 立:预告态在请求发起前点亮,原先只靠 onResponse 清除 —— 而响应头之前失败
 *  (HTTP 4xx/5xx 在 api-client 内 throw)、超时 abort、主动 stop、切换会话四条路径都不会
 *  走到 onResponse,残留状态挂在全局 AISidePanel 的状态栏上,用户走到哪个页面都看得到。 */
export function clearCompactionPreview(): void {
  const store = useChatStore.getState()
  if (store.compactionStatus?.phase === 'compacting') store.setCompactionStatus(null)
}

/** 工具耗时的结算形状(source 标记值从哪来,供对账与测试断言) */
export interface ResolvedToolDuration {
  durationMs: number
  source: 'server' | 'client'
}

/**
 * 工具耗时来源的唯一判点(D49②/G-61②,2026-09-24 立)。
 *
 * 修复前:只在 tool-call-start 记本地时钟、result 到达时相减 ⇒ 断线/刷新/回放
 * (只回放 result 帧)拿不到耗时。修复后两条分支:
 * ① 后端下发且合法(有限数且 ≥0,**0 是合法值** —— 去重跳过的工具耗时≈0)⇒ 用后端值;
 * ② 否则回退本地时钟(startedAt 在手才可回退);两者都没有 ⇒ null(不给卡片假耗时)。
 */
export function resolveToolDurationMs(input: {
  serverDurationMs?: number
  startedAt?: number
  now: number
}): ResolvedToolDuration | null {
  const server = input.serverDurationMs
  if (typeof server === 'number' && Number.isFinite(server) && server >= 0) {
    return { durationMs: server, source: 'server' }
  }
  if (input.startedAt !== undefined) {
    return { durationMs: Math.max(0, input.now - input.startedAt), source: 'client' }
  }
  return null
}

export function createToolCallHandler(assistantMessageId: string) {
  // 2026-09-01 立,工具调用过程流式可视化:SSE tool-result 事件不携带耗时字段,
  // 需在 tool-call-start 时记录本地起点,result 到达时计算 durationMs 补写,
  // 驱动 ToolCallCard 显示真实耗时(toolCallId 后端全局唯一,跨消息不冲突)。
  // D49②/G-61②(2026-09-24):后端 durationMs 优先,缺省才回退本地时钟 —— 判点
  // 收敛在 resolveToolDurationMs 单一函数(两条分支各有用例钉住)。
  const startTimes = new Map<string, number>()

  return (event: {
    type: 'tool-call-start' | 'tool-result'
    toolCallId: string
    toolName: string
    args?: Record<string, unknown>
    result?: unknown
    isError?: boolean
    iteration?: number
    repeated?: boolean
    // 2026-07-31 立,AI 对话可视化:工具来源标识(从 SSE 透传到 ToolCallCard 徽章)
    serverSource?: 'builtin' | 'plugin' | 'mcp'
    serverId?: string
    serverName?: string
    // 2026-09-09 媒体产物顶层扁平化透传:tool-result 事件携带时写入 tc,
    // 驱动 ToolCallCard 渲染媒体产物 / 长任务"进行中"状态
    image_url?: string
    audio_url?: string
    video_url?: string
    task_id?: string
    // L5-8 工具瞬时失败自动重试次数(后端 tool-call-start/result 透传;未下发则 undefined)
    retryCount?: number
    // D49②:后端实测耗时(去重跳过≈0 是合法值;断线/回放场景下它是唯一来源)
    durationMs?: number
  }) => {
    if (event.type === 'tool-call-start') {
      // W28 Hooks 事件:tool.before(工具开始调用)
      emitAgentHook('tool.before', { toolName: event.toolName })
      startTimes.set(event.toolCallId, Date.now())
      useChatStore.getState().addToolCall(assistantMessageId, {
        id: event.toolCallId,
        toolName: event.toolName,
        args: event.args ?? {},
        status: 'running',
        iteration: event.iteration,
        serverSource: event.serverSource,
        serverId: event.serverId,
        serverName: event.serverName,
      })
      // browser_navigate 类工具:args 含 url 时立即打开 WorkPanel(无需等 result)
      if (BROWSER_TOOL_NAMES.has(event.toolName) && event.args) {
        const url = extractToolUrl(event.args)
        if (url) {
          useWorkPanelStore.getState().openPanel({ url, source: 'ai-tool' })
        }
      }
    } else {
      // tool-result
      // W28 Hooks 事件:tool.after(工具返回结果,summary 标注成败)
      emitAgentHook('tool.after', {
        toolName: event.toolName,
        summary: event.isError ? 'failed' : 'success',
      })
      const updates: Partial<ToolCall> = {
        status: event.isError ? 'error' : 'success',
        result: event.result,
        serverSource: event.serverSource,
        serverId: event.serverId,
        serverName: event.serverName,
      }
      // 计算耗时(D49②/G-61②):后端值优先,非法值(负数/NaN)按未下发回退本地时钟;
      // 起点即释 —— 本帧结算后即删,同 id 的后续帧不得再回退到旧起点写第二次耗时。
      const resolved = resolveToolDurationMs({
        serverDurationMs: event.durationMs,
        startedAt: startTimes.get(event.toolCallId),
        now: Date.now(),
      })
      if (resolved !== null) {
        updates.durationMs = resolved.durationMs
      }
      startTimes.delete(event.toolCallId)
      if (event.args) updates.args = event.args
      if (event.iteration !== undefined) updates.iteration = event.iteration
      // 后端 repeated: true 标记(同 tool_name + 同 args 已执行过,跳过实际调用)
      if (event.repeated === true) updates.repeated = true
      // 2026-09-09 媒体产物顶层扁平化:写入 tc,驱动媒体渲染与长任务"进行中"状态
      if (event.image_url !== undefined) updates.image_url = event.image_url
      if (event.audio_url !== undefined) updates.audio_url = event.audio_url
      if (event.video_url !== undefined) updates.video_url = event.video_url
      if (event.task_id !== undefined) updates.task_id = event.task_id
      // L5-8 重试次数透传(后端下发时写入,ToolCallCard 渲染"重试N次"徽章)
      if (event.retryCount !== undefined) updates.retryCount = event.retryCount
      // D113:tool-result 到达即清流中预览(最终 diff 以 result 的 diffInfo 为准)
      updates.partialDiff = undefined
      useChatStore.getState().updateToolCall(assistantMessageId, event.toolCallId, updates)

      // tool-result 含 URL:延迟打开(仅当之前 args 没 url 时,result 含 url 的场景)
      if (!BROWSER_TOOL_NAMES.has(event.toolName)) return
      const url = extractToolUrl(event.args, event.result)
      if (url) {
        useWorkPanelStore.getState().openPanel({ url, source: 'ai-tool' })
      }
    }
  }
}

/**
 * D113 onToolDelta 工厂(2026-09-27 立,G-227):文件写类工具流中 diff 预览。
 * 载荷 partialText 为累积文本,直接覆盖写入 tc.partialDiff(同 seq 重放天然幂等);
 * 仅 running 态渲染,tool-result 处理器负责清除。 */
export function createToolDeltaHandler(assistantMessageId: string) {
  return (event: ToolDeltaEvent) => {
    if (!event.toolCallId) return
    useChatStore.getState().updateToolCall(assistantMessageId, event.toolCallId, {
      partialDiff: event.partialText,
    })
  }
}

/**
 * onToolSummary 工厂(2026-07-31 立,AI 对话可视化深度接入):
 * 绑定 assistantMessageId,把 SSE tool-summary 事件聚合结果写入 message.toolCallSummary,
 * 让 ToolCallSummary 组件在 AI 回复末尾展示"搜索文件 N 个/网页 N 个/改了 N 个文件/N 行代码"。
 */
export function createToolSummaryHandler(assistantMessageId: string) {
  return (summary: ToolSummaryEvent) => {
    useChatStore.getState().setMessageToolSummary(assistantMessageId, summary)
  }
}

/** D1 消息级计量(2026-09-19 立):onUsage 回调载荷 = api-client 的 UsageEvent(扁平契约)。
 * 与 packages/api-client/src/client.ts 的 tryParseUsage 对齐:
 *   { promptTokens, completionTokens, totalTokens, reasoningTokens?, messageId?,
 *     timing?:{ firstTokenMs,durationMs }|null, model?, costUsd? }
 * 旧 OpenAI 协议 usage chunk 路径 messageId/timing/model/costUsd 为 null(徽章相应分段不渲染)。 */
export type MessageUsagePayload = UsageEvent

/**
 * D1 消息级计量(2026-09-19 立):onUsage 消费工厂。
 * 绑定 assistantMessageId,把 usage 帧写入 store.usageByMessageId(驱动消息底部徽章行)。
 * - messageId 为空(旧 OpenAI 协议 usage chunk 不带 messageId)→ 回退到当前流式消息 id
 * - timing / costUsd 缺失(null)→ 存 0 / null,徽章对应分段条件性不渲染
 * 旧 meta.usage 写入(updateMessageMeta)由 send-message.ts 保留,本工厂只负责新索引。 */
export function createUsageHandler(assistantMessageId: string) {
  return (payload: MessageUsagePayload) => {
    const messageId = payload.messageId || assistantMessageId
    useChatStore.getState().setMessageUsage(messageId, {
      totalTokens: Number(payload.totalTokens) || 0,
      promptTokens: Number(payload.promptTokens) || 0,
      completionTokens: Number(payload.completionTokens) || 0,
      reasoningTokens: payload.reasoningTokens !== null ? Number(payload.reasoningTokens) : null,
      // G-403(2026-10-07):缓存读/写两维透传落盘 —— `?? null` 把"缺席(旧帧代际差)"
      // 与"显式 null(上游没采到)"都归 null = 未知;数字(含 0=真没命中)原样保留。
      // 绝不在此造 0(把"没量到"渲染成 0 是 G-394 禁令);渲染位由
      // context-usage-ring 经共享引擎把 null 折成"不可得"。
      cacheReadTokens: payload.cacheReadTokens ?? null,
      cacheWriteTokens: payload.cacheWriteTokens ?? null,
      firstTokenMs: Number(payload.timing?.firstTokenMs) || 0,
      durationMs: Number(payload.timing?.durationMs) || 0,
      model: payload.model ?? '',
      costUsd: payload.costUsd !== null ? Number(payload.costUsd) : null,
    })
  }
}

/**
 * #9 流式 token 节流(2026-07-25 立):
 * 用 requestAnimationFrame 每帧合并一次 token,避免每个 token 触发 store 更新 + React 重渲染。
 * - batch(delta):累加 delta,标记 dirty,下帧 flush
 * - flush():立即把累积 delta 一次性 append(用于错误/中止前最后冲刺)
 * - cancel():取消 raf,清空累积(用于 finally)
 */
export function createDeltaBatcher(appendFn: (delta: string) => void) {
  let pending = ''
  let rafId: number | null = null
  const flush = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    if (pending) {
      const d = pending
      pending = ''
      appendFn(d)
    }
  }
  const batch = (delta: string) => {
    pending += delta
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        rafId = null
        if (pending) {
          const d = pending
          pending = ''
          appendFn(d)
        }
      })
    }
  }
  const cancel = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    pending = ''
  }
  return { batch, flush, cancel }
}

/**
 * #9 多 agent stream 节流(2026-07-25 立):
 * 单一 manager 管理多个 agentId 各自的 batcher,flushAll/cancelAll 统一清理。
 */
export function createAgentDeltaBatcher() {
  const map = new Map<string, ReturnType<typeof createDeltaBatcher>>()
  const batch = (agentId: string, delta: string) => {
    let b = map.get(agentId)
    if (!b) {
      b = createDeltaBatcher((d) => useChatStore.getState().appendToAgentStream(agentId, d))
      map.set(agentId, b)
    }
    b.batch(delta)
  }
  const flushAll = () => {
    for (const b of map.values()) b.flush()
  }
  const cancelAll = () => {
    for (const b of map.values()) b.cancel()
    map.clear()
  }
  return { batch, flushAll, cancelAll }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
