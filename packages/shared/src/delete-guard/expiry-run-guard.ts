// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import {
  DEFAULT_EXPIRY_MAX_STRIKES,
  DEFAULT_EXPIRY_QUARANTINE_MS,
  DEFAULT_EXPIRY_RUN_MIN_INTERVAL_MS,
  MAX_EXPIRY_QUARANTINE_MS,
} from './constants'

/**
 * 到期清理器自身的**死亡机制**(goal-b49 W7;AGENTS 附加强制条款「工作队列必须有死亡机制」)。
 *
 * 为什么单独一层:本票要治的正是"判据在、器物在、没人调度"(§0.9)。反过来还有第二型失效 ——
 * 器物装上了却天天失败、天天重试,把调度器和到人通道刷爆。所以清理器必须自带:
 * - 连败计数(streak):失败与"未判定"**同权**计入 —— 判不出就是这条腿没在干活(§0.10:
 *   失效方向恒为"多要一次定向说明",绝不能是"再多试一次");
 * - 退避封票:第 n 次连败封 quarantineMs * 2^(n-1),上限 MAX_EXPIRY_QUARANTINE_MS;
 * - 永久死亡:连败达 DEFAULT_EXPIRY_MAX_STRIKES ⇒ retired,此后 decide 恒返回 retired,
 *   **只有人工复位账目**(把 streak 归零并清 retiredAtIso)才能复活;器物不会自己爬起来。
 *
 * 纯判据、零 IO:账目(read/write JSON)由端内 adapter 负责;本层给 reducer,保证同一份算式只有一份。
 */

/** 一次运行的结局(由端内如实回报;`undetermined` = 计划判不出,不是"没事发生") */
export type ExpiryRunOutcome = 'ok' | 'failure' | 'undetermined'

/** 调度器可执行的四种闸态,外加"账目本身取不到/坏"这一档 */
export type ExpiryRunGate = 'run' | 'backoff' | 'quarantined' | 'retired' | 'undetermined'

/** 清理器运行账目(落点由端内决定,建议 `.ihui/delete-guard/expiry-run.json`) */
export interface ExpiryRunLedger {
  readonly streak: number
  readonly lastRunIso: string | null
  readonly quarantinedUntilIso: string | null
  /** 永久封票时刻;非 null ⇒ 该器物已死,不再自试 */
  readonly retiredAtIso: string | null
  readonly retiredReason?: string | null
}

export interface ExpiryRunDecision {
  readonly gate: ExpiryRunGate
  readonly reason: string
  readonly retryAfterMs?: number
  readonly streak: number
}

export interface ExpiryRunPolicy {
  readonly nowIso: string
  readonly minIntervalMs?: number
  readonly quarantineMs?: number
  readonly maxStrikes?: number
}

/** 空账目(首次运行/账目丢失)的起始态 —— 注意这不等于"上次成功过" */
export function initialExpiryLedger(): ExpiryRunLedger {
  return { streak: 0, lastRunIso: null, quarantinedUntilIso: null, retiredAtIso: null }
}

/** 账目形态宽容校验:坏 ⇒ false(调用方按未判定处理,不得当成空账目直接放行) */
export function isExpiryRunLedgerShape(value: unknown): value is ExpiryRunLedger {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  const streakOk =
    typeof v['streak'] === 'number' && Number.isFinite(v['streak']) && v['streak'] >= 0
  const stampOk = (x: unknown) => x === null || typeof x === 'string'
  return (
    streakOk &&
    stampOk(v['lastRunIso']) &&
    stampOk(v['quarantinedUntilIso']) &&
    stampOk(v['retiredAtIso'])
  )
}

function parseMs(iso: string | null | undefined): number | null {
  if (typeof iso !== 'string') return null
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? ms : null
}

/**
 * 这一轮能不能跑。时刻取不到 / 账目坏 / 时钟回拨 ⇒ `undetermined`(既不跑也不记绿,§0.3)。
 */
export function decideExpiryRun(ledger: unknown, policy: ExpiryRunPolicy): ExpiryRunDecision {
  const now = parseMs(policy.nowIso)
  if (now === null) {
    return {
      gate: 'undetermined',
      reason: `当前时刻不可解析(${String(policy.nowIso)}):未判定`,
      streak: -1,
    }
  }
  if (!isExpiryRunLedgerShape(ledger)) {
    return {
      gate: 'undetermined',
      reason: '运行账目取不到或形态不合法:未判定,不据此放行',
      streak: -1,
    }
  }
  const streak = Math.floor(ledger.streak)
  if (ledger.retiredAtIso !== null) {
    return {
      gate: 'retired',
      reason: `器物已永久封票(retiredAt=${ledger.retiredAtIso}${
        ledger.retiredReason ? `,${ledger.retiredReason}` : ''
      }):只许人工复位账目`,
      streak,
    }
  }
  const quarantinedUntilRaw = ledger.quarantinedUntilIso
  if (quarantinedUntilRaw !== null && parseMs(quarantinedUntilRaw) === null) {
    return {
      gate: 'undetermined',
      reason: `封票时刻不可解析(${String(quarantinedUntilRaw)}):未判定,不据此当作"已出封票"`,
      streak,
    }
  }
  const quarantinedUntil = parseMs(quarantinedUntilRaw)
  if (quarantinedUntil !== null && now < quarantinedUntil) {
    return {
      gate: 'quarantined',
      reason: `连败 ${streak} 次,封票至 ${quarantinedUntilRaw}`,
      retryAfterMs: quarantinedUntil - now,
      streak,
    }
  }
  const minInterval = policy.minIntervalMs ?? DEFAULT_EXPIRY_RUN_MIN_INTERVAL_MS
  const last = parseMs(ledger.lastRunIso)
  if (last !== null && last > now) {
    return { gate: 'undetermined', reason: '上次运行时刻在未来(时钟回拨):未判定', streak }
  }
  if (last !== null && minInterval > 0 && now - last < minInterval) {
    return {
      gate: 'backoff',
      reason: `距上次运行 ${now - last}ms < 最小间隔 ${minInterval}ms`,
      retryAfterMs: minInterval - (now - last),
      streak,
    }
  }
  return { gate: 'run', reason: '可运行', streak }
}

/**
 * 运行后写回的新账目。端内**必须**在跑完那一轮(含崩在中间被捕获)之后调用它,
 * 并把结果落盘 —— 不写账目的封票等于没有封票。
 */
export function nextExpiryLedger(
  ledger: unknown,
  outcome: ExpiryRunOutcome,
  policy: ExpiryRunPolicy,
): ExpiryRunLedger {
  const nowIso = policy.nowIso
  const base: ExpiryRunLedger = isExpiryRunLedgerShape(ledger) ? ledger : initialExpiryLedger()
  if (base.retiredAtIso !== null) {
    // 已死者不再累加,也绝不自愈
    return base
  }
  if (outcome === 'ok') {
    return { streak: 0, lastRunIso: nowIso, quarantinedUntilIso: null, retiredAtIso: null }
  }
  const maxStrikes = policy.maxStrikes ?? DEFAULT_EXPIRY_MAX_STRIKES
  const quarantineMs = policy.quarantineMs ?? DEFAULT_EXPIRY_QUARANTINE_MS
  const streak = Math.floor(base.streak) + 1
  if (streak >= maxStrikes) {
    return {
      streak,
      lastRunIso: nowIso,
      quarantinedUntilIso: null,
      retiredAtIso: nowIso,
      retiredReason: `连败 ${streak} 次(含未判定)达上限 ${maxStrikes}:永久封票`,
    }
  }
  const window = Math.min(quarantineMs * 2 ** (streak - 1), MAX_EXPIRY_QUARANTINE_MS)
  const until = parseMs(nowIso)
  if (until === null) {
    // 时刻解析不出 ⇒ 沿用旧封票窗(算不出新窗绝不等于"没有窗"):既不解除也不新封
    return {
      streak,
      lastRunIso: nowIso,
      quarantinedUntilIso: base.quarantinedUntilIso,
      retiredAtIso: null,
    }
  }
  return {
    streak,
    lastRunIso: nowIso,
    quarantinedUntilIso: new Date(until + window).toISOString(),
    retiredAtIso: null,
  }
}

/** 单行 ASCII 结论(供调度器日志;计数现读自账目,不复算) */
export function summarizeExpiryGate(d: ExpiryRunDecision): string {
  return (
    `TRASH-EXPIRY-GATE gate=${d.gate} streak=${d.streak}` +
    `${d.retryAfterMs === undefined ? '' : ` retryAfterMs=${d.retryAfterMs}`} reason=${d.reason}`
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
