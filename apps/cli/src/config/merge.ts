/**
 * deepMerge 核心算法 — 对齐 Rust deep_merge_toml 语义。
 *
 * 规则:
 *   - 两边都是 plain object(非数组,非 null)→ 递归合并(兄弟键保留)
 *   - 否则 → override 整体覆盖 base(标量/数组/Date 等都直接替换)
 *   - undefined 视为不存在(不写入结果)
 *   - null 视为显式清除(写入结果,允许用户用 null 覆盖下层)
 */

/** JSON 兼容值类型(递归定义) */
export type Json = string | number | boolean | null | Json[] | { [k: string]: Json }

/** 判断是否为 plain object(非 null,非数组) */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** deepMerge 内部实现,基于 unknown 类型做递归 */
function deepMergeInternal(base: unknown, override: unknown): unknown {
  // override 为 undefined 时视为不存在,保留 base
  if (override === undefined) return base
  // 两边都是 plain object → 递归合并(兄弟键保留)
  if (isPlainObject(base) && isPlainObject(override)) {
    const result: Record<string, unknown> = { ...base }
    for (const [k, v] of Object.entries(override)) {
      // undefined 视为不存在,跳过不写入
      if (v === undefined) continue
      const bv = base[k]
      // 两边都是 plain object → 递归;否则 override 整体覆盖(含 null/标量/数组)
      result[k] = isPlainObject(bv) && isPlainObject(v) ? deepMergeInternal(bv, v) : v
    }
    return result
  }
  // 否则 override 整体覆盖 base(标量/数组/null/Date 等)
  return override
}

/**
 * 深合并两个值:override 覆盖 base。
 * - 对象递归合并,标量/数组/null 整体替换。
 * - undefined 不写入,null 显式清除。
 */
export function deepMerge<T>(base: T, override: T): T {
  return deepMergeInternal(base, override) as T
}

/**
 * 多层依次合并(从低到高,后者胜)。
 * 空列表返回空对象(调用方需保证至少传入 defaults 层)。
 */
export function deepMergeAll<T>(...layers: T[]): T {
  if (layers.length === 0) return {} as T
  let acc: unknown = layers[0]
  for (let i = 1; i < layers.length; i++) {
    acc = deepMergeInternal(acc, layers[i])
  }
  return acc as T
}
