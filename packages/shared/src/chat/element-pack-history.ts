// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D64⑤ 元素包历史落库 —— wire 契约与读写两侧的纯函数判定层(2026-10-14 立)。
 *
 * 背景与射程:AI 回复里的结构化元素(SSE element-pack 帧)此前只有一部分随
 * ai-callback 通道落库(toolCalls/terminalTasks/planSteps/citations/injections/
 * compaction/retryNotice/usageDetail/fallback/memoryUpdates/steerApplied/queueItems,
 * 见 apps/api/src/routes/ai-callback.ts 的 12 通道),**子代理帧族
 * (subagent_spawn/progress/end)没有任何落库通道** —— 网关透传给前端后即丢,
 * 重载会话后子代理卡无法回放。本模块把这一族登记为"随轮次持久化"的元素包契约。
 *
 * 落库链路(唯一写路径,全部在 apps/api):
 *   网关转发循环(apps/api/src/routes/ai-chat-stream.ts 的 streamToClient)
 *   → collectElementPackFrame 收窄一帧
 *   → appendElementPackFrames 追加进暂存表 chat_element_packs
 *     (packages/database 迁移 20261014100000,键 = conversation_id + client_message_id)
 *   → ai-callback worker 落 assistant 消息时 consumeElementPackFrames 原子取走
 *   → 并进消息 metadata.elementPack.frames(chat_messages.metadata jsonb)
 *   → GET /conversations/:id/history 经 serializeMessage 的 metadata 透传原样返回
 *     (D24 toolCalls 同一条回放面,读侧零改动)。
 *
 * 为什么挂 metadata 而不是读侧 join 暂存表:消息被删除/压缩重写(replaceMessages)
 * 时 metadata 随行消亡,元素包与消息同生命周期,不会残留孤儿行;暂存表只承担
 * "回调竞态窗口内的暂存",归并即取走。
 *
 * 收窄口径与 packages/shared/src/utils/sse-parse.ts 的 subagent 三分支**逐字段同形**
 * (两处各写一遍是跨层必然:解析器面向 wire 行,本模块面向落库;漂移由两侧测试的
 * 同一判例表钉住)。本模块零平台依赖,三端可直接取用读侧守卫。
 */

/** 暂存/回放帧的种类封闭集。新增种类必须连 collectElementPackFrame 分支一起加。 */
export const ELEMENT_PACK_FRAME_KINDS = ['subagent_spawn', 'subagent_progress', 'subagent_end'] as const

export type ElementPackFrameKind = (typeof ELEMENT_PACK_FRAME_KINDS)[number]

const ELEMENT_PACK_FRAME_KIND_SET: ReadonlySet<string> = new Set<string>(ELEMENT_PACK_FRAME_KINDS)

/** 元素包在 chat_messages.metadata 里的键名(唯一出口,读写两侧都从这里取)。 */
export const ELEMENT_PACK_METADATA_KEY = 'elementPack'

/** 元素包键内的帧数组键名。 */
export const ELEMENT_PACK_FRAMES_KEY = 'frames'

// ---------------------------------------------------------------------------
// wire 形态(camelCase,与 sse-parse 收窄后的 Subagent*Event 同族)
// ---------------------------------------------------------------------------

export interface ElementPackSubagentSpawnFrame {
  readonly kind: 'subagent_spawn'
  readonly id: string
  readonly role: string
  readonly task: string
  readonly timestamp: string
}

export interface ElementPackSubagentProgressFrame {
  readonly kind: 'subagent_progress'
  readonly id: string
  readonly phase: 'thinking' | 'tool_call' | 'tool_result' | 'output_ready'
  readonly timestamp: string
  readonly iteration?: number
  readonly tool?: string
  readonly ok?: boolean
  readonly outputPreview?: string
  readonly agentName?: string
}

export interface ElementPackSubagentEndFrame {
  readonly kind: 'subagent_end'
  readonly id: string
  readonly status: 'done' | 'failed'
  readonly failureReason?: string
  readonly timestamp: string
}

export type ElementPackFrame =
  | ElementPackSubagentSpawnFrame
  | ElementPackSubagentProgressFrame
  | ElementPackSubagentEndFrame

// ---------------------------------------------------------------------------
// 写侧收窄:网关从一条 data JSON 里提取一帧(判不过 ⇒ null,整帧丢弃,不造残帧)
// ---------------------------------------------------------------------------

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

function isoTimestamp(v: unknown): string {
  return typeof v === 'string' && v !== '' ? v : new Date().toISOString()
}

/**
 * 从一条 SSE data JSON 收窄出一帧元素包;不是已知种类或关键字段缺失 ⇒ null。
 * 判据与 sse-parse.ts 的 subagent 三分支同形:id 必须为 string,
 * progress.phase 只接受四个契约值,end.status 归一为 done/failed 二值。
 */
export function collectElementPackFrame(json: unknown): ElementPackFrame | null {
  if (typeof json !== 'object' || json === null) return null
  const o = json as Record<string, unknown>
  const kind = o.type
  if (typeof kind !== 'string' || !ELEMENT_PACK_FRAME_KIND_SET.has(kind)) return null
  const id = str(o.id)
  if (id === undefined) return null
  if (kind === 'subagent_spawn') {
    return {
      kind,
      id,
      role: str(o.role) ?? '',
      task: str(o.task) ?? '',
      timestamp: isoTimestamp(o.timestamp),
    }
  }
  if (kind === 'subagent_progress') {
    const phase = o.phase
    if (
      phase !== 'thinking' &&
      phase !== 'tool_call' &&
      phase !== 'tool_result' &&
      phase !== 'output_ready'
    ) {
      return null
    }
    return {
      kind,
      id,
      phase,
      timestamp: isoTimestamp(o.timestamp),
      ...(num(o.iteration) !== undefined ? { iteration: num(o.iteration) } : {}),
      ...(str(o.tool) !== undefined ? { tool: str(o.tool) } : {}),
      ...(typeof o.ok === 'boolean' ? { ok: o.ok } : {}),
      ...(str(o.output_preview) !== undefined ? { outputPreview: str(o.output_preview) } : {}),
      ...(str(o.agentName) !== undefined ? { agentName: str(o.agentName) } : {}),
    }
  }
  // subagent_end:status 归一(sse-parse 同判据 —— 非 'failed' 一律 'done')
  return {
    kind: 'subagent_end',
    id,
    status: o.status === 'failed' ? 'failed' : 'done',
    ...(str(o.failureReason) !== undefined ? { failureReason: str(o.failureReason) } : {}),
    timestamp: isoTimestamp(o.timestamp),
  }
}

// ---------------------------------------------------------------------------
// 读侧守卫:metadata.elementPack.frames → ElementPackFrame[](形态不合按空处理,不抛)
// ---------------------------------------------------------------------------

function isElementPackFrame(value: unknown): value is ElementPackFrame {
  if (typeof value !== 'object' || value === null) return false
  const o = value as Record<string, unknown>
  if (typeof o.kind !== 'string' || !ELEMENT_PACK_FRAME_KIND_SET.has(o.kind)) return false
  if (typeof o.id !== 'string' || typeof o.timestamp !== 'string') return false
  if (o.kind === 'subagent_progress') {
    const phase = o.phase
    return (
      phase === 'thinking' || phase === 'tool_call' || phase === 'tool_result' || phase === 'output_ready'
    )
  }
  if (o.kind === 'subagent_end') return o.status === 'done' || o.status === 'failed'
  return true // subagent_spawn:关键字段已在上两行判过
}

/**
 * 从一条消息 metadata 读回元素包帧数组。任何形态不合(键缺席/非对象/frames 非数组/
 * 元素判不过)按"无元素包"处理返回空数组 —— 读回是回放,坏值不值得炸渲染。
 */
export function parseElementPackFrames(metadata: unknown): ElementPackFrame[] {
  if (typeof metadata !== 'object' || metadata === null) return []
  const pack = (metadata as Record<string, unknown>)[ELEMENT_PACK_METADATA_KEY]
  if (typeof pack !== 'object' || pack === null) return []
  const frames = (pack as Record<string, unknown>)[ELEMENT_PACK_FRAMES_KEY]
  if (!Array.isArray(frames)) return []
  return frames.filter(isElementPackFrame)
}

/**
 * 把帧数组包成 metadata.elementPack 的落库形状(写侧唯一出口)。
 * 空数组返回 null(无内容不写 key —— 与 ai-callback 12 通道"空不写键"同一纪律)。
 */
export function buildElementPackMetadata(frames: readonly ElementPackFrame[]): {
  readonly [ELEMENT_PACK_FRAMES_KEY]: readonly ElementPackFrame[]
} | null {
  if (frames.length === 0) return null
  return { [ELEMENT_PACK_FRAMES_KEY]: [...frames] }
}
