// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D35 长会话分页投影 — 共享层纯函数(游标 / 序数 / 合并去重 / 边界判定)。
 *
 * 为什么住在共享层:同一套 turn 分片语义要被 web / 小程序 / RN 三端复用,
 * 而服务端 `apps/api/src/db/chat-queries.ts` 的 `findHistoryTurnPage` 只产出
 * 「一页」,把多页拼成一条连贯、可增量回放的时间线是**客户端**的活。逐端各写
 * 一份合并逻辑,正是本仓反复记录的"手机上改了 web 没改"的成因(AGENTS §3)。
 *
 * 本模块**零依赖、零平台 API**(不 import node 内置模块、不依赖 Buffer/atob/DOM/React),因此
 * `@ihui/shared` 入口闭包对非 Node 宿主保持纯净(守门 126 的射程),三端可直接取用。
 *
 * 契约来源(不得凭猜测定义,逐字取自当次 HEAD):
 * - 端点:`apps/api/src/routes/chat.ts` 的 `GET /conversations/:id/history`
 *   (响应 data = `{ turns[{turnOrdinal, messages[]}], limit, hasMore, nextCursor,
 *   projectionState }`,外层 `{code,message,data}` 由 `success()` 包裹,api-client 已剥)。
 * - 游标:base64url(JSON `{turnOrdinal}`),生成/校验见同文件
 *   `encodeHistoryCursor` / `decodeHistoryCursor`(非整数序号 ⇒ 非法 ⇒ 服务端 400)。
 * - limit:`historyListSchema` = int ∈ [1,100],默认 20;`findHistoryTurnPage` 再兜底夹取一次。
 * - direction:`newest` 取最新 N turn / `older` 断点之前(上翻)/ `newer` 断点之后(增量续读)。
 *
 * 命名与 api 侧的 `encodeHistoryCursor`/`decodeHistoryCursor` 刻意不同
 * (`*HistoryTurnCursor`):守门 40 判"apps/* 与 packages/shared 的 export 名交集",
 * 同名会被读成端内重新实现。跨端等价性由 `__tests__/history-projection.test.ts`
 * 里逐字取自服务端产物的 base64url 夹具钉住(不靠 import 服务端代码)。
 */

// ============================================================================
// 类型:线格式(wire)与投影结果
// ============================================================================

/** 分片方向,取值与服务端 `historyListSchema.direction` 同集。 */
export type HistoryTurnDirection = 'newest' | 'older' | 'newer'

/** 合法方向集合(判据与类型同源,不得在别处再抄一份字面量)。 */
export const HISTORY_TURN_DIRECTIONS: readonly HistoryTurnDirection[] = ['newest', 'older', 'newer']

/** turn 游标载荷:唯一字段就是断点所在轮次序号。 */
export interface HistoryTurnCursor {
  readonly turnOrdinal: number
}

/** 服务端一页里的一个 turn 分片。`messages` 的元素类型由宿主决定(泛型不进共享判据)。 */
export interface HistoryTurnWire<M> {
  readonly turnOrdinal: number
  readonly messages: readonly M[]
}

/** 服务端 `GET /conversations/:id/history` 的 data 形态。 */
export interface HistoryPageWire<M> {
  readonly turns: readonly HistoryTurnWire<M>[]
  readonly limit: number
  readonly hasMore: boolean
  /** base64url(JSON {turnOrdinal});无下一页时为 null。客户端透明回传,不解析。 */
  readonly nextCursor: string | null
  /** 会话投影状态透传,可空 = 尚未投影。共享层不解释其内容(内容归投影器)。 */
  readonly projectionState: unknown
}

/** 合并后的投影:时间线 + 本轮丢弃计数 + 边界判定。 */
export interface HistoryProjection<M> {
  /** turnOrdinal **升序**、逐轮唯一。 */
  readonly turns: readonly HistoryTurnWire<M>[]
  /** 被丢弃的"序数缺失/非法"分片数(不静默,报告里必须能看见)。 */
  readonly droppedUnordained: number
  /** 与既有时间线重叠、被新页整轮替换掉的轮数(重叠页去重的可观测证据)。 */
  readonly replacedTurns: number
  readonly boundary: HistoryBoundary
}

/** 边界判定:两端各自"还能不能翻"与用什么游标翻。 */
export interface HistoryBoundary {
  readonly hasOlder: boolean
  readonly hasNewer: boolean
  /** 供 direction='older' 回传;无更早可翻时 null。 */
  readonly olderCursor: string | null
  /** 供 direction='newer' 回传;无更新可翻时 null。 */
  readonly newerCursor: string | null
  /** 时间线首/末轮序号(空投影为 null),供"是否已到头"的展示判定。 */
  readonly oldestTurnOrdinal: number | null
  readonly newestTurnOrdinal: number | null
}

// ============================================================================
// limit 夹取(与服务端同规则,客户端先行夹取以免发出注定 400 的请求)
// ============================================================================

export const HISTORY_LIMIT_DEFAULT = 20
export const HISTORY_LIMIT_MIN = 1
export const HISTORY_LIMIT_MAX = 100

/**
 * 夹取每页 turn 数:`Math.trunc` 后落进 [MIN, MAX];非有限数(NaN/Infinity)或
 * 夹完 <1 一律回默认值 —— 与 `findHistoryTurnPage` 里
 * `Math.min(Math.max(Math.trunc(limit) || 1, 1), 100)` 同语义。
 */
export function clampHistoryLimit(input: number | undefined | null): number {
  if (input === undefined || input === null) return HISTORY_LIMIT_DEFAULT
  if (!Number.isFinite(input)) return HISTORY_LIMIT_DEFAULT
  const truncated = Math.trunc(input)
  if (truncated < HISTORY_LIMIT_MIN) return HISTORY_LIMIT_DEFAULT
  return Math.min(truncated, HISTORY_LIMIT_MAX)
}

// ============================================================================
// 游标编解码(纯 JS base64url,不用 Buffer/atob)
// ============================================================================

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

/** UTF-8 编码(仅 BMP 常规路径;游标载荷恒为纯 ASCII 数字 JSON,这里仍按标准实现)。 */
function utf8Bytes(text: string): number[] {
  const out: number[] = []
  for (let i = 0; i < text.length; i++) {
    const cp = text.codePointAt(i) as number
    if (cp > 0xffff) i++ // 代理对被 codePointAt 合并,跳过一个 code unit
    if (cp < 0x80) out.push(cp)
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f))
    else if (cp < 0x10000)
      out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f))
    else
      out.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f),
      )
  }
  return out
}

function utf8FromBytes(bytes: number[]): string {
  let out = ''
  let i = 0
  while (i < bytes.length) {
    const b = bytes[i] as number
    if (b < 0x80) {
      out += String.fromCharCode(b)
      i += 1
    } else if (b >= 0xc0 && b < 0xe0 && i + 1 < bytes.length) {
      out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i + 1] as number & 0x3f))
      i += 2
    } else if (b >= 0xe0 && b < 0xf0 && i + 2 < bytes.length) {
      out += String.fromCharCode(
        ((b & 0x0f) << 12) |
          (((bytes[i + 1] as number) & 0x3f) << 6) |
          ((bytes[i + 2] as number) & 0x3f),
      )
      i += 3
    } else if (b >= 0xf0 && i + 3 < bytes.length) {
      const cp =
        ((b & 0x07) << 18) |
        (((bytes[i + 1] as number) & 0x3f) << 12) |
        (((bytes[i + 2] as number) & 0x3f) << 6) |
        ((bytes[i + 3] as number) & 0x3f)
      out += String.fromCodePoint(cp)
      i += 4
    } else {
      // 截断/非法序列:以 U+FFFD 占位并前移一位,让上层 JSON.parse 自然失败(⇒ null)
      out += '\uFFFD'
      i += 1
    }
  }
  return out
}

function bytesToBase64Url(bytes: number[]): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] as number
    const b1 = i + 1 < bytes.length ? (bytes[i + 1] as number) : 0
    const b2 = i + 2 < bytes.length ? (bytes[i + 2] as number) : 0
    const chunk = (b0 << 16) | (b1 << 8) | b2
    out += BASE64_ALPHABET.charAt((chunk >> 18) & 63) + BASE64_ALPHABET.charAt((chunk >> 12) & 63)
    out += i + 1 < bytes.length ? BASE64_ALPHABET.charAt((chunk >> 6) & 63) : ''
    out += i + 2 < bytes.length ? BASE64_ALPHABET.charAt(chunk & 63) : ''
  }
  return out
}

function base64UrlToBytes(text: string): number[] | null {
  const clean = text.replace(/=+$/, '')
  if (clean.length === 0) return []
  const lookup = new Map<string, number>()
  for (let i = 0; i < BASE64_ALPHABET.length; i++)
    lookup.set(BASE64_ALPHABET.charAt(i) as string, i)
  const out: number[] = []
  for (let i = 0; i < clean.length; i += 4) {
    const quad = clean.slice(i, i + 4)
    const vals: number[] = []
    for (const ch of quad) {
      const v = lookup.get(ch)
      if (v === undefined) return null // 非 base64url 字符 ⇒ 非法游标
      vals.push(v)
    }
    const n = vals.length
    const chunk =
      n === 4
        ? ((vals[0] as number) << 18) |
          ((vals[1] as number) << 12) |
          ((vals[2] as number) << 6) |
          (vals[3] as number)
        : n === 3
          ? ((vals[0] as number) << 18) | ((vals[1] as number) << 12) | ((vals[2] as number) << 6)
          : n === 2
            ? ((vals[0] as number) << 18) | ((vals[1] as number) << 12)
            : -1
    if (chunk < 0) return null // 余 1 个字符不可能是完整 base64 单元
    out.push((chunk >> 16) & 0xff)
    if (n >= 3) out.push((chunk >> 8) & 0xff)
    if (n >= 4) out.push(chunk & 0xff)
  }
  return out
}

/** 生成游标:与 `Buffer.from(JSON.stringify({turnOrdinal}),'utf8').toString('base64url')` 同字节。 */
export function encodeHistoryTurnCursor(cursor: HistoryTurnCursor): string {
  return bytesToBase64Url(utf8Bytes(JSON.stringify({ turnOrdinal: cursor.turnOrdinal })))
}

/**
 * 还原游标;任何不合法(非 base64url / 非法 JSON / 缺字段 / 序号非整数)一律 null。
 * 判据与服务端 `decodeHistoryCursor` 同形:服务端会把 null 转成 400,客户端据此
 * 判"这个断点已不可用"并回退到首屏,而不是带着坏游标反复撞 400。
 */
export function decodeHistoryTurnCursor(raw: string | null | undefined): HistoryTurnCursor | null {
  if (typeof raw !== 'string' || raw.length === 0) return null
  const bytes = base64UrlToBytes(raw)
  if (bytes === null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(utf8FromBytes(bytes))
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const ordinal = (parsed as Record<string, unknown>).turnOrdinal
  if (typeof ordinal !== 'number' || !Number.isInteger(ordinal)) return null
  return { turnOrdinal: ordinal }
}

/** 序数合法性判定(缺失 / 非整数 ⇒ 该分片对分片端点不可见,与 turn_ordinal IS NULL 同语义)。 */
export function isUsableTurnOrdinal(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value)
}

// ============================================================================
// 合并去重 + 边界判定
// ============================================================================

/**
 * 把一页并入既有时间线(幂等):同一 turnOrdinal **整轮替换**(last-write-wins),
 * 不是逐条 append —— 这是"流式追加后旧页仍可安全重放"的前提:服务端重发同一轮时,
 * 客户端只会看到该轮变完整,不会看到重复轮次或轮内消息翻倍。
 *
 * 序数缺失/非法的分片计入 `droppedUnordained` 后丢弃(绝不静默)。
 */
export function mergeHistoryTurnPages<M>(
  existing: readonly HistoryTurnWire<M>[],
  incoming: readonly HistoryTurnWire<M>[],
): Pick<HistoryProjection<M>, 'turns' | 'droppedUnordained' | 'replacedTurns'> {
  const byOrdinal = new Map<number, readonly M[]>()
  let dropped = 0
  for (const turn of existing) {
    if (!isUsableTurnOrdinal(turn.turnOrdinal)) {
      dropped += 1
      continue
    }
    byOrdinal.set(turn.turnOrdinal, turn.messages)
  }
  let replaced = 0
  for (const turn of incoming) {
    if (!isUsableTurnOrdinal(turn.turnOrdinal)) {
      dropped += 1
      continue
    }
    if (byOrdinal.has(turn.turnOrdinal)) replaced += 1
    byOrdinal.set(turn.turnOrdinal, turn.messages)
  }
  const turns = [...byOrdinal.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([turnOrdinal, messages]) => ({ turnOrdinal, messages }))
  return { turns, droppedUnordained: dropped, replacedTurns: replaced }
}

/**
 * 由单页响应推边界(不读全量,只用服务端给的 hasMore/nextCursor)。
 *
 * 服务端语义(chat.ts:803-811 实测):`nextCursor` 在 newest/older 时指向页内**最小**
 * turn(供继续上翻),在 newer 时指向页内**最大** turn(供继续续读)。因此
 * hasOlder/hasNewer 不能同真 —— 一次请求只有一个推进方向,把它推成"两端都有"
 * 就是让 UI 反复撞注定空的下一页。
 */
export function deriveHistoryBoundary<M>(
  page: HistoryPageWire<M>,
  direction: HistoryTurnDirection,
): HistoryBoundary {
  const ordinals = page.turns
    .map((t) => t.turnOrdinal)
    .filter((v): v is number => isUsableTurnOrdinal(v))
    .sort((a, b) => a - b)
  const oldestTurnOrdinal = ordinals.length > 0 ? (ordinals[0] as number) : null
  const newestTurnOrdinal = ordinals.length > 0 ? (ordinals[ordinals.length - 1] as number) : null

  if (direction === 'newer') {
    return {
      hasOlder: false,
      hasNewer: page.hasMore,
      olderCursor: null,
      newerCursor: page.hasMore ? page.nextCursor : null,
      oldestTurnOrdinal,
      newestTurnOrdinal,
    }
  }
  return {
    hasOlder: page.hasMore,
    hasNewer: false,
    olderCursor: page.hasMore ? page.nextCursor : null,
    newerCursor: null,
    oldestTurnOrdinal,
    newestTurnOrdinal,
  }
}

/** 一页直接投影(首屏走这一条;续页走 mergeHistoryTurnPages + deriveHistoryBoundary)。 */
export function projectHistoryPage<M>(
  page: HistoryPageWire<M>,
  direction: HistoryTurnDirection,
): HistoryProjection<M> {
  const merged = mergeHistoryTurnPages<M>([], page.turns)
  return { ...merged, boundary: deriveHistoryBoundary(page, direction) }
}

/**
 * 空页/失败页的判定:服务端可能返回 `turns: []`(会话无已投影行)。
 * 此时**不得**把 hasMore 当"还有内容" —— 无内容 + 无游标 = 到底了,
 * 否则 UI 会对着一个 null cursor 无限重试(本仓"静默空转"那一型)。
 *
 * 参数写成结构型而非 `Pick<HistoryPageWire<M>, …>`:`M` 在这里用不上,
 * 一旦写成 `HistoryPageWire<never>`(泛型无处推断时的落点)任何真实页都会因
 * "元素类型不可赋给 never"被判不兼容 —— tsc 在本票首跑就是这样红的,已钉成回归。
 */
export function isHistoryPageExhausted(page: {
  readonly turns: readonly unknown[]
  readonly hasMore: boolean
  readonly nextCursor: string | null
}): boolean {
  return page.turns.length === 0 && (page.nextCursor === null || !page.hasMore)
}

// ============================================================================
// 投影断点(projectionState)的读侧消费:解析 + 续读起点推导
// ============================================================================

/**
 * 服务端 rollout 断点的读侧形态。字段名与守卫**逐字镜像**写入侧
 * `apps/api/src/db/chat-queries.ts` 的 `HistoryProjectionState` /
 * `parseHistoryProjectionState`(立列迁移 20260924100000 注释定义语义:
 * 「byte_offset 为增量回放的字节断点(流式续读),ordinal 为 turn 级语义断点」)。
 * 名字与 api 侧刻意不同(与 `*HistoryTurnCursor` 同一方针,防守门 40 误读为端内重实现);
 * 跨侧等价性由 `__tests__/history-projection.test.ts` 用写入侧真实形态夹具钉住。
 */
export interface HistoryRolloutBreakpoint {
  /**
   * 已收口轮次正文的 UTF-8 字节累计。**读侧分页不得消费它** —— 它是写入侧
   * rollout 的量具,`GET /conversations/:id/history` 没有任何按字节续读的参数;
   * 留在类型里只为守卫完整性(形态不合 ⇒ 整个断点按"尚未投影"处理)。
   */
  readonly nextRolloutByteOffset: number
  /**
   * 最后一个**已收口**轮次的序号(严格小于当前最大轮 —— 进行中轮不计入;
   * 轮次序号有缺口时断点不越过缺口)。这是读侧唯一可消费的字段:
   * `direction='newer'` 的 keyset 起点(服务端取 `> 断点`)恰好覆盖
   * "进行中轮 + 其后全部新轮",配合整轮替换幂等。
   */
  readonly nextRolloutOrdinal: number
  /** 本次推进时间(ISO 8601)。参与形态守卫,不参与分页判定。 */
  readonly lastRolledAt: string
}

/** 守卫与服务端 `parseHistoryProjectionState` 同形:任一项不合 ⇒ null(视为尚未投影)。 */
export function parseHistoryRolloutBreakpoint(raw: unknown): HistoryRolloutBreakpoint | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  if (typeof o.nextRolloutByteOffset !== 'number' || !Number.isFinite(o.nextRolloutByteOffset)) {
    return null
  }
  if (typeof o.nextRolloutOrdinal !== 'number' || !Number.isInteger(o.nextRolloutOrdinal)) {
    return null
  }
  if (typeof o.lastRolledAt !== 'string' || o.lastRolledAt.length === 0) return null
  return {
    nextRolloutByteOffset: o.nextRolloutByteOffset,
    nextRolloutOrdinal: o.nextRolloutOrdinal,
    lastRolledAt: o.lastRolledAt,
  }
}

/** `resolveHistoryRolloutSeed` 的推导结果。 */
export interface HistoryRolloutSeed {
  /** 供 direction='newer' 回传的游标;null = 不能(未投影 / 断点倒退)。 */
  readonly cursor: string | null
  /** 本次读到的断点序号(null = 尚未投影);调用方应无条件用它覆盖自己存的前值。 */
  readonly breakpointOrdinal: number | null
  /**
   * 断点相对上次采用值**倒退** ⇒ 唯一成因是 `replaceMessages`(自动压缩)整段重写
   * 历史并按 1 重编号、断点 reset 重算。此时调用方此前合并的时间线与服务端行集
   * 已无对应关系,任何游标续读都无法修复 ⇒ 必须整体重拉。
   */
  readonly rewritten: boolean
}

/**
 * 由响应的 projectionState + 上次采用的断点,推导续读(newer 向)起点。
 *
 * 不变量:
 * - 未投影(state 为 null/残缺)⇒ 无起点、不判倒退(没有基准可判)。
 * - 首次采用(prev 为 null)⇒ 永不判倒退,即便序号是 0(新会话首轮未收口)。
 * - 倒退 ⇒ `rewritten:true` 且**刻意不产出游标** —— 半真的续读起点比"没有起点"
 *   危险得多(它会让消费体以为自己在续读,实际漏掉了重编号后的全部旧轮)。
 */
export function resolveHistoryRolloutSeed(
  projectionState: unknown,
  prevBreakpointOrdinal: number | null,
): HistoryRolloutSeed {
  const bp = parseHistoryRolloutBreakpoint(projectionState)
  if (bp === null) return { cursor: null, breakpointOrdinal: null, rewritten: false }
  if (prevBreakpointOrdinal !== null && bp.nextRolloutOrdinal < prevBreakpointOrdinal) {
    return { cursor: null, breakpointOrdinal: bp.nextRolloutOrdinal, rewritten: true }
  }
  return {
    cursor: encodeHistoryTurnCursor({ turnOrdinal: bp.nextRolloutOrdinal }),
    breakpointOrdinal: bp.nextRolloutOrdinal,
    rewritten: false,
  }
}

/** 两端续读游标(hook 的 cursorsRef 形态)。 */
export interface HistoryPagingCursors {
  readonly older: string | null
  readonly newer: string | null
}

/**
 * 分页游标的单一推进口径(三动作共用;各写一遍必然在"断点能不能当 newer 起点"上漂移)。
 *
 * - newer 起点优先级:**本页服务端链**(`boundary.newerCursor`,方向续读链的精确落点)
 *   > **断点种子**(`seed.cursor`,让首屏/上翻之后也能发起增量续读 —— 断点前的轮次
 *   已收口不变,`>断点` 至多重取"进行中轮",整轮替换幂等)
 *   > **上一次沿用**(仅当本次响应未投影**且未倒退**时;断点未投影 ⇒ 没有新信息,
 *   沿用旧链无害;断点倒退 ⇒ 旧链建立在已被重编号取代的序号上,沿用会静默漏读
 *   压缩后新追加的轮次,必须弃用)。
 * - `discardFolded` = 断点倒退且本次不是整段重建('newest')⇒ 调用方必须丢弃折叠结果、
 *   清空时间线与两端游标,只等 `loadLatest`。
 */
export function advanceHistoryPagingCursors(input: {
  direction: HistoryTurnDirection
  boundary: HistoryBoundary
  seed: HistoryRolloutSeed
  previous: HistoryPagingCursors
}): { cursors: HistoryPagingCursors; discardFolded: boolean } {
  const discardFolded = input.seed.rewritten && input.direction !== 'newest'
  if (discardFolded) return { cursors: { older: null, newer: null }, discardFolded: true }
  // 整段重建('newest')后,右缘就是本页最大轮:此时"上一次的 newer"已无对应物
  // (rewritten 时序号全变;未 rewritten 时它至多等于本页某轮,断点种子更权威),
  // 一律不得越过 `seed.cursor` 去沿用 —— 否则一台重建会把死游标复活成续读起点。
  const carriedNewer =
    input.seed.rewritten || input.direction === 'newest' ? null : input.previous.newer
  return {
    cursors: {
      older: input.boundary.olderCursor,
      newer: input.boundary.newerCursor ?? input.seed.cursor ?? carriedNewer,
    },
    discardFolded: false,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
