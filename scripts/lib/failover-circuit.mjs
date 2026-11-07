// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 源站故障切换的熔断裁决。
 *
 * 失败窗口、基础设施失败阈值、打开时长都由调用方传入，本函数不内置任何数字阈值。
 * 失败次数没量到时保持未判定，不得按零次失败判闭合。
 * 受信源列表已经量到但为空时，任何来源都拒绝。
 * 探测退避只核对接住的三档是否为有限非负数，不在这里挑选等待时长。
 */

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

/** 有限正数。零、负数、无穷和非数字都算没量到。 */
function isFinitePositive(value) {
  return isFiniteNumber(value) && value > 0
}

/** 有限非负数。零合法，负数、无穷和非数字都算没量到。 */
function isFiniteNonNegative(value) {
  return isFiniteNumber(value) && value >= 0
}

/**
 * @param {object} input
 * @param {unknown} input.schemaVersion
 * @param {unknown} input.origin
 * @param {unknown} input.trustedOrigins
 * @param {unknown} input.nowMs
 * @param {unknown} input.failureWindowMs
 * @param {unknown} input.infraFailureThreshold
 * @param {unknown} input.openDurationMs
 * @param {unknown} input.failedProbeBackoffMs
 * @param {unknown} input.failures
 * @param {unknown} input.lastOpenedAt
 * @returns {{ disposition: 'unjudged' | 'refused' | 'open' | 'closed', reason: string }}
 */
export function judgeFailover(input) {
  if (input === null || typeof input !== 'object') {
    return { disposition: 'unjudged', reason: 'schema-unmeasured' }
  }

  const {
    schemaVersion,
    origin,
    trustedOrigins,
    nowMs,
    failureWindowMs,
    infraFailureThreshold,
    openDurationMs,
    failedProbeBackoffMs,
    failures,
    lastOpenedAt,
  } = input

  // 形状版本不是数字 1 时，后面的字段语义都还没量到。
  if (typeof schemaVersion !== 'number' || schemaVersion !== 1) {
    return { disposition: 'unjudged', reason: 'schema-unmeasured' }
  }

  if (!Array.isArray(trustedOrigins)) {
    return { disposition: 'unjudged', reason: 'origins-unmeasured' }
  }

  // 空数组是已量到且没有受信源，任何来源都走拒绝，不回落成未判定。
  if (typeof origin !== 'string' || origin.length === 0 || !trustedOrigins.includes(origin)) {
    return { disposition: 'refused', reason: 'origin-untrusted' }
  }

  if (
    !isFinitePositive(failureWindowMs) ||
    !isFinitePositive(infraFailureThreshold) ||
    !isFinitePositive(openDurationMs)
  ) {
    return { disposition: 'unjudged', reason: 'circuit-unmeasured' }
  }

  // 三档是入参形状，不是熔断阈值。
  if (
    !Array.isArray(failedProbeBackoffMs) ||
    failedProbeBackoffMs.length !== 3 ||
    failedProbeBackoffMs.some((slot) => !isFiniteNonNegative(slot))
  ) {
    return { disposition: 'unjudged', reason: 'backoff-unmeasured' }
  }

  // 缺失、null、非数组都不得当成零次失败。
  if (failures === null || !Array.isArray(failures)) {
    return { disposition: 'unjudged', reason: 'failures-unmeasured' }
  }

  if (failures.some((at) => !isFiniteNumber(at))) {
    return { disposition: 'unjudged', reason: 'failures-unmeasured' }
  }

  if (!isFiniteNumber(nowMs)) {
    return { disposition: 'unjudged', reason: 'time-unmeasured' }
  }

  // 未来时刻不计入窗口；窗口右端与左端都含边界。
  const failuresInWindow = failures.filter(
    (at) => at <= nowMs && nowMs - at <= failureWindowMs,
  ).length

  if (failuresInWindow >= infraFailureThreshold) {
    return { disposition: 'open', reason: 'failure-threshold' }
  }

  if (isFiniteNumber(lastOpenedAt)) {
    if (nowMs < lastOpenedAt + openDurationMs) {
      return { disposition: 'open', reason: 'open-duration' }
    }
  } else if (lastOpenedAt !== null) {
    return { disposition: 'unjudged', reason: 'time-unmeasured' }
  }

  return { disposition: 'closed', reason: 'within-bounds' }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
