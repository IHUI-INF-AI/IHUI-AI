// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { DEFAULT_LOCK_ACQUIRE_WINDOW_MS, DEFAULT_STALE_LOCK_TTL_MS } from './constants'

/**
 * 批量护栏锁的纯时序判据(对方形态:锁 2000ms / 陈旧锁 5min,取证见
 * W1-workbuddy-main.md §2 表 #9)。本层只做时刻算术,锁文件的读写留在端内 adapter。
 * 三态之外补一档 undetermined:时刻取不到/时钟回拨 ⇒ 未判定(§0.3),不猜"锁是死的"。
 */
export type LockDecision = 'acquired' | 'busy' | 'stale-reclaimed' | 'undetermined'

export interface LockJudgement {
  readonly decision: LockDecision
  readonly reason?: string
  /** busy 时的建议重试等待(毫秒);acquired/stale-reclaimed 无此键 */
  readonly retryAfterMs?: number
}

export function decideLock(opts: {
  /** 当前时刻(epoch ms) */
  nowMs: number
  /** 锁的持有戳;null/undefined = 无人持锁 */
  lockStampMs: number | null | undefined
  acquireWindowMs?: number
  staleTtlMs?: number
}): LockJudgement {
  const window = opts.acquireWindowMs ?? DEFAULT_LOCK_ACQUIRE_WINDOW_MS
  const staleTtl = opts.staleTtlMs ?? DEFAULT_STALE_LOCK_TTL_MS

  if (opts.lockStampMs === null || opts.lockStampMs === undefined) {
    return { decision: 'acquired' }
  }
  if (!Number.isFinite(opts.nowMs) || !Number.isFinite(opts.lockStampMs)) {
    return { decision: 'undetermined', reason: '锁时刻或当前时刻不可解析:未判定,不猜锁的生死' }
  }
  const elapsed = opts.nowMs - opts.lockStampMs
  if (elapsed < 0) {
    return {
      decision: 'undetermined',
      reason: `时钟回拨(锁戳在未来 ${-elapsed}ms):未判定,不据此回收锁`,
    }
  }
  if (elapsed >= staleTtl) {
    return {
      decision: 'stale-reclaimed',
      reason: `锁已 ${elapsed}ms 未续,超过陈旧线 ${staleTtl}ms:可回收`,
    }
  }
  return {
    decision: 'busy',
    reason: elapsed < window ? '他席刚持锁(抢占窗口内):稍候重试' : '锁存活(未达陈旧线):不得抢',
    retryAfterMs:
      elapsed < window ? Math.max(1, window - elapsed) : Math.max(1, staleTtl - elapsed),
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
