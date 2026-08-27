/**
 * 安全 JSON 解析工具。
 *
 * 根治 CLI 中大量 `JSON.parse(raw) as T` 不安全断言:
 * JSON.parse 可能抛 SyntaxError,也可能返回 null / 数组 / 标量(与断言类型
 * 不符),导致运行时 undefined 崩溃或异常逃逸到无关调用栈。
 *
 * 用法:
 * ```ts
 * const parsed = tryParseJson(raw)
 * if (!isRecord(parsed)) return fallback
 * // 关键字段做最小结构检查后再收窄
 * if (typeof parsed.version !== 'string') return fallback
 * const data = parsed as CacheFile
 * ```
 */

/**
 * 解析 JSON 字符串,失败(语法错误/空串)时返回 undefined。
 * 注意:JSON 里 `null` 是合法值,解析成功会原样返回 null;
 * 只有 undefined 表示"解析失败",与 JSON 语义无歧义。
 */
export function tryParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return undefined
  }
}

/** 值是否为非 null 的普通对象(排除数组/函数) */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 值是否为数组 */
export function isJsonArray(value: unknown): value is unknown[] {
  return Array.isArray(value)
}
