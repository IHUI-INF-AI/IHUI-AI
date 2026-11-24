// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 服务占位记录的纯裁决。
 *
 * 记录只认四个字段：id、port、pid、timestamp。
 * 本函数不探测进程、不发信号，只接收调用方已经判好的存活动词。
 * 字段或时刻没量到是未判定，不得当成陈旧；存活动词没量到不得当成还活着。
 */

export const STALE_AFTER_MS = 30000
export const FUTURE_TOLERANCE_MS = 5000

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0
}

/** 有限正整数。零、负数、小数、非数字都算没量到。 */
function isFinitePositiveInteger(value) {
  return Number.isInteger(value) && value > 0
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * @param {{ record?: unknown, nowMs?: unknown, alive?: unknown }} input
 * @returns {{ disposition: 'unjudged' | 'stale' | 'dead' | 'live', reason: string }}
 */
export function judgeServiceClaim({ record, nowMs, alive } = {}) {
  if (
    !isPlainObject(record) ||
    !isNonEmptyString(record.id) ||
    !isFinitePositiveInteger(record.port) ||
    !isFinitePositiveInteger(record.pid) ||
    !isFiniteNumber(record.timestamp)
  ) {
    return { disposition: 'unjudged', reason: 'record-unmeasured' }
  }

  if (!isFiniteNumber(nowMs)) {
    return { disposition: 'unjudged', reason: 'time-unmeasured' }
  }

  if (record.timestamp > nowMs + FUTURE_TOLERANCE_MS) {
    return { disposition: 'unjudged', reason: 'time-inverted' }
  }

  // 超窗先于存活动词：心跳过期就是陈旧，即使调用方报进程还在。
  if (nowMs - record.timestamp > STALE_AFTER_MS) {
    return { disposition: 'stale', reason: 'heartbeat-stale' }
  }

  if (typeof alive !== 'boolean') {
    return { disposition: 'unjudged', reason: 'liveness-unmeasured' }
  }

  if (alive === false) {
    return { disposition: 'dead', reason: 'process-dead' }
  }

  if (
    record.timestamp >= nowMs - STALE_AFTER_MS &&
    record.timestamp <= nowMs + FUTURE_TOLERANCE_MS
  ) {
    return { disposition: 'live', reason: 'heartbeat-fresh' }
  }

  return { disposition: 'unjudged', reason: 'record-unmeasured' }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
