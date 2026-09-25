// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

/** 层叠输入的一层(A19 出处采集用):层名 + 该层值 + 可选磁盘来源文件 */
export interface ConfigLayerInput<T> {
  layer: string
  value: T
  /** 该层值来自磁盘文件时记录其绝对路径;非磁盘层省略 */
  originFile?: string
}

/** 单个键的一条出处记录:某一层为该键给出的值 */
export interface ConfigSourceEntry {
  layer: string
  value: unknown
  originFile?: string
}

/**
 * 层叠出处采集(A19)—— 与 deepMergeAll 同层序(优先级升序传入),但**不做合并**,
 * 只为每个点分叶子路径记录"哪些层给出了值":
 * - 返回条目数组按优先级**降序**(最高层在前),长度 = 实际贡献该键的层数(不压成一条);
 * - 仅叶子值(非 plain object)计为贡献;undefined 视为未给出(与 deepMerge 口径一致);
 * - null 是显式清除,照计为一条贡献。
 * 本函数只读,不参与任何现有读取路径(无贡献记录时 deepMergeAll 行为逐字不变)。
 */
export function collectLayerContributions<T extends object>(
  layers: readonly ConfigLayerInput<Partial<T>>[],
): Map<string, ConfigSourceEntry[]> {
  const acc = new Map<string, ConfigSourceEntry[]>()
  const walk = (
    value: unknown,
    prefix: string,
    base: { layer: string; originFile?: string },
  ): void => {
    if (isPlainObject(value)) {
      for (const [k, v] of Object.entries(value)) {
        // undefined 视为不存在(与 deepMergeInternal 同口径),不记为贡献
        if (v === undefined) continue
        walk(v, prefix ? `${prefix}.${k}` : k, base)
      }
      return
    }
    if (prefix === '') return
    const entry: ConfigSourceEntry = { layer: base.layer, value }
    if (base.originFile !== undefined) entry.originFile = base.originFile
    const list = acc.get(prefix)
    if (list) list.push(entry)
    else acc.set(prefix, [entry])
  }
  for (const l of layers) walk(l.value, '', { layer: l.layer, originFile: l.originFile })
  // layers 按优先级升序入栈 ⇒ 反转为降序(最高优先级在前)
  for (const list of acc.values()) list.reverse()
  return acc
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
