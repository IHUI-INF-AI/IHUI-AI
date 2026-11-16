// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 边界校验与**错误归因分离**。
 *
 * ## 解决什么问题
 *
 * 我方 `asRpcError` 用一条正则把「消息里含 invalid / 不存在 / 必须」的错误
 * 一律折成 `-32602 Invalid params`。这在**入参**校验上是对的,但**返回值**校验
 * 失败时会把 bug 报成调用方的错:
 *
 *   服务端 handler 返回了不符合契约的对象 ⇒ 客户端收到 "Invalid params"
 *   ⇒ 客户端以为自己参数写错了,去改参数,永远查不出真正的问题。
 *
 * 对齐依据:WorkBuddy `通用子智能体日志规范` 的 `lib/module/validation.js`:
 *
 *     validateParams(...) ⇒ Invalid ${method} params: ${path}: ${message}   // 调用方错
 *     validateResult(...) ⇒ new JsonRpcError(internalError, "Invalid ... result")  // 服务端错
 *
 * 同一句 "Invalid",**两个边界归两个码**。这是本模块唯一但最要紧的事。
 *
 * ## 另三条可移植的纪律
 *
 * ① **错误文案封顶 2048 字符** —— schema 校验失败可能吐出几百条 issue,
 *    不封顶会撑爆日志与客户端渲染;
 * ② **issue 只取前 8 条** —— 人看得过来的量;剩下的报总数;
 * ③ **数组长度采样最多 16 项、遍历深度受限** —— 防止对超大载荷做
 *    "为了报错而遍历整个数组"的二次 OOM。
 */

/** 校验边界:入参还是返回值。**决定错误归到哪个码**。 */
export type ValidationBoundary = 'params' | 'result'

/** 一条结构化 issue。 */
export interface ValidationIssue {
  readonly code: string
  readonly message: string
  /** JSON Pointer 风格路径,如 `/steps/0/id`;根为 `$`。 */
  readonly path: string
}

export class BoundaryValidationError extends Error {
  readonly boundary: ValidationBoundary
  readonly method: string
  readonly issues: readonly ValidationIssue[]

  constructor(boundary: ValidationBoundary, method: string, issues: readonly ValidationIssue[]) {
    super(describeValidationError(boundary, method, issues))
    this.name = 'BoundaryValidationError'
    this.boundary = boundary
    this.method = method
    this.issues = issues
  }

  /**
   * 这条错误该归哪个 JSON-RPC 码。
   *
   * `params` ⇒ -32602(调用方改参数)
   * `result` ⇒ -32603(服务端改代码)
   *
   * 这个映射是本模块存在的理由:同一个 "Invalid" 字样,两个边界两个码。
   */
  get jsonRpcCode(): -32602 | -32603 {
    return this.boundary === 'params' ? -32602 : -32603
  }
}

/** issue 展示上限(人看得过来的量)。 */
export const MAX_ISSUES_SHOWN = 8
/** 错误文案字符上限。 */
export const MAX_MESSAGE_CHARS = 2048
/** 数组采样上限。 */
export const MAX_ARRAY_SAMPLE = 16

/** 把路径段拼成 JSON Pointer。 */
export function pointerOf(...segments: (string | number)[]): string {
  if (segments.length === 0) return '$'
  return (
    '$' +
    segments
      .map((s) => (typeof s === 'number' ? `/${s}` : `/${String(s).replace(/~/g, '~0').replace(/\//g, '~1')}`))
      .join('')
  )
}

/**
 * 生成错误文案。
 *
 * 三条约束都在这里:
 *   · 边界不同前缀不同(params / result),让人一眼看出该改哪边;
 *   · issue 只列前 8 条 + 总数;
 *   · 整体截断到 2048 字符。
 */
export function describeValidationError(
  boundary: ValidationBoundary,
  method: string,
  issues: readonly ValidationIssue[],
): string {
  const shown = issues.slice(0, MAX_ISSUES_SHOWN)
  const body = shown.map((i) => `${i.path}: ${i.message}`).join('; ')
  const more = issues.length > shown.length ? ` (+${issues.length - shown.length} more)` : ''
  const head = boundary === 'params' ? `Invalid ${method} params: ` : `Invalid ${method} result: `
  return `${head}${body}${more}`.slice(0, MAX_MESSAGE_CHARS)
}

/**
 * 校验并抛错。`check` 返回 issue 数组(空 = 通过)。
 *
 * 这是一个**薄壳**:真正的校验由调用方给(我方目前用 zod / 手写判据),
 * 本函数只负责"失败时按边界归码 + 文案约束"。
 */
export function validateAtBoundary<T>(
  boundary: ValidationBoundary,
  method: string,
  value: T,
  check: (v: T) => readonly ValidationIssue[],
): T {
  // 非纯 JSON 值在入参边界直接拒(与对齐实现的 `Expected a plain JSON value` 同义);
  // 返回值边界同样拒 —— 但那说明 handler 造了个不可序列化的东西,归 internal。
  if (!isPlainJsonValue(value)) {
    throw new BoundaryValidationError(boundary, method, [
      { code: 'not_plain_json', message: 'Expected a plain JSON value', path: '$' },
    ])
  }
  const issues = check(value)
  if (issues.length > 0) {
    throw new BoundaryValidationError(boundary, method, issues)
  }
  return value
}

/**
 * 判断是否纯 JSON 值(可 null / 布尔 / 数字 / 字符串 / 数组 / 普通对象)。
 *
 * 拒函数、Symbol、BigInt、循环引用 —— 它们在跨 JSON-RPC 线时必然出问题,
 * 与其让序列化层抛出难懂的错,不如在边界上给一条能读的话。
 */
export function isPlainJsonValue(value: unknown, seen = new WeakSet<object>()): boolean {
  if (value === null) return true
  const t = typeof value
  if (t === 'boolean' || t === 'string') return true
  if (t === 'number') return Number.isFinite(value as number)
  if (t !== 'object') return false

  const obj = value as object
  if (seen.has(obj)) return false // 循环引用
  seen.add(obj)

  if (Array.isArray(obj)) {
    return obj.every((v) => v === undefined || isPlainJsonValue(v, seen))
  }
  const proto = Object.getPrototypeOf(obj)
  // 只接受普通对象与 null 原型对象;Date / Map / class 实例一律不认
  if (proto !== Object.prototype && proto !== null) return false
  return Object.values(obj as Record<string, unknown>).every(
    (v) => v === undefined || isPlainJsonValue(v, seen),
  )
}

/**
 * 采样数组长度(诊断用)。
 *
 * 为什么不是"直接 map 出所有长度":一个 10 万元素的数组为了报一条错
 * 去遍历全部,等于让报错本身变成一次 OOM。这里限制**采样条数 + 遍历深度**。
 */
export function sampleArrayLengths(value: unknown, maxEntries = MAX_ARRAY_SAMPLE): Record<string, number> {
  const out: Record<string, number> = {}
  const queue: { path: string; v: unknown; depth: number }[] = [{ path: '$', v: value, depth: 0 }]
  const MAX_DEPTH = 4

  while (queue.length > 0 && Object.keys(out).length < maxEntries) {
    const cur = queue.shift()!
    if (cur.depth > MAX_DEPTH) continue
    if (Array.isArray(cur.v)) {
      out[cur.path] = cur.v.length
      // 只展开前 3 个元素找嵌套数组,避免宽数组把队列撑满
      for (let i = 0; i < Math.min(cur.v.length, 3); i++) {
        queue.push({ path: `${cur.path}/${i}`, v: cur.v[i], depth: cur.depth + 1 })
      }
    } else if (cur.v !== null && typeof cur.v === 'object') {
      for (const [k, v] of Object.entries(cur.v as Record<string, unknown>)) {
        queue.push({ path: `${cur.path}/${k}`, v, depth: cur.depth + 1 })
      }
    }
  }
  return out
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
