// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 用户级并发限制服务(2026-09-16 立,第二批深度对标补强 H)。
 *
 * 背景:此前只有 Key 级 QPM(rateLimit)与 TPM(api-key-tpm-service),缺少
 * "同一用户同时挂起的请求数"上限——单用户开几十路并发会把号池瞬间打爆,
 * 竞品(Sub2API)默认 user_concurrency: 5。
 *
 * 实现:进程内 Map 计数。本仓生产为单实例(NSSM deployloop)部署,进程内
 * 状态正确;**多实例部署时必须迁移到 Redis**(与 relay-channel-router 的
 * 熔断状态同款 INCR/DECR 方案),接入点已在 tryAcquire/release 两函数收敛。
 *
 * 上限来源:环境变量 RELAY_USER_CONCURRENCY_LIMIT(默认 20)。
 * 语义:超限返回 429(可重试),非排队——与竞品行为一致。
 *
 * G-727(2026-09-28)泄漏面收口:计数是**进程内 Map**,而调用方 HEAD 的写法把释放挂在
 * 占用成功之后约 10 行的 `reply.raw 'close'` 上 —— 中间任何一句抛错都不会再来 close,
 * 该用户的计数从此只增不减;一旦顶格,`超限判定 current > limit` 让此用户在这台进程余生
 * 全部 429(本文件那句"防止异常路径漏释放导致永久顶格"说的就是这个后果)。
 * 所以占用与登记必须同笔完成:见 acquireUserConcurrencyForResponse()「占用即登记」出口,
 * 以及成功结果里的幂等释放闩 slot.release(上游同型:connect.ts 的 disposeBackendOnce)。
 */
import { logger } from '../utils/logger.js'

/** 唯一计数面(进程内 Map)。下面两个诊断面都是从它派生的,不构成第二份计数。 */
const counters = new Map<string, number>()
/** 该用户计数由 0 涨到 1 的时刻(wall ms);回 0 即删。只用来量"挂了多久没回落"。 */
const heldSince = new Map<string, number>()
/** 已就"槽位疑似泄漏(长时间不回 0)"喊过的 userId;下次 0→1 重新武装,保证一个顶格周期只喊一次。 */
const leakWarned = new Set<string>()
/** 已就"多余释放"喊过的 userId;同上。 */
const overReleaseWarned = new Set<string>()

const DEFAULT_LIMIT = 20
/** 泄漏判定窗口默认值:计数离开 0 之后 10 分钟仍未回落即点名一次。 */
const DEFAULT_LEAK_WARN_AFTER_MS = 10 * 60 * 1000
/** snapshotCounters() 的默认返回条数上限(运维面按 current 降序截断,防诊断接口自己刷屏)。 */
const DEFAULT_SNAPSHOT_ROWS = 50

/** 用户并发上限(env RELAY_USER_CONCURRENCY_LIMIT,默认 20)。 */
export function getUserConcurrencyLimit(): number {
  const v = Number(process.env.RELAY_USER_CONCURRENCY_LIMIT)
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : DEFAULT_LIMIT
}

/** 泄漏告警窗口(env RELAY_USER_CONCURRENCY_LEAK_WARN_MS,默认 10 分钟;非正数回落默认)。 */
export function getUserConcurrencyLeakWarnAfterMs(): number {
  const v = Number(process.env.RELAY_USER_CONCURRENCY_LEAK_WARN_MS)
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : DEFAULT_LEAK_WARN_AFTER_MS
}

export interface ConcurrencySlotResult {
  ok: boolean
  current: number
  limit: number
  /**
   * G-727 幂等释放闩:**仅占用成功(ok=true)时非空**。同一槽位无论被触发多少次
   * (close 与 finish 双挂、或调用方随后再加 finally/结算点)都只减一次计数 ——
   * 这是"占用即登记"能安全引入多个结算点的前提。上游同型写法:connect.ts 的
   * disposeBackendOnce(backendDisposed 布尔闩 + catch/abort 双挂)。
   *
   * 超限(ok=false)恒为 null:那一次没有占用任何槽,任何"释放"都会吃掉同一用户
   * 另一个**正在跑**的请求的额度,所以这里刻意不给可调用物,而不是给一个空调用。
   */
  release: (() => void) | null
}

/** 释放路径的挂载目标:只要求事件监听能力(Node ServerResponse / 测试替身都满足)。 */
export interface ReleaseEventTarget {
  once(event: string, listener: () => void): unknown
}

/**
 * 尝试占用一个并发槽;成功 current 已含本次,且 result.release 是可重复调用的幂等闩。
 *
 * ⚠️ 只调用本函数而不释放 = 泄漏。HTTP 请求链路请用 acquireUserConcurrencyForResponse()
 * (它把"占用成功"与"登记释放"锁在同一函数内);非请求链路必须持有并使用返回的 release。
 */
export function tryAcquireUserConcurrency(userId: string): ConcurrencySlotResult {
  const limit = getUserConcurrencyLimit()
  const prev = counters.get(userId) ?? 0
  const next = prev + 1
  if (next > limit) {
    // 超限不占用,保持原计数(防止异常路径漏释放导致永久顶格)
    warnIfStaleHold(userId, prev, limit, 'over-limit')
    return { ok: false, current: prev, limit, release: null }
  }
  counters.set(userId, next)
  if (prev === 0) {
    heldSince.set(userId, Date.now())
    // 新一轮占用重新武装两个告警面(否则上一轮的"已喊过"会把这一轮的泄漏静音)
    leakWarned.delete(userId)
    overReleaseWarned.delete(userId)
  }
  warnIfStaleHold(userId, next, limit, 'acquired')
  let released = false
  const release = (): void => {
    if (released) return
    released = true
    decrement(userId)
  }
  return { ok: true, current: next, limit, release }
}

/**
 * G-727「占用即登记」唯一出口(调用方无需再自己拼释放回调)。
 *
 * 占用成功后在**本函数内**紧接着把幂等闩挂到响应流上,占用与登记之间不留任何可抛代码;
 * 挂载失败则当场释放并把原错误继续抛出 —— 即上游 connect.ts 的那条规矩:
 * **未发布给调用方的资源由创建方兜底释放**。调用方拿到 ok=true 时,释放路径必然已在位。
 *
 * 为什么不只挂 'close':HEAD 的写法只在 'close' 上释放,而 'close' 依赖连接真的走完生命周期;
 * 同时挂 'finish'(响应已冲刷完毕)作为更早的结算点,两者共用同一个闩 ⇒ 谁先到只减一次。
 */
export function acquireUserConcurrencyForResponse(
  userId: string,
  res: ReleaseEventTarget,
): ConcurrencySlotResult {
  const slot = tryAcquireUserConcurrency(userId)
  const release = slot.release
  if (!release) return slot
  try {
    res.once('close', release)
    res.once('finish', release)
  } catch (err) {
    // 一个监听器都没挂上(或只挂上第一个就抛)⇒ 创建方立刻释放;
    // 闩已落下,之后即使有监听器被触发也不会二次减。
    release()
    throw err
  }
  return slot
}

/**
 * 释放并发槽(裸减一 + 非负钳制)。
 *
 * ⚠️ 本函数**不具备**按槽位的幂等性:它的入参只有 userId,而同一用户可以并发多个请求,
 * 所以"按 userId 记一次"会让第二次释放变成静默吞掉别人在跑的槽。需要挂多个结算点
 * (close / finish / finally)时用 tryAcquireUserConcurrency() 成功结果里的 slot.release ——
 * 那个闩才是"只减一次"的载体。保留本导出仅为既有调用面兼容。
 */
export function releaseUserConcurrency(userId: string): void {
  decrement(userId)
}

/** 减一:回 0 时清键与诊断面;绝不下探到负数(多余释放只点名,不改数)。 */
function decrement(userId: string): void {
  const prev = counters.get(userId) ?? 0
  if (prev <= 0) {
    if (!overReleaseWarned.has(userId)) {
      overReleaseWarned.add(userId)
      logger.warn(
        `[user-concurrency] 多余释放(该用户当前挂起数为 0),已忽略以避免吃掉别人的槽位: userId=${userId}`,
      )
    }
    return
  }
  const next = prev - 1
  if (next <= 0) {
    counters.delete(userId)
    heldSince.delete(userId)
    leakWarned.delete(userId)
    overReleaseWarned.delete(userId)
  } else {
    counters.set(userId, next)
  }
}

/**
 * 疑似泄漏信号(只读诊断 + 一次性 warn,不引入任何定时器):
 * 判定时机 = 该用户的下一次占用尝试(含被 429 的那次)。真顶格时每个新请求都会走到这里,
 * 所以信号必然被发出;而请求停了就没有人再受困,不需要后台扫描。
 */
function warnIfStaleHold(userId: string, current: number, limit: number, phase: string): void {
  if (current <= 0) return
  const since = heldSince.get(userId)
  if (since === undefined) return
  const heldMs = Date.now() - since
  const afterMs = getUserConcurrencyLeakWarnAfterMs()
  if (heldMs <= afterMs) return
  if (leakWarned.has(userId)) return
  leakWarned.add(userId)
  logger.warn(
    `[user-concurrency] 槽位疑似泄漏: userId=${userId} 挂起 ${current}/${limit},` +
      `已持续 ${heldMs}ms(阈值 ${afterMs}ms,判定时机 ${phase});计数为进程内 Map,` +
      '顶格期间该用户的后续请求都会 429,需排查未释放的调用点或重启进程',
  )
}

/** 读当前并发数(运维/诊断)。 */
export function getUserConcurrencyCurrent(userId: string): number {
  return counters.get(userId) ?? 0
}

export interface ConcurrencyCounterRow {
  userId: string
  current: number
  /** 该用户的计数离开 0 已经多久(ms);键不存在时为 0。 */
  heldMs: number
}

/**
 * G-727 泄漏可观测出口:当前所有挂起中的用户计数快照,按 (current, heldMs) 降序截断返回。
 * 纯只读投影 —— 计数仍住在 counters 那一份里。
 */
export function snapshotCounters(maxRows = DEFAULT_SNAPSHOT_ROWS): ConcurrencyCounterRow[] {
  const now = Date.now()
  const rows: ConcurrencyCounterRow[] = []
  for (const [userId, current] of counters) {
    rows.push({ userId, current, heldMs: now - (heldSince.get(userId) ?? now) })
  }
  rows.sort((a, b) => b.current - a.current || b.heldMs - a.heldMs)
  return maxRows > 0 ? rows.slice(0, maxRows) : rows
}

// 防御性兜底:进程退出无法逐条释放,Map 随进程销毁,无需处理。
// 两条告警都是"每个顶格周期只喊一次"(leakWarned / overReleaseWarned,下次 0→1 重新武装),
// 且不挂任何定时器 —— 判定时机挂在占用/释放这两个自然调用点上,避免定时器风暴。
logger.debug('[user-concurrency] service loaded, limit env = RELAY_USER_CONCURRENCY_LIMIT')
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
