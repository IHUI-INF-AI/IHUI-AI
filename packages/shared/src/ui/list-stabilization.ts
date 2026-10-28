// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 派生列表的引用稳定化与版本 bump 去重(端中立纯函数,G-108)。
 *
 * 为什么存在:派生列表(过滤/映射/合并出来的那一份)每帧都是新构造的数组与新对象,
 * 只要"内容其实没变"却换了引用,订阅整张列表的组件就整列表重渲染 —— 即"闪一下"。
 * 判等若用 `JSON.stringify(x)`,同内容不同键序恒不等(构造期 `...(c ? {k:v} : {})`
 * 这类写法让键序成为实现细节),稳定化会静默退化成"每帧全新引用",不报错、无日志、无指标。
 * 所以判等必须按键序无关的结构比较,且 `undefined` 与"键缺失"同视。
 *
 * 版本 bump 侧同理:多条链路对同一件事各 bump 一次时,只有拿得到**可靠内容**才允许去重;
 * 内容拿不到(调用方没给 meta)时一律放行并计数上报,绝不把"判不出"写成"没问题"。
 */

/** 只把"普通记录"当结构比较的对象:原型为 Object.prototype 或 null,且非数组。 */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  const proto: unknown = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/** 键序无关的排序后自有键,值为 `undefined` 的键与"键不存在"同视(故被剔除)。 */
function presentKeys(record: Record<string, unknown>): string[] {
  return Object.keys(record)
    .filter((k) => record[k] !== undefined)
    .sort()
}

/**
 * 非普通对象(Map/Date/Set/类实例/函数)一律按引用判等 —— 结构与私有语义不在射程内,
 * 猜它们会把"内容变了"读成"没变",这正是本模块要防的那一型失效。
 */
export function structurallyEqualIgnoringKeyOrder(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true
  }
  if (typeof a === 'number' && typeof b === 'number') {
    return Number.isNaN(a) && Number.isNaN(b)
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false
    }
    return a.every((item, i) => structurallyEqualIgnoringKeyOrder(item, b[i]))
  }
  if (isPlainRecord(a) && isPlainRecord(b)) {
    const keysA = presentKeys(a)
    const keysB = presentKeys(b)
    if (keysA.length !== keysB.length || !keysA.every((k, i) => k === keysB[i])) {
      return false
    }
    return keysA.every((k) => structurallyEqualIgnoringKeyOrder(a[k], b[k]))
  }
  return false
}

/** 内容 key:键序无关、`undefined` ≡ 键缺失;同内容必同串。 */
export function contentKeyOf(value: unknown): string {
  if (value === undefined) {
    return 'u'
  }
  if (value === null) {
    return 'n'
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => contentKeyOf(item)).join(',')}]`
  }
  if (isPlainRecord(value)) {
    return `{${presentKeys(value)
      .map((k) => `${k}:${contentKeyOf(value[k])}`)
      .join(',')}}`
  }
  if (typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value)
  }
  return `ref:${String(typeof value)}`
}

/**
 * 逐元素复用引用:结构与上一帧某项等值 ⇒ 拿回旧引用;整表等值 ⇒ 拿回 `prev` 本身
 * (所以调用方必须把返回值当只读列表用 —— 它就是上一帧那份数组)。
 * 返回的数组只含 next 的元素(引用可能来自 prev),故读取语义不变。
 */
export function stabilizeListItems<T>(prev: T[], next: readonly T[]): T[] {
  const out: T[] = new Array<T>(next.length)
  for (let i = 0; i < next.length; i += 1) {
    const nextItem = next[i] as T
    // 逐项与上一帧同位置比:结构等值即复用旧引用。列表是"尾部追加"形状时
    // (消息流、时间线)前缀全部命中;插入在中间则退化为逐项判等,不猜身份。
    const prevItem = prev[i] as T | undefined
    out[i] =
      i < prev.length && structurallyEqualIgnoringKeyOrder(prevItem, nextItem)
        ? (prevItem as T)
        : nextItem
  }
  return prev.length === next.length && out.every((item, i) => item === (prev[i] as T)) ? prev : out
}

export interface ListVersionGateOptions {
  /** 同一内容的重复 bump 在该窗口内只放行首个。 */
  windowMs: number
  /** 键上限,超出按插入序淘汰最旧(防长会话无界增长)。 */
  maxKeys?: number
  now?: () => number
}

export type ListVersionOutcome = 'bumped' | 'deduped' | 'passed-through'

export interface ListVersionBumpResult {
  outcome: ListVersionOutcome
  version: number
}

export interface ListVersionGateSnapshot {
  version: number
  dedupedCount: number
  /** 构造不出可靠内容 key 因而"放行不去重"的次数 —— 不得读成"已去重"。 */
  noContentKeyPassThrough: number
  trackedKeys: number
}

export interface ListVersionGate {
  /** 不带 meta(或 meta.content 为 null/undefined)= 判不出是否重复 ⇒ 放行并计数。 */
  bump(meta?: { readonly content: unknown }): ListVersionBumpResult
  snapshot(): ListVersionGateSnapshot
}

export const LIST_VERSION_GATE_DEFAULT_MAX_KEYS = 256

export function createListVersionGate(options: ListVersionGateOptions): ListVersionGate {
  const maxKeys = options.maxKeys ?? LIST_VERSION_GATE_DEFAULT_MAX_KEYS
  const now = options.now ?? (() => Date.now())
  const seenAtByKey = new Map<string, number>()
  let version = 0
  let dedupedCount = 0
  let noContentKeyPassThrough = 0

  /** 过期键惰性清理:每次 bump 先扫掉窗口外的记录,再判当前 key。 */
  function evictExpired(at: number): void {
    for (const [key, seenAt] of seenAtByKey) {
      if (at - seenAt > options.windowMs) {
        seenAtByKey.delete(key)
      }
    }
  }

  function bump(meta?: { readonly content: unknown }): ListVersionBumpResult {
    const content = meta?.content
    if (meta === undefined || content === undefined || content === null) {
      version += 1
      noContentKeyPassThrough += 1
      return { outcome: 'passed-through', version }
    }
    const at = now()
    evictExpired(at)
    const key = contentKeyOf(content)
    if (seenAtByKey.has(key)) {
      dedupedCount += 1
      return { outcome: 'deduped', version }
    }
    seenAtByKey.set(key, at)
    if (seenAtByKey.size > maxKeys) {
      const oldest = seenAtByKey.keys().next().value
      if (oldest !== undefined) {
        seenAtByKey.delete(oldest)
      }
    }
    version += 1
    return { outcome: 'bumped', version }
  }

  function snapshot(): ListVersionGateSnapshot {
    return { version, dedupedCount, noContentKeyPassThrough, trackedKeys: seenAtByKey.size }
  }

  return { bump, snapshot }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
