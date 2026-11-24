// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 传输层名额契约。
 *
 * 超时 20000 毫秒，并发 128，异步上限 127，排队 8192。
 * 优先级只有 low、normal、high 三档：只核对是否量到，不按优先级插队，也不改放行结果。
 * 同步请求恒留一格，不被异步占满。异步已有 127 且同步为 0 时，总数 127 仍小于 128，同步放行，异步拒绝。
 * 本层只管传输名额，不做语义裁决。
 * 计数必须是有限非负整数。null 不是 0。任一量不到则未判定，不得放行。
 */

export const BROKER_TIMEOUT_MS = 20000
export const BROKER_CONCURRENCY = 128
export const BROKER_ASYNC_CAP = 127
export const BROKER_QUEUE_CAP = 8192
export const BROKER_PRIORITIES = Object.freeze(['low', 'normal', 'high'])

/** 有限非负整数。null、小数、负数、无穷和非数字都算没量到。 */
function isLegalCount(value) {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0
}

/**
 * @param {object} input
 * @param {unknown} input.kind
 * @param {unknown} input.priority
 * @param {unknown} input.inflightSync
 * @param {unknown} input.inflightAsync
 * @param {unknown} input.queued
 * @returns {{ disposition: 'unjudged' | 'refused' | 'admitted', reason: string, admit: boolean }}
 */
export function admitBrokerSlot(input) {
  const record = input !== null && typeof input === 'object' ? input : {}
  const { kind, priority, inflightSync, inflightAsync, queued } = record

  if (kind !== 'sync' && kind !== 'async') {
    return { disposition: 'unjudged', reason: 'kind-unmeasured', admit: false }
  }
  if (!BROKER_PRIORITIES.includes(priority)) {
    return { disposition: 'unjudged', reason: 'priority-unmeasured', admit: false }
  }
  if (!isLegalCount(inflightSync) || !isLegalCount(inflightAsync) || !isLegalCount(queued)) {
    return { disposition: 'unjudged', reason: 'count-unmeasured', admit: false }
  }
  if (queued >= BROKER_QUEUE_CAP) {
    return { disposition: 'refused', reason: 'queue-full', admit: false }
  }
  if (
    kind === 'async' &&
    (inflightAsync >= BROKER_ASYNC_CAP || inflightSync + inflightAsync >= BROKER_CONCURRENCY)
  ) {
    return { disposition: 'refused', reason: 'async-cap', admit: false }
  }
  if (kind === 'sync' && inflightSync + inflightAsync >= BROKER_CONCURRENCY) {
    return { disposition: 'refused', reason: 'concurrency-full', admit: false }
  }
  return { disposition: 'admitted', reason: 'slot-free', admit: true }
}

/**
 * @param {unknown} elapsedMs
 * @returns {{ disposition: 'unjudged' | 'expired' | 'within', reason: string }}
 */
export function judgeBrokerTimeout(elapsedMs) {
  if (typeof elapsedMs !== 'number' || !Number.isFinite(elapsedMs)) {
    return { disposition: 'unjudged', reason: 'time-unmeasured' }
  }
  if (elapsedMs < 0) {
    return { disposition: 'unjudged', reason: 'time-inverted' }
  }
  if (elapsedMs >= BROKER_TIMEOUT_MS) {
    return { disposition: 'expired', reason: 'timeout' }
  }
  return { disposition: 'within', reason: 'before-timeout' }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
