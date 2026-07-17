/**
 * CLI 参数层解析 — 将 commander 已解析的 Record<string, unknown> 转为 Partial<Settings>。
 *
 * 规则:
 *   - 支持扁平键(apiUrl / apiKey / maxIterations 等)
 *   - 支持嵌套键(sampler.temperature / sandbox.profile / compactionV2.enabled)
 *   - undefined 视为未传入(不覆盖下层)
 *   - null 视为显式清除(写入结果)
 *   - 布尔值 true/false 透传
 *   - 数字字符串转 number,空字符串忽略
 */

import type { Settings } from '../commands/settings.js'

/**
 * 按 a.b.c 路径写入嵌套对象,中间节点不存在或非对象时自动创建为 {}。
 */
export function setNestedPath(
  target: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const keys = path.split('.')
  let curr: Record<string, unknown> = target
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i]!
    const next = curr[k]
    // 中间节点非对象(含 null/数组/标量)时覆盖为空对象
    if (typeof next !== 'object' || next === null || Array.isArray(next)) {
      curr[k] = {}
    }
    curr = curr[k] as Record<string, unknown>
  }
  const lastKey = keys[keys.length - 1]!
  curr[lastKey] = value
}

/**
 * 将 CLI 参数转为 Partial<Settings>。
 * - undefined 跳过(未传入),null 透传(显式清除)
 * - 空字符串跳过,纯数字字符串转 number
 * - 布尔值 true/false 透传,其他字符串保持原样
 */
export function parseCliOverrides(args: Record<string, unknown>): Partial<Settings> {
  const result: Record<string, unknown> = {}
  for (const [key, raw] of Object.entries(args)) {
    // undefined 视为未传入,不覆盖下层
    if (raw === undefined) continue
    let value: unknown = raw
    if (typeof raw === 'string') {
      // 空字符串忽略
      if (raw === '') continue
      const trimmed = raw.trim()
      // 纯数字字符串转 number(支持负数与小数,排除 hex/科学计数法)
      if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
        const n = Number(trimmed)
        if (Number.isFinite(n)) value = n
      }
    }
    // null / boolean / number / string 透传
    setNestedPath(result, key, value)
  }
  return result as unknown as Partial<Settings>
}
