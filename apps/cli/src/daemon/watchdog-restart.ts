// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * B4-11 崩溃看门狗重启腿(2026-11-28 立)。
 *
 * ## 立因
 *
 * 看门狗(WATCHDOG_RESTART)有两半:前半是「发现它死了」,后半是「决定要不要拉起来」。
 * 本仓已有 `orphan_guard.rs` / `parent-bound.ts` 做前半,但**后半一直是缺的** ——
 * 崩溃后直接重启会掉进崩溃循环:进程因某个确定性 bug 一启动就崩,看门狗每次拉起来、
 * 每次再崩,结果是日志被刷爆、用户的机器持续烤 CPU,而问题一次也没被暴露出来。
 *
 * 故本模块只做后半的判据:**滑动窗口内的重启预算** + **时钟倒退保护** + **退避**。
 *
 * ## 判据
 *
 * 1. 窗口内重启次数达到上限 ⇒ `refuse`(带 `budget_exhausted` 与已用次数),**不静默重启**;
 * 2. 时钟倒退(now < 最近一次重启时刻)⇒ `unjudged`,**不重启也不判拒绝** ——
 *    时钟不可信时任何"窗口"判断都是假的,只能明报未判定;
 * 3. 首次重启零延迟,第二次起退避(同一次崩溃风暴内的密集重启最危险);
 * 4. 事件数组里的非有限数/非数字一律丢弃(**不抛**),否则一个脏时间戳能让整次判活失败。
 *
 * 刻意不做:不 spawn / 不 sleep / 不读系统时钟 —— 时间由调用方注入,
 * 真正拉起进程由 `spawnDetachedSupervisor` 那类 runner 做,本模块只回答"该不该拉"。
 */

/** 默认滑动窗口:10 分钟。太短会把"偶发崩溃"误判成循环,太长会放过真循环。 */
export const WATCHDOG_WINDOW_MS = 10 * 60_000

/** 默认窗口内允许的重启次数。3 次是经验值:一次偶发、一次重试、一次机会。 */
export const WATCHDOG_MAX_RESTARTS = 3

/** 首次重启零延迟;其后按此序列退避,末端封顶。 */
export const WATCHDOG_BACKOFF_MS: readonly number[] = [0, 1_000, 5_000, 15_000, 60_000]

export type RestartVerdict = 'restart' | 'refuse' | 'unjudged'

export type RestartReason =
  | 'ok'
  | 'budget_exhausted'
  | 'clock_backwards'
  | 'unjudged_input'

export interface RestartBudgetState {
  readonly used: number
  readonly remaining: number
  readonly allowed: boolean
}

export interface RestartDecision {
  readonly verdict: RestartVerdict
  readonly reason: RestartReason
  readonly delayMs: number
  readonly used: number
  readonly detail: string
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * 丢弃脏事件:非有限数直接跳过。返回按时间升序排好的干净数组(不改入参)。
 */
export function sanitizeRestartEvents(events: unknown): number[] {
  if (!Array.isArray(events)) return []
  const clean: number[] = []
  for (const item of events) {
    if (isFiniteNumber(item)) clean.push(item)
  }
  return clean.sort((a, b) => a - b)
}

/**
 * 统计窗口内的重启预算。窗口是 **[now - windowMs, now]** 闭区间。
 *
 * 时间戳落在窗口右边界之外(未来)的按脏数据处理 —— 未来时间戳会让窗口判断失效。
 */
export function restartBudget(
  events: unknown,
  now: unknown,
  options: { windowMs?: unknown; maxRestarts?: unknown } = {},
): RestartBudgetState {
  const windowMs = isFiniteNumber(options.windowMs) && options.windowMs > 0
    ? options.windowMs
    : WATCHDOG_WINDOW_MS
  const maxRestarts = isFiniteNumber(options.maxRestarts) && options.maxRestarts >= 1
    ? Math.floor(options.maxRestarts)
    : WATCHDOG_MAX_RESTARTS

  if (!isFiniteNumber(now)) {
    return { used: 0, remaining: maxRestarts, allowed: false }
  }

  const clean = sanitizeRestartEvents(events).filter((t) => t <= now && t >= now - windowMs)
  const used = clean.length
  return {
    used,
    remaining: Math.max(0, maxRestarts - used),
    allowed: used < maxRestarts,
  }
}

/**
 * 判这次崩溃该不该拉起(纯判据)。
 *
 * 判序:
 *   1 now / events 取不到合法值      ⇒ unjudged / unjudged_input
 *   2 最近一次重启晚于 now          ⇒ unjudged / clock_backwards(不拒绝,明报未判定)
 *   3 窗口内已用达到上限             ⇒ refuse / budget_exhausted
 *   4 其余                            ⇒ restart,delay 按同窗口内的第几次决定
 */
export function watchdogRestart(
  input: {
    events?: unknown
    now: unknown
    windowMs?: unknown
    maxRestarts?: unknown
  },
): RestartDecision {
  const now = input?.now
  if (!isFiniteNumber(now)) {
    return {
      verdict: 'unjudged',
      reason: 'unjudged_input',
      delayMs: 0,
      used: 0,
      detail: 'now 不是有限数(取不到),点名:需注入毫秒时间戳,不猜当前时刻',
    }
  }

  const clean = sanitizeRestartEvents(input?.events)
  const last = clean.length > 0 ? clean[clean.length - 1] : null
  if (typeof last === 'number' && last > now) {
    return {
      verdict: 'unjudged',
      reason: 'clock_backwards',
      delayMs: 0,
      used: 0,
      detail: `最近一次重启(${last})晚于当前时刻(${now}),时钟不可信,不判重启也不判拒绝`,
    }
  }

  const budget = restartBudget(input?.events, now, {
    windowMs: input?.windowMs,
    maxRestarts: input?.maxRestarts,
  })

  if (!budget.allowed) {
    return {
      verdict: 'refuse',
      reason: 'budget_exhausted',
      delayMs: 0,
      used: budget.used,
      detail: `窗口内已重启 ${budget.used} 次,达到上限,拒绝再拉 —— 崩溃循环需人看日志`,
    }
  }

  const backoffMs =
    WATCHDOG_BACKOFF_MS[Math.min(budget.used, WATCHDOG_BACKOFF_MS.length - 1)] ??
    WATCHDOG_BACKOFF_MS[WATCHDOG_BACKOFF_MS.length - 1] ??
    0
  const delayMs = budget.used === 0 ? 0 : backoffMs

  return {
    verdict: 'restart',
    reason: 'ok',
    delayMs,
    used: budget.used,
    detail: budget.used === 0
      ? '窗口内首次重启,零延迟拉起'
      : `窗口内第 ${budget.used + 1} 次重启,退避 ${delayMs}ms 后再拉起`,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
