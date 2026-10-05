// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SSE 断点重放缓冲区(#22,api 网关层,零 ai-service 行为变化)。
 *
 * 在 apps/api 网关层为每条对话流(process 内,单实例)缓存转发的 data 行,
 * 客户端断线后可凭 Last-Event-ID(即本缓冲的 seq)重放缺失事件。
 *
 * 容量上限:最多 200 个流;每流既有**条数**上限(2000 行,FIFO 淘汰留痕),
 * 也有 G-714 立的**字节**水位(窗口自身占用 + 在途未确认,双维度边沿触发)。
 * 流结束/异常后保留 60 秒再释放(供断线窗口内重放)。
 *
 * G-714(2026-10-05 立)为什么条数上限不够:MAX_EVENTS_PER_STREAM 只数「多少条」,
 * 不量「多大」。2000 条 3 KB 的 tool-result 就是 6 MB —— 条数远没撞线,内存早已被吃穿,
 * 而窗口照旧报 complete:true。这就是「只数条数却冒充完整」,本票要堵的正是它。
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
  /**
   * G-998166:流已进入释放保留窗口(流结束/异常后的 disposed-stale 态)。
 * disposed 表项对「复用型」取句柄路径不可见(命中即删),但 60s 重放窗口内的
   * 只读重放(getEventsAfter / getReplayWindowStatus)仍然有效。
   */
  disposed: boolean
  /** G-714:当前缓冲内全部事件的重放帧字节合计(口径唯一,见 replayFrameBytes)。 */
  windowBytes: number
  /**
   * G-714 ①:在途**未确认**字节 —— 生产者同步上报的实测值(取 reply.raw.writableLength,
   * 即「已写出但仍在 socket 写队列里、对端尚未消费」的字节),不是「条数 × 常数」的估算。
   */
  unackedBytes: number
  /** G-714 ②:本轮未确认的起始时刻(ms);unackedBytes 归 0 时置 null,宽限窗重新起算。 */
  unackedSince: number | null
  /** G-714 ④:饱和态(边沿触发 —— 高水位进、低水位出,迟滞带内的抖动不翻转)。 */
  saturated: boolean
  /** G-714 ④:待上层取用的一条饱和边沿(读即清,所以同一条边只会被看到一次)。 */
  pendingEdge: SaturationEdge
  /**
   * G-714 ③:显式放弃终态 —— **单向闩**,一旦置位不得复位(只有 registerStream 换代
   * 才换出新的空表项)。放弃态下 complete 恒为 false:中段已不可信的尾巴绝不许冒充完整。
   */
  abandoned: boolean
  /** G-714:首个触发放弃的条件(放弃必须可解释,不许只说"窗口没了")。 */
  abandonReason: ReplayAbandonReason | null
}

/** 饱和边沿:entered = 刚进入饱和,exited = 刚解除饱和,null = 没有待消费的边沿。 */
export type SaturationEdge = 'entered' | 'exited' | null

/**
 * 放弃触发条件(G-714 双放弃条件 + 窗口字节维)。三个来源都是**字节 / 时间**,
 * 没有「条数超了所以放弃」那一条 —— 条数越界仍走 FIFO 裁头 + droppedCount 留痕。
 */
export type ReplayAbandonReason = 'unacked-bytes' | 'unacked-grace' | 'window-bytes'

const MAX_STREAMS = 200
const MAX_EVENTS_PER_STREAM = 2000
const RELEASE_DELAY_MS = 60_000

// ===== G-714 字节水位阈值(一律带名字带单位;不设默认开启的环境变量开关) =====

/**
 * 重放窗口自身字节上限:**4 MiB / 流**。
 * 越界 ⇒ 显式放弃(reason 'window-bytes')。绝不在这里"按字节静默裁完继续报完整"——
 * 那是本票点名的假降级;裁头只保留既有的条数维度,且必须落 droppedCount。
 */
export const REPLAY_WINDOW_BYTE_CAP = 4 * 1024 * 1024
/**
 * 未确认字节上限:**2 MiB / 流**(上游正解①,发送路径内**同步**判)。
 * 越界 ⇒ 放弃(reason 'unacked-bytes'):客户端已经跟不上,继续堆缓冲只是把不可信尾巴留久一点。
 */
export const REPLAY_UNACKED_BYTE_CAP = 2 * 1024 * 1024
/**
 * 最老一条未确认字节的宽限窗:**30_000 ms(30s)**(上游正解②,时间维)。
 * 取 30s = 断线宽限期 SSE_GRACE_PERIOD_MS(15s)的两倍 —— 一个宽限周期内没消费完就再等一轮,
 * 两轮仍未消费 ⇒ 判定这条连接追不回来,放弃。
 */
export const REPLAY_UNACKED_GRACE_MS = 30_000
/**
 * 饱和**高水位**:1 MiB。压力 = max(窗口字节, 未确认字节) 达到它 ⇒ 进入饱和(边沿一次),
 * 上层据此暂停 drain。取窗口字节上限的 1/4,留足从"暂停"到"撞线"的处置距离。
 */
export const REPLAY_HIGH_WATERMARK_BYTES = 1 * 1024 * 1024
/**
 * 饱和**低水位**:512 KiB。只有压力回落到它以下才解除饱和。
 * 高低之间的 512 KiB 是迟滞带:来回抖动不得重复发边沿。
 */
export const REPLAY_LOW_WATERMARK_BYTES = 512 * 1024

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
 * 一条事件的重放帧**字节口径**(唯一公式):`id: <id>\n<rawLine>\n\n`,按 utf8 实测。
 *
 * 为什么是这三段:实时写出与断线重放写的就是这个形态 —— 见
 * routes/ai-chat-stream.ts 的 `raw.write(\`id: ${e.id}\n${e.rawLine}\n\n\`)` 与
 * sse-stream-registry.ts 的 emitUpstreamLine。拿它当尺子才叫「字节」,
 * 不是「条数 × 常数」。push / 裁头 / 判据三处共用这一份实现(两处算同一件事必漂移)。
 */
export function replayFrameBytes(event: ReplayEvent): number {
  return Buffer.byteLength(`id: ${event.id}\n${event.rawLine}\n\n`, 'utf8')
}

/**
 * 当前字节压力 = **在途未确认字节**(不是窗口字节)。
 *
 * 为什么把窗口字节排除在饱和判据之外:窗口字节只会单调上涨(除了换代),拿它当
 * 「暂停 drain」的信号,一条正常长了 1 MiB 的长流会被永久判饱和、每个 chunk 都停在
 * 闸前等到宽限窗超时 —— 那是把健康流线卡死,不是背压。窗口字节的处置只有一格:
 * 撞到 REPLAY_WINDOW_BYTE_CAP ⇒ 显式放弃(见 evaluateReplayPressure)。
 */
function pressureBytesOf(s: ReplayStream): number {
  return s.unackedBytes
}

/**
 * 同步更新放弃闩与饱和边沿 —— **唯一落点**(push / 生产者上报 / 状态读取三条路都走它)。
 *
 * - ①②③ 放弃:未确认字节越界 → 最老未确认超宽限窗 → 窗口字节越界,任一命中即置单向闩
 *   并记下首个触发条件;已放弃则不再重复判定(终态不可逆)。
 * - ④ 饱和(边沿触发):未放弃时,压力 ≥ 高水位 ⇒ 产生一条 'entered';
 *   压力 ≤ 低水位 ⇒ 产生一条 'exited';迟滞带内的抖动不产生任何边沿。
 *   放弃之后不再发边沿 —— 终态之后的通知没有意义。
 */
function evaluateReplayPressure(s: ReplayStream, now: number): void {
  if (!s.abandoned) {
    if (s.unackedBytes > REPLAY_UNACKED_BYTE_CAP) {
      s.abandoned = true
      s.abandonReason = 'unacked-bytes'
    } else if (s.unackedSince !== null && now - s.unackedSince > REPLAY_UNACKED_GRACE_MS) {
      s.abandoned = true
      s.abandonReason = 'unacked-grace'
    } else if (s.windowBytes > REPLAY_WINDOW_BYTE_CAP) {
      s.abandoned = true
      s.abandonReason = 'window-bytes'
    }
  }
  if (s.abandoned) return
  const pressure = pressureBytesOf(s)
  if (!s.saturated && pressure >= REPLAY_HIGH_WATERMARK_BYTES) {
    s.saturated = true
    s.pendingEdge = 'entered'
  } else if (s.saturated && pressure <= REPLAY_LOW_WATERMARK_BYTES) {
    s.saturated = false
    s.pendingEdge = 'exited'
  }
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
    disposed: false,
    // G-714:换代即新窗口 —— 字节水位、饱和态与放弃闩全部重新起算,
    // 否则一次放弃会被同 key 的下一轮流读成"永久放弃"(与 droppedCount 同理)。
    windowBytes: 0,
    unackedBytes: 0,
    unackedSince: null,
    saturated: false,
    pendingEdge: null,
    abandoned: false,
    abandonReason: null,
  })
}

/** 追加一条事件到缓冲(FIFO 淘汰超出上限的最旧事件)。 */
export function pushEvent(replayKey: string, event: ReplayEvent): void {
  const s = streams.get(replayKey)
  if (!s) return
  s.events.push(event)
  s.windowBytes += replayFrameBytes(event)
  if (s.events.length > MAX_EVENTS_PER_STREAM) {
    const dropped = s.events.length - MAX_EVENTS_PER_STREAM
    const removed = s.events.splice(0, dropped)
    // 裁头必须留痕:静默丢弃是"断线重连后消息少了若干条、界面却看着连续"的唯一成因。
    s.droppedCount += dropped
    // 字节合计与被裁事件同步扣减(同一份 replayFrameBytes 公式,不留第二把尺子)
    for (const e of removed) s.windowBytes -= replayFrameBytes(e)
  }
  // 窗口字节越界 ⇒ 显式放弃(绝不自作主张按字节裁一段继续报完整);顺带刷新饱和边沿。
  evaluateReplayPressure(s, Date.now())
}

/**
 * 生产者同步上报「此刻仍卡在 socket 写队列、对端尚未消费的字节数」
 * (取 `reply.raw.writableLength` 的实测值,不做估算/条数换算)。
 * 未确认维度(①字节 ②时间)与饱和边沿都在此更新;上报 0 ⇒ 宽限窗归零重新起算。
 */
export function reportReplayPendingBytes(replayKey: string, pendingBytes: number): void {
  const s = streams.get(replayKey)
  if (!s) return
  const now = Date.now()
  const next = Number.isFinite(pendingBytes) && pendingBytes > 0 ? Math.trunc(pendingBytes) : 0
  s.unackedBytes = next
  if (next > 0) {
    // 只在「从 0 变成有」时打点:后续继续堆积不得把宽限窗往后推(判的是最老那一条)
    if (s.unackedSince === null) s.unackedSince = now
  } else {
    s.unackedSince = null
  }
  evaluateReplayPressure(s, now)
}

/**
 * 取走并清空一条饱和边沿(读即清 ⇒ 同一条边上层只会消费一次;来回抖动不会重复发)。
 *
 * 边沿只是**通知**;权威状态永远是 getReplayWindowStatus().saturated。
 * 同一 tick 内先 enter 后 exit 只留最后一条(边沿被合并不会让上层漏判饱和本身)。
 */
export function takeSaturationEdge(replayKey: string): SaturationEdge {
  const s = streams.get(replayKey)
  if (!s) return null
  const edge = s.pendingEdge
  s.pendingEdge = null
  return edge
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
  /** G-714 ③:窗口是否已被**显式放弃**(终态;此时 complete 必为 false)。 */
  abandoned: boolean
  /** G-714:放弃触发条件(字节 / 宽限窗 / 窗口字节);未放弃为 null。 */
  abandonReason: ReplayAbandonReason | null
  /** G-714 ④:当前是否处于饱和(边沿触发态;上层据此暂停 drain,配合 takeSaturationEdge)。 */
  saturated: boolean
  /** G-714:窗口自身占用字节(replayFrameBytes 合计,可解释)。 */
  windowBytes: number
  /** G-714 ①:生产者最近一次上报的在途未确认字节(实测 socket 写队列长度)。 */
  unackedBytes: number
  /**
   * G-714 ③:放弃后上层的恢复语义 —— 'resubscribe-from-beginning' = 不带 Last-Event-ID
   * 从头订阅、全量重取;未放弃为 null。路由既有降级分支(complete:false ⇒ 重新生成)承接它。
   */
  recovery: 'resubscribe-from-beginning' | null
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
 *
 * G-714 注:本函数的三条判据与签名**一字未动**(sse-replay-hole.test.ts 直接注入它)。
 * 「放弃态不得报完整」这条新闸加在 getReplayWindowStatus 上 —— 放弃是**流的状态**、
 * 不是 (seq, lowestId, droppedCount) 三个数能表达的,把它塞进纯函数等于伪造第四个输入。
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

/**
 * 读取某流的重放窗口状态(未知 key 返回 known:false 的"无法重放"态)。
 *
 * 不改动 events / droppedCount —— 但**不是**纯读:G-714 ② 的时间维只能在「有人来看」
 * 的那一刻判定,所以本函数会就地评估放弃条件与饱和边沿,因而可能置 abandoned 单向闩
 * (一旦置位绝不回头)。生产者每帧都会调它,故不读也不算漏判。
 */
export function getReplayWindowStatus(replayKey: string, seq: number): ReplayWindowStatus {
  const s = streams.get(replayKey)
  if (!s) {
    return {
      known: false,
      complete: false,
      lowestId: null,
      droppedCount: 0,
      abandoned: false,
      abandonReason: null,
      saturated: false,
      windowBytes: 0,
      unackedBytes: 0,
      recovery: null,
    }
  }
  evaluateReplayPressure(s, Date.now())
  const lowestId = s.events.length > 0 ? (s.events[0] as ReplayEvent).id : null
  return {
    known: true,
    // G-714 ⑤:放弃态下**绝不**报 complete:true。尾巴看着连续而中段已不可信,
    // 正是本票要堵的"冒充完整";未放弃时既有三条判据逐字照旧。
    complete: !s.abandoned && isReplayWindowComplete(seq, lowestId, s.droppedCount),
    lowestId,
    droppedCount: s.droppedCount,
    abandoned: s.abandoned,
    abandonReason: s.abandonReason,
    saturated: s.saturated,
    windowBytes: s.windowBytes,
    unackedBytes: s.unackedBytes,
    recovery: s.abandoned ? 'resubscribe-from-beginning' : null,
  }
}

/**
 * 重放窗口是否**不足以**覆盖 seq(含"key 未知/已过期" —— 那一律按无法重放处理,
 * 不得读成"无洞")。调用方据此放弃部分重放、走既有的全量重新生成降级路径。
 */
export function hasReplayHole(replayKey: string, seq: number): boolean {
  return !getReplayWindowStatus(replayKey, seq).complete
}

/** 流是否仍在缓冲窗口内(未释放/未过期;含已结束但处于 60s 重放保留窗口的流)。 */
export function isStreamActive(replayKey: string): boolean {
  return streams.has(replayKey)
}

/**
 * G-998166:复用型取句柄唯一入口 —— 按 key 取到的表项必须先过「是否已 disposed」复核。
 * 命中 disposed-stale 表项 ⇒ 清定时器 + 删表项 + warn 后返回 null(不得复用);
 * 表项不在或已 disposed ⇒ null。写路径(挂监听/继续写)一律走这里,不得直读 Map。
 */
export function acquireLiveStream(replayKey: string): boolean {
  const s = streams.get(replayKey)
  if (!s) return false
  if (s.disposed) {
    if (s.releaseTimer) clearTimeout(s.releaseTimer)
    streams.delete(replayKey)
    console.warn(`[sse-replay-buffer] disposed-stale 表项命中并清理: ${replayKey}`)
    return false
  }
  return true
}

/** 调度释放:流结束/异常后保留 RELEASE_DELAY_MS 再删除(定时器)。 */
export function releaseStream(replayKey: string): void {
  const s = streams.get(replayKey)
  if (!s || s.releaseTimer) return
  s.disposed = true
  s.releaseTimer = setTimeout(() => {
    const cur = streams.get(replayKey)
    // G-998166:迟到清理带对象身份复核 —— 只有当前表项仍是**调度时那一条**才删;
    // 同 key 已被新 generation 重注册(registerStream 会换掉整条)时绝不误删新表项。
    if (cur === s) {
      streams.delete(replayKey)
    }
  }, RELEASE_DELAY_MS)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
