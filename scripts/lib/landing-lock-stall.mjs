// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 落地通道独占停滞的判定(第三档,2026-11-06 立;发射点在 object-space-land 的等待路径上)。
 *
 * 立因(本机现读两型,同一后果、不同成因):
 *  ① 03:46:50Z–04:26Z:持有者 pid=38792 独占约 40 分钟后以 rc=2 结束才交还,等待方 605s/40 次
 *     顶住后 rc=2 退出。原语打的理由是 `身份无法核对…取启动时间失败:ETIMEDOUT`(满载机上探针自己超时)。
 *  ② 04:18Z 起:持有者 pid=5552 仍**活着**,锁龄 1901s,而 meta 的 mtime 距今 1885s ≈ 锁龄
 *     ⇒ `tryAcquireSingleInstance` 这一族按设计**没有心跳续期**(它的前提是"死 pid 才能回收"),
 *     于是"活着但挂死"的持有者会让整条旁路落地通道无限期独占。
 *     这一型里 meta 还缺 `pidStart`(`{"unitId":"object-space-land","pid":5552,"ts":…,"host":"服务器","leaseToken":…}`),
 *     身份永远不可核 ⇒ 等待方连"确证 pid 已被复用"那条唯一例外都走不到。
 *
 * 前两型都已经各有终局档(机制停摆 `runner-face-parked-round`、供给断档 `supply-stall-round`),
 * 唯独这一型只有被挡住那枚自己的 stderr 知道 —— 一个谁都不喊的稳态停摆(§12e 同族)。
 *
 * 本模块只做判定,**不做**任何回收决定:回收仍由 `git-lock.mjs` 的原语裁决(身份可核 + 确证被复用才抢)。
 * 也就是说这一档只负责"喊人",不负责"放行" —— 绝不因为等不到就削拒抢。
 */

export const LOCK_STALL_ENV = 'IHUI_LAND_LOCK_STALL_MS'
/** 缺省 20 分钟:量自本机两型 —— 第一型 40 分钟、第二型现读已 31 分钟且无心跳,
 *  而正常一枚旁路落地的实测上界是"两面全量审 × 数臂 + CAS 重试"(门 98 单面 93s、CAS 三次),
 *  现读最慢成功枚 `b4e057da4b` 用了 3 次 CAS 约 10 分钟 ⇒ 20 分钟 = 最慢正常形态 ×2。 */
export const LOCK_STALL_DEFAULT_MS = 20 * 60 * 1000

/**
 * @param metaText    lock/meta.json 原文(null ⇒ 未在场/读不到)
 * @param lockExists  锁目录是否存在(false ⇒ free)
 * @param metaMtimeMs 锁目录 meta 的 mtime(用来区分"有心跳"与"独占挂死";null ⇒ 取不到)
 * @param nowMs       本轮时刻(注入)
 * @param pidAlive    (pid)=>boolean|null(不注入 ⇒ 该维未判定)
 */
export function judgeLandingLock({
  lockExists = false,
  metaText = null,
  metaMtimeMs = null,
  nowMs = Date.now(),
  pidAlive = null,
  stallMs = LOCK_STALL_DEFAULT_MS,
  cpuDeltaMs = null,
  cpuSampleGapMs = null,
} = {}) {
  if (lockExists === false)
    return { state: 'free', ageMs: 0, why: '锁目录不在场 ⇒ 通道空闲' }
  if (typeof metaText !== 'string' || metaText.trim() === '')
    return {
      state: 'unjudged',
      ageMs: null,
      why: '锁目录在场但 meta 读不到 ⇒ 未判定(既不读成空闲,也不读成停滞)',
    }
  let meta
  try {
    meta = JSON.parse(metaText)
  } catch (e) {
    return {
      state: 'unjudged',
      ageMs: null,
      why: `meta JSON 坏:${String(e?.message ?? e).slice(0, 80)}`,
    }
  }
  const ts = Number(meta?.ts)
  const pid = Number.isFinite(Number(meta?.pid)) ? Number(meta.pid) : null
  if (!Number.isFinite(ts))
    return { state: 'unjudged', ageMs: null, why: 'meta.ts 取不到 ⇒ 锁龄算不出,不猜' }
  const ageMs = Math.max(0, nowMs - ts)
  const cap = Number(stallMs)
  if (!Number.isFinite(cap) || cap <= 0)
    return {
      state: 'unjudged',
      ageMs,
      why: `停滞门限不是正毫秒数(现值 ${JSON.stringify(stallMs)})⇒ 不判停滞也不放行`,
    }
  const hasPidStart = typeof meta?.pidStart === 'string' ? meta.pidStart !== '' : meta?.pidStart != null
  // 心跳:mtime 明显新于 ts ⇒ 有人在做续期,这一条通道还活着
  const freshBeat =
    Number.isFinite(Number(metaMtimeMs)) && Number(metaMtimeMs) - ts > 60_000 ? true : false
  const alive = typeof pidAlive === 'function' && pid !== null ? pidAlive(pid) : null

  if (ageMs < cap)
    return {
      state: 'held',
      ageMs,
      pid,
      why: `持有者持有 ${Math.round(ageMs / 1000)}s,未到门限 ${Math.round(cap / 1000)}s`,
    }
  if (alive === false)
    return {
      state: 'residual',
      ageMs,
      pid,
      why: `持有者 pid=${pid} 已退出而锁未交还(残留)⇒ 回收仍由 git-lock 原语按"pid 已死 ∧ 龄超 staleMs"裁决,本档只点名`,
    }
  if (alive === null)
    return {
      state: 'unjudged',
      ageMs,
      pid,
      why: `锁龄 ${Math.round(ageMs / 1000)}s 超门限,但持有者死活取不到 ⇒ 未判定(不喊"停滞",也不喊"正常")`,
    }
  // 挂死(wedged)排在 stall/stall-heartbeat 之前判:它是"活着、但不做事"的那一型,
  // 只有 CPU 增量能把它与"合法长活"分开,而这一维**不依赖 pidStart**(本机现读:meta 缺 pidStart ⇒
  // 身份三元组那条路永远走不到,而 45 秒零 CPU 增量 + 孩子 `git cat-file --batch` 0.03s 是可得的)。
  // 采样间隔不足 ⇒ 不算证据(单次读数什么也证明不了,§"单次成功不构成不需要证据"同一条纪律)。
  const gap = Number(cpuSampleGapMs)
  // ⚠️ 必须先把 null/undefined 挡在 Number() 之前:`Number(null) === 0`,而 0 又同时满足
  // `delta >= 0` 与 `delta < CPU_ALIVE_DELTA_MS` ⇒ "取不到 CPU 增量"会被读成"增量为 0"⇒ 判挂死。
  // 取不到就是取不到(§0.3):那一档只能落回 stall/stall-heartbeat,绝不能凭缺省喊死锁,
  // 否则探针一坏,这档就成了批量假 critical 的发生器。
  const delta = cpuDeltaMs === null || cpuDeltaMs === undefined ? Number.NaN : Number(cpuDeltaMs)
  if (
    alive === true &&
    Number.isFinite(gap) &&
    gap >= CPU_MIN_GAP_MS &&
    Number.isFinite(delta) &&
    delta >= 0 &&
    delta < CPU_ALIVE_DELTA_MS
  )
    return {
      state: 'wedged',
      ageMs,
      pid,
      identityVerifiable: hasPidStart,
      cpuDeltaMs: delta,
      cpuSampleGapMs: gap,
      why:
        `持有者 pid=${pid} 活着但进程树在 ${Math.round(gap / 1000)}s 采样间隔内 CPU 增量仅 ${delta}ms` +
        `(<${CPU_ALIVE_DELTA_MS}ms)⇒ 两边都在等,不是在慢慢做;锁龄 ${Math.round(ageMs / 1000)}s。` +
        (hasPidStart ? '' : '且 meta 缺 pidStart ⇒ 身份不可核,只有这一维还能判。') +
        '回收决定仍归 git-lock 原语,本档只喊人 —— 不因为等不到就削拒抢。',
    }
  return {
    state: freshBeat ? 'stall-heartbeat' : 'stall',
    ageMs,
    pid,
    identityVerifiable: hasPidStart,
    why:
      `持有者 pid=${pid} 活着且锁龄 ${Math.round(ageMs / 1000)}s ≥ 门限 ${Math.round(cap / 1000)}s` +
      (freshBeat ? '(有心跳续期 ⇒ 它可能真在做长活,仍要喊:等待方已全线停摆)' : '(无心跳续期)') +
      (hasPidStart
        ? ''
        : ';meta 缺 pidStart ⇒ 身份永远不可核,等待方连"确证 pid 被复用"这条唯一例外都走不到'),
  }
}

/**
 * @param cpuDeltaMs   持有者进程树在采样间隔内消耗的 CPU 毫秒数(null ⇒ 取不到)
 * @param cpuSampleGapMs 两次采样的墙钟间隔(必须 ≥ CPU_MIN_GAP_MS 才算证据)
 * 立因(本机现读 2026-11-06 05:07Z):持锁 46 分钟不动的那枚,45 秒内 CPU = 1.96875 → 1.96875
 * (零增量),它唯一的孩子 `git cat-file --batch` 也只有 0.03s —— **两边都在等,不是在慢慢做**。
 * 而 meta 缺 `pidStart` 时,身份三元组那条路永远走不到"确证 pid 被复用"的唯一例外。
 * CPU 增量这一维不受 `pidStart` 是否存在的影响,所以它是这一型里唯一可核的证据。
 */
export const CPU_MIN_GAP_MS = 20_000
export const CPU_ALIVE_DELTA_MS = 250

/**
 * 该不该喊:三种"该喊"的状态里,`stall` 是硬停摆(要喊),`stall-heartbeat` 与 `residual` 也喊,
 * 而 `wedged` 是这一档里最硬的一型(持有者活着但进程树零 CPU 增量)。**必须最先判它**:
 * 否则一个合法长活(有心跳、在耗 CPU)与一个死锁(什么都不动)会落进同一个读数。
 * `held`/`free` 不喊,`unjudged` **不喊成告警**——它只在读数里点名(§0.3:未判定不等于通过,
 * 也不等于事故)。
 */
export function shouldAnnounceLockStall(verdict) {
  const s = String(verdict?.state ?? '')
  return s === 'stall' || s === 'stall-heartbeat' || s === 'residual' || s === 'wedged'
}

/**
 * 台账那一维的固定契约(键一律 ASCII、时刻一律 ISO —— 与 §5e-3 发信台账同一条口径,
 * 否则"量得到"的那一步会被码页吃掉)。这一档为什么要落账而不只打 stderr:
 * 落地器每次都是一枚新进程,上一班喊过的停摆下一班看不见 ⇒ 没有账面就没人知道这型已经连着多少班。
 */
export const STALL_LEDGER_REL = '.ihui-agent/state/landing-lock-stall.jsonl'
export const STALL_SOURCE = 'object-space-land'

const STALL_STATES = ['free', 'held', 'stall', 'stall-heartbeat', 'residual', 'wedged', 'unjudged']

/** 门限取值:env 优先,坏值/缺省一律回落实测标定的缺省,并把"为什么没吃到旗"如实带回去。 */
export function resolveStallMs(env = process.env) {
  const raw = env ? env[LOCK_STALL_ENV] : undefined
  if (raw === undefined || raw === '') return { stallMs: LOCK_STALL_DEFAULT_MS, why: '' }
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0)
    return {
      stallMs: LOCK_STALL_DEFAULT_MS,
      why: `${LOCK_STALL_ENV}=${String(raw).slice(0, 24)} 不是正数 ⇒ 按缺省 ${LOCK_STALL_DEFAULT_MS}ms(不读成"无限大",也不读成"0 即立刻喊")`,
    }
  return { stallMs: n, why: '' }
}

/**
 * 一行账面(纯函数):把判据结论折成机读行。**未知态不伪装成任何已知态**,而是拒绝出行
 * (返回 null ⇒ 调用方一行都不写,并把拒绝原因喊出来;写一行假 state 比不写更坏,§0.3/§0.10)。
 */
export function buildStallRow({ nowIso, unitId = '', verdict = null, waitedMs = null, source = STALL_SOURCE } = {}) {
  const state = String(verdict?.state ?? '')
  if (!STALL_STATES.includes(state)) return null
  if (typeof nowIso !== 'string' || nowIso === '') return null
  return {
    at: nowIso,
    source,
    unitId: String(unitId || ''),
    state,
    ageMs: Number.isFinite(Number(verdict.ageMs)) ? Number(verdict.ageMs) : null,
    pid: Number.isFinite(Number(verdict.pid)) ? Number(verdict.pid) : null,
    identityVerifiable: verdict.identityVerifiable === true,
    waitedMs: Number.isFinite(Number(waitedMs)) ? Number(waitedMs) : null,
  }
}

export const __test__ = {
  judgeLandingLock,
  shouldAnnounceLockStall,
  resolveStallMs,
  buildStallRow,
  STALL_LEDGER_REL,
  STALL_SOURCE,
  LOCK_STALL_DEFAULT_MS,
  LOCK_STALL_ENV,
  CPU_MIN_GAP_MS,
  CPU_ALIVE_DELTA_MS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
