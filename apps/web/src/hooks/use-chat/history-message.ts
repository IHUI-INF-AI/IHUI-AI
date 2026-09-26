// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台特有:web 端会话历史水合(依赖 web chat store 的 ChatMessage 形状),
// 各端 store 结构不同,不适合下沉共享层。
import type { PlanStep } from '@ihui/types'
// 权限档读侧归一(G-161/G-165):历史行拼写可能是 kebab/camel/别名
import { permissionModeWire } from '@ihui/types/permission-mode'
// D33 过程性信息读回(2026-09-23):fallback 交代与 SSE 帧同一类型;memory/usage seed 走真 store
import {
  useChatStore,
  type ChatMessage,
  type MessageUsage,
  type SideQueueItem,
  type SteerNotice,
} from '@/stores/chat'

/**
 * 后端 chat_messages 行的水合输入(结构最小集)。
 *
 * 与 @ihui/api-client 的 ConversationMessage 结构兼容(metadata 带索引签名,
 * 可直接把 getMessages 返回的行传进来),便于单测构造 fixture。
 */
export interface HistoryMessageRecord {
  id: string
  role: ChatMessage['role']
  content: string
  reasoning?: string
  createdAt: string
  metadata?: Record<string, unknown> | null
}

/**
 * 从 metadata.planSteps 还原权威计划快照。
 *
 * 向后兼容:老消息(2026-09-21 之前落库)没有该 key → 返回 undefined,
 * 消息不挂 planSteps,任务状态条与 PlanStepsCard 安静缺席(不渲染空态垃圾)。
 * 结构校验:DB 可能被其他端/历史链路写入非法形状,逐条守卫后才采信,
 * 避免脏数据把 PlanStepsCard 渲染成 undefined 文字。
 */
function readPlanStepsFromMetadata(raw: unknown): PlanStep[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const steps = raw.filter(
    (item): item is PlanStep =>
      !!item &&
      typeof item === 'object' &&
      typeof (item as { id?: unknown }).id === 'string' &&
      typeof (item as { step?: unknown }).step === 'string' &&
      typeof (item as { status?: unknown }).status === 'string',
  )
  return steps.length > 0 ? steps : undefined
}

/**
 * 从 metadata.citations 还原引用溯源(G-166,2026-09-22 立)。
 *
 * 老消息 / 本轮无引用 → undefined:不挂字段,不给 CitationBar 造空态。
 * 逐条守卫后只带确实存在的 url —— 脏数据里 url 缺失时不能渲染成点不动的"假链接"。
 */
function readCitationsFromMetadata(raw: unknown): ChatMessage['citations'] {
  if (!Array.isArray(raw)) return undefined
  const out = raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const rec = item as Record<string, unknown>
    if (typeof rec.source !== 'string' || typeof rec.label !== 'string') return []
    return [
      {
        source: rec.source,
        label: rec.label,
        ...(typeof rec.url === 'string' && rec.url ? { url: rec.url } : {}),
      },
    ]
  })
  return out.length > 0 ? out : undefined
}

/**
 * 从 metadata.injections 还原"本轮带了哪些上下文"的交代(G-166)。
 * kind 是前端取词键,缺失即整条丢弃(渲染不出可辨认的一行就别出现)。
 */
function readInjectionsFromMetadata(raw: unknown): ChatMessage['injections'] {
  if (!Array.isArray(raw)) return undefined
  const out = raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const rec = item as Record<string, unknown>
    if (typeof rec.kind !== 'string' || typeof rec.collapsed !== 'string') return []
    return [
      {
        kind: rec.kind,
        collapsed: rec.collapsed,
        ...(typeof rec.fullText === 'string' ? { fullText: rec.fullText } : {}),
        ...(typeof rec.count === 'number' ? { count: rec.count } : {}),
      },
    ]
  })
  return out.length > 0 ? out : undefined
}

/**
 * 从 metadata.compaction 还原"这条回答生成前压缩了多少上下文"(G-166 第②步)。
 *
 * 字段名换算:落库/SSE 用 tokensBefore / tokensAfter(契约侧命名),
 * store 的 MessageCompaction 用 originalTokens / compressedTokens —— 逐字段显式映射,
 * 不做"两个名字都塞进去"的偷懒透传。未 triggered / 非对象一律缺席(不渲染分隔线)。
 */
function readCompactionFromMetadata(raw: unknown): ChatMessage['compaction'] {
  if (!raw || typeof raw !== 'object') return undefined
  const rec = raw as Record<string, unknown>
  if (rec.triggered !== true) return undefined
  const num = (v: unknown): number | undefined =>
    typeof v === 'number' && Number.isFinite(v) ? v : undefined
  const originalTokens = num(rec.tokensBefore)
  const compressedTokens = num(rec.tokensAfter)
  if (originalTokens === undefined || compressedTokens === undefined) return undefined
  return {
    originalTokens,
    compressedTokens,
    ...(num(rec.removedCount) !== undefined ? { removedCount: num(rec.removedCount) } : {}),
    ...(typeof rec.trigger === 'string' ? { trigger: rec.trigger } : {}),
  }
}

/**
 * 从 metadata.retryNotice 还原"这轮上游重试过几次"(G-166 第⑥步)。
 * 四字段与 SSE retry_scheduled 契约同名;attempt / maxRetries 必须是 ≥1 的整数,
 * 否则整条不采信 —— "重试了 0 次"不是一种交代,渲染出来只会误导。
 */
function readRetryNoticeFromMetadata(raw: unknown): ChatMessage['retryNotice'] {
  if (!raw || typeof raw !== 'object') return undefined
  const rec = raw as Record<string, unknown>
  const pos = (v: unknown): number | undefined =>
    typeof v === 'number' && Number.isInteger(v) && v >= 1 ? v : undefined
  const attempt = pos(rec.attempt)
  const maxRetries = pos(rec.maxRetries)
  if (attempt === undefined || maxRetries === undefined) return undefined
  const retryInMs =
    typeof rec.retryInMs === 'number' && Number.isInteger(rec.retryInMs) && rec.retryInMs >= 0
      ? rec.retryInMs
      : 0
  const status =
    typeof rec.httpStatus === 'number' && Number.isInteger(rec.httpStatus)
      ? rec.httpStatus
      : undefined
  return { attempt, maxRetries, retryInMs, ...(status !== undefined ? { httpStatus: status } : {}) }
}

/**
 * 从 metadata.fallback 还原"这轮回答其实换过模型"的交代(D33 剩余类,2026-09-23 立)。
 *
 * 落库保留线上 snake_case(primary_model / backup_model / reason,api-callback 侧缺一不落),
 * 这里换算为与 SSE fallback 帧同一的 FallbackEvent(camel)交给消息级交代行渲染。
 * 三字段任一缺失/非字符串 → 字段缺席,不渲染半截话术。
 */
function readFallbackFromMetadata(raw: unknown): ChatMessage['fallback'] {
  if (!raw || typeof raw !== 'object') return undefined
  const rec = raw as Record<string, unknown>
  if (
    typeof rec.primary_model !== 'string' ||
    typeof rec.backup_model !== 'string' ||
    typeof rec.reason !== 'string'
  ) {
    return undefined
  }
  return { primaryModel: rec.primary_model, backupModel: rec.backup_model, reason: rec.reason }
}

/**
 * 从 metadata.usageDetail 还原消息级用量(D33 剩余类立)。
 *
 * 落库 schema 与 SSE usage 帧同源但**扁平**(firstTokenMs/durationMs 直接顶层,无 timing 嵌套),
 * 数值一律按"可有限才采"守卫(部分 provider 给字符串/NaN);缺分项与 live 口径一致:
 * reasoningTokens/costUsd → null(徽章对应分段不渲染),计时/分项 → 0。
 * totalTokens 非正数 = "这轮没有可交代的用量",整条不采(与渲染位 totalTokens<=0 不显示同判据)。
 */
function readUsageDetailFromMetadata(raw: unknown): MessageUsage | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const rec = raw as Record<string, unknown>
  const num = (v: unknown): number => {
    const n = typeof v === 'string' ? Number(v) : v
    return typeof n === 'number' && Number.isFinite(n) ? n : 0
  }
  const nullable = (v: unknown): number | null => {
    if (v === undefined || v === null) return null
    const n = typeof v === 'string' ? Number(v) : v
    return typeof n === 'number' && Number.isFinite(n) ? n : null
  }
  const totalTokens = num(rec.totalTokens)
  if (totalTokens <= 0) return undefined
  return {
    totalTokens,
    promptTokens: num(rec.promptTokens),
    completionTokens: num(rec.completionTokens),
    reasoningTokens: nullable(rec.reasoningTokens),
    firstTokenMs: num(rec.firstTokenMs),
    durationMs: num(rec.durationMs),
    model: typeof rec.model === 'string' ? rec.model : '',
    costUsd: nullable(rec.costUsd),
  }
}

/**
 * 从 metadata.memoryUpdates 还原"本轮记住了哪些条目"(D33 剩余类立)。
 * 落库为字符串数组(persistedMemoryUpdatesSchema);混入非字符串即整条不采 ——
 * 半截列表比不显示更容易被当成"记忆系统坏了"。
 */
function readMemoryUpdatesFromMetadata(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined
  return raw.every((item): item is string => typeof item === 'string') ? raw : undefined
}

/**
 * 从 metadata.steerApplied 还原"这轮中途引导注入了哪些条"(D33 剩余类,2026-09-24 立)。
 * 落库为 {text, timestamp?} 数组(api 侧 persistedSteerAppliedSchema 只钉死 text),
 * 与 web SteerNotice 同形;坏项逐条剔除(徽章是逐条 append 的累积通道,无"半截"误解),
 * 全坏/空 → undefined,不渲染空态。
 */
function readSteerAppliedFromMetadata(raw: unknown): SteerNotice[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined
  const out: SteerNotice[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    if (typeof rec.text !== 'string' || !rec.text.trim()) continue
    out.push({
      text: rec.text,
      ...(typeof rec.timestamp === 'string' ? { timestamp: rec.timestamp } : {}),
    })
  }
  return out.length > 0 ? out : undefined
}

/**
 * 从 metadata.queueItems 还原"该回答生成时刻仍排队中"的侧问快照(D33/G-39,2026-09-26 立)。
 *
 * 落库形状唯一真相源 = apps/ai-service/app/core/queue_items.py 的 QueueItemPayload
 * (id / text / createdAt,createdAt 为 epoch 毫秒),与 web SideQueueItem 逐字段同形同单位,
 * 故直接归一为 SideQueueItem[],不做字段改名透传。坏项逐条剔除(id 空/类型错/createdAt 非法),
 * 全坏或空数组 → undefined —— 与本文件 citations/steerApplied/memoryUpdates 四类先例同一
 * "空态不挂"口径。api 侧"空数组 = 这轮确实没有排队消息"与"缺键 = 这版后端没送"的区分
 * 在消息字段形态下对渲染等价(都不渲染),其清残留语义属会话级桶灌回的后续挂载格。
 */
function readQueueItemsFromMetadata(raw: unknown): SideQueueItem[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined
  const out: SideQueueItem[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    if (typeof rec.id !== 'string' || !rec.id) continue
    if (typeof rec.text !== 'string') continue
    // createdAt 为 epoch 毫秒非负整数;api 侧 strictObject 已拦非整数,这里再守一道
    // 防 DB 被其他端/历史链路写入的脏形状(与 planSteps 守卫同理由)。
    if (typeof rec.createdAt !== 'number' || !Number.isInteger(rec.createdAt) || rec.createdAt < 0)
      continue
    out.push({ id: rec.id, text: rec.text, createdAt: rec.createdAt })
  }
  return out.length > 0 ? out : undefined
}

/**
 * 历史水合后把"旁路型"过程信息灌回既有渲染位(D33,2026-09-23 立)。
 *
 * usageDetail → store.usageByMessageId(MessageUsageMetrics 既有渲染位)、
 * memoryUpdates → store.memoryUpdateNotices(MemoryNoticeBar 既有渲染位)—— 两处均不
 * 新增状态,复用 live 通道的写入 action;刷新后"发送→回放,元素仍在"由本函数闭合。
 * fallback 走消息字段(hydrateHistoryMessage 直接挂),不在此列。
 */
export interface HistoryProcessInfoRow {
  id: string
  /** ChatMessageMetadata(api-client)带索引签名,可直接传 getMessages 返回行 */
  metadata?: Record<string, unknown> | null
}

export function seedHistoryProcessInfoFrames(rows: readonly HistoryProcessInfoRow[]): void {
  const store = useChatStore.getState()
  for (const row of rows) {
    const meta = row.metadata ?? undefined
    const usage = readUsageDetailFromMetadata(meta?.usageDetail)
    if (usage) store.setMessageUsage(row.id, usage)
    const memories = readMemoryUpdatesFromMetadata(meta?.memoryUpdates)
    if (memories) store.appendMemoryNotice(row.id, memories)
    // D33 剩余类(2026-09-24 立):steer 注入记录灌回「⚡ 引导已生效」badge ——
    // live 通道 appendSteerNotice 单消息上限 8(= 后端 _STEER_QUEUE_LIMIT),
    // 历史行不会超(后端已拒绝第 9 条入队),逐条 append 即可,不新增 store 状态。
    const steers = readSteerAppliedFromMetadata(meta?.steerApplied)
    if (steers) for (const notice of steers) store.appendSteerNotice(row.id, notice)
  }
}

/**
 * 单条历史消息 → web store ChatMessage(D24 工具卡/终端区 + planSteps 计划快照)。
 *
 * 2026-09-21 立:plan_updated SSE 事件此前只写前端内存,刷新页面即丢。
 * ai-service 已把同一份快照经 /api/ai/callback 落到 chat_messages.metadata
 * (jsonb 已有列,零 schema 迁移),这里负责读回 message.planSteps。
 */
export function hydrateHistoryMessage(row: HistoryMessageRecord): ChatMessage {
  const meta = row.metadata ?? undefined
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: new Date(row.createdAt).getTime(),
    model: (meta?.model as string | null | undefined) ?? '',
    reasoning: row.reasoning,
    // D24(2026-09-19 立):恢复工具卡与终端区(metadata 强制落库)
    toolCalls: (meta?.toolCalls ?? undefined) as ChatMessage['toolCalls'],
    terminalTasks: (meta?.terminalTasks ?? undefined) as ChatMessage['terminalTasks'],
    // planSteps 回放(2026-09-21 立):缺失时 undefined,不得造出空数组
    planSteps: readPlanStepsFromMetadata(meta?.planSteps),
    // G-165:档位徽章的数据源从"只在内存里"换成服务端盖章的 metadata.permissionMode。
    // 经注册表归一后再落 store:库里历史行是 kebab,新链路可能送 camel/别名,
    // 不归一就是"刷新后徽章安静消失"(与 D111 三端不可见是同一个根因)。
    // 取不到就不写字段 —— 写 'default' 等于把"不知道"伪造成"当时是默认档"。
    permissionMode: permissionModeWire(meta?.permissionMode) ?? undefined,
    // G-166:交代帧此前只活在内存,刷新即丢 —— "引用了哪些来源 / 带了哪些上下文"
    // 只在当轮看得见,回放时整段消失。服务端已按与 SSE 同源的两份列表落库,这里读回。
    citations: readCitationsFromMetadata(meta?.citations),
    injections: readInjectionsFromMetadata(meta?.injections),
    compaction: readCompactionFromMetadata(meta?.compaction),
    retryNotice: readRetryNoticeFromMetadata(meta?.retryNotice),
    // D33:这轮**换过模型**的交代此前只在 live 顶部横幅一闪而过,刷新即丢 ——
    // 落到消息字段,由 MessageItem 交代行按既有 chat.fallbackNotice* 词回放。
    fallback: readFallbackFromMetadata(meta?.fallback),
    // D33(G-39,2026-09-26 立):排队侧问快照挂消息字段(与 fallback 同形态)——
    // 经既有 hydrateHistoryMessages 调用点即达生产面,渲染位消费侧待后续格。
    queueItems: readQueueItemsFromMetadata(meta?.queueItems),
  }
}

/** 批量水合(getMessages 分页结果 → store messages) */
export function hydrateHistoryMessages(rows: readonly HistoryMessageRecord[]): ChatMessage[] {
  return rows.map(hydrateHistoryMessage)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
