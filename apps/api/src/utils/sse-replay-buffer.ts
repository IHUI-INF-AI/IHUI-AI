// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SSE 断点重放缓冲区(#22,api 网关层,零 ai-service 行为变化)。
 *
 * 在 apps/api 网关层为每条对话流(process 内,单实例)缓存转发的 data 行,
 * 客户端断线后可凭 Last-Event-ID(即本缓冲的 seq)重放缺失事件。
 *
 * 容量上限:最多 200 个流,每流最多 2000 行,FIFO 淘汰。
 * 流结束/异常后保留 60 秒再释放(供断线窗口内重放)。
 */

/** 单条缓冲事件。 */
export interface ReplayEvent {
  /** 自增序号,对应 SSE `id:` 字段;客户端以 Last-Event-ID 上报。 */
  id: number
  /** 原始 data 行(已含 `data: ` 前缀与原有尾随换行),原样重放。 */
  rawLine: string
}

interface ReplayStream {
  events: ReplayEvent[]
  /** 创建时间(用于多流 FIFO 淘汰,取最早者)。 */
  createdAt: number
  /** 待释放定时器(流结束 60s 后触发删除);重注册时清空。 */
  releaseTimer: ReturnType<typeof setTimeout> | null
}

const MAX_STREAMS = 200
const MAX_EVENTS_PER_STREAM = 2000
const RELEASE_DELAY_MS = 60_000

const streams = new Map<string, ReplayStream>()

/** 超出流数量上限时淘汰创建时间最早者。 */
function evictOldestStreamIfNeeded(): void {
  if (streams.size < MAX_STREAMS) return
  let oldestKey: string | null = null
  let oldestAt = Number.POSITIVE_INFINITY
  for (const [key, s] of streams) {
    if (s.createdAt < oldestAt) {
      oldestAt = s.createdAt
      oldestKey = key
    }
  }
  if (oldestKey) streams.delete(oldestKey)
}

/**
 * 开始记录一条流的缓冲(清空旧缓冲并取消其待释放定时器)。
 * replayKey = `${conversationId}:${messageId}`。
 */
export function registerStream(replayKey: string): void {
  const existing = streams.get(replayKey)
  if (existing?.releaseTimer) {
    clearTimeout(existing.releaseTimer)
  }
  evictOldestStreamIfNeeded()
  streams.set(replayKey, { events: [], createdAt: Date.now(), releaseTimer: null })
}

/** 追加一条事件到缓冲(FIFO 淘汰超出上限的最旧事件)。 */
export function pushEvent(replayKey: string, event: ReplayEvent): void {
  const s = streams.get(replayKey)
  if (!s) return
  s.events.push(event)
  if (s.events.length > MAX_EVENTS_PER_STREAM) {
    s.events.splice(0, s.events.length - MAX_EVENTS_PER_STREAM)
  }
}

/** 返回 seq 之后(id > seq)的全部事件,用于断线重放。未知 key 返回空数组。 */
export function getEventsAfter(replayKey: string, seq: number): ReplayEvent[] {
  const s = streams.get(replayKey)
  if (!s) return []
  return s.events.filter((e) => e.id > seq)
}

/** 流是否仍在缓冲窗口内(未释放/未过期)。 */
export function isStreamActive(replayKey: string): boolean {
  return streams.has(replayKey)
}

/** 调度释放:流结束/异常后保留 RELEASE_DELAY_MS 再删除(定时器)。 */
export function releaseStream(replayKey: string): void {
  const s = streams.get(replayKey)
  if (!s || s.releaseTimer) return
  s.releaseTimer = setTimeout(() => {
    const cur = streams.get(replayKey)
    if (cur?.releaseTimer) {
      streams.delete(replayKey)
    }
  }, RELEASE_DELAY_MS)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
