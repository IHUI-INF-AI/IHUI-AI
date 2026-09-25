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
  /**
   * 累计被 FIFO 裁头丢弃的事件条数(第九轮 2026-09-26 立)。
   * 这是本接口唯一新增状态:「缓冲里当前最早的 id」一律由 `events[0].id` 现取,
   * 不另存第二份 —— 两处算同一件事必然漂移(本仓已记多次),而裁掉的条数
   * 事后无法从 events 反推,所以只有它必须落状态。
   */
  droppedCount: number
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
  streams.set(replayKey, {
    events: [],
    createdAt: Date.now(),
    releaseTimer: null,
    droppedCount: 0,
  })
}

/** 追加一条事件到缓冲(FIFO 淘汰超出上限的最旧事件)。 */
export function pushEvent(replayKey: string, event: ReplayEvent): void {
  const s = streams.get(replayKey)
  if (!s) return
  s.events.push(event)
  if (s.events.length > MAX_EVENTS_PER_STREAM) {
    const dropped = s.events.length - MAX_EVENTS_PER_STREAM
    s.events.splice(0, dropped)
    // 裁头必须留痕:静默丢弃是"断线重连后消息少了若干条、界面却看着连续"的唯一成因。
    s.droppedCount += dropped
  }
}

/** 返回 seq 之后(id > seq)的全部事件,用于断线重放。未知 key 返回空数组。 */
export function getEventsAfter(replayKey: string, seq: number): ReplayEvent[] {
  const s = streams.get(replayKey)
  if (!s) return []
  return s.events.filter((e) => e.id > seq)
}

/** 重放窗口状态(第九轮 2026-09-26 立:三态必须分清 —— 无洞 / 有洞 / 无从判断)。 */
export interface ReplayWindowStatus {
  /** 该 replayKey 是否仍在缓冲窗口内(未知或已释放 = false)。 */
  known: boolean
  /** 从 seq 之后重放是否能覆盖客户端缺的全部事件(false = 有洞或无从判断)。 */
  complete: boolean
  /** 当前仍在缓冲里最早的 id;缓冲为空或 key 未知时为 null。 */
  lowestId: number | null
  /** 累计被 FIFO 裁掉的条数(丢弃可见,不许静默)。 */
  droppedCount: number
}

/**
 * 纯判据:给定缓冲当前最早 id 与累计裁掉条数,判断「id > seq」这一段是否完整可重放。
 *
 * 前提(由本模块的写入方式保证):id 单调追加且只从头部裁剪,故缓冲持有的是
 * **连续区间** [lowestBufferedId .. N]。客户端已收到 <= seq,需要的是 (seq .. N],
 * 这些全在缓冲里 <=> seq >= lowestBufferedId - 1。
 *
 * 边界语义(钉死,差 1 不得翻转):
 * - `seq === lowestBufferedId - 1` ⇒ **完整**。尾巴恰好接上,中间一条不缺,
 *   此时判"有洞"会把一次正常重连退化成重新生成(白烧一次上游 token)。
 * - `seq === lowestBufferedId - 2` ⇒ 有洞(至少 1 条既没进缓冲也没被客户端收到)。
 * - `droppedCount === 0` ⇒ 一律完整,与 seq 大小无关:一条都没裁掉过,
 *   客户端报 seq = -1(什么都没收到)也是完整重放;不得把"seq 比首条 id 小"误判成洞。
 * - 有裁头却拿不到 lowestBufferedId(缓冲为空的异常形态)⇒ 判不出 ⇒ 按有洞处理,
 *   宁可不发半截尾巴,绝不把"少了几条"伪装成"本来就这么多"。
 */
export function isReplayWindowComplete(
  seq: number,
  lowestBufferedId: number | null,
  droppedCount: number,
): boolean {
  if (droppedCount === 0) return true
  if (lowestBufferedId === null) return false
  return seq >= lowestBufferedId - 1
}

/** 读取某流的重放窗口状态(不改动缓冲;未知 key 返回 known:false 的"无法重放"态)。 */
export function getReplayWindowStatus(replayKey: string, seq: number): ReplayWindowStatus {
  const s = streams.get(replayKey)
  if (!s) {
    return { known: false, complete: false, lowestId: null, droppedCount: 0 }
  }
  const lowestId = s.events.length > 0 ? (s.events[0] as ReplayEvent).id : null
  return {
    known: true,
    complete: isReplayWindowComplete(seq, lowestId, s.droppedCount),
    lowestId,
    droppedCount: s.droppedCount,
  }
}

/**
 * 重放窗口是否**不足以**覆盖 seq(含"key 未知/已过期" —— 那一律按无法重放处理,
 * 不得读成"无洞")。调用方据此放弃部分重放、走既有的全量重新生成降级路径。
 */
export function hasReplayHole(replayKey: string, seq: number): boolean {
  return !getReplayWindowStatus(replayKey, seq).complete
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
