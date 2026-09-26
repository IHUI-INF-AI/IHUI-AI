// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Error 序列化唯一出口(2026-09-26 立)。
 *
 * 缺陷:Error 的 name/message/stack/cause 全是**非枚举自有属性**,
 * `JSON.stringify(new Error("boom")) === "{}"`。于是凡"把 error 对象塞进
 * 日志/响应/IPC"的地方,事故现场全部退化成空对象 —— 越是要看错误的时候,
 * 越什么也看不到。
 *
 * 本模块的三条纪律:
 * 1. 闭集输出 —— 只倒 name/message/stack/cause,调用方挂在 Error 上的未知字段
 *    (可能是请求体/响应体/凭据)一律不带出。
 * 2. 封顶 + 循环检测 —— cause 链最多展开 ERROR_SERIALIZE_MAX_DEPTH 个节点;
 *    深度耗尽或撞上循环 cause 时,在截断处标 `truncated: true`,不静默丢。
 * 3. 永不抛 —— 本出口常站在**崩溃恢复路径**上(crash handler / 日志写盘),
 *    出口自身再抛会把一次可诊断故障升级成二次故障。所有对外部世界的读取
 *    (属性 getter、toString)都在 try 内,失败落兜底形状。
 */

/** cause 链(含根节点)最多展开的节点数。5 层足够定位事故,再深是噪音。 */
export const ERROR_SERIALIZE_MAX_DEPTH = 5

export interface SerializedError {
  name: string
  message: string
  stack?: string
  cause?: SerializedError
  /** true = 下方仍有 cause 未展示(深度封顶或循环 cause),勿读成"链到此为止"。 */
  truncated?: true
}

const NON_THROWN_NAME = 'NonThrownError'

function safeString(value: unknown): string {
  try {
    return String(value)
  } catch {
    return '<unprintable>'
  }
}

function fromNonThrown(err: unknown): SerializedError {
  return { name: NON_THROWN_NAME, message: safeString(err) }
}

function serializeErrorNode(err: Error, depth: number, seen: Set<Error>): SerializedError {
  seen.add(err)
  const out: SerializedError = {
    name: typeof err.name === 'string' ? err.name : 'Error',
    message: typeof err.message === 'string' ? err.message : safeString(err.message),
  }
  if (typeof err.stack === 'string') out.stack = err.stack

  let cause: unknown
  try {
    cause = (err as { cause?: unknown }).cause
  } catch {
    // cause 是坏 getter:当作链尾返回,绝不让未知异常穿过恢复路径
    return out
  }
  if (cause === undefined) return out

  const circular = cause instanceof Error && seen.has(cause)
  if (circular || depth + 1 >= ERROR_SERIALIZE_MAX_DEPTH) {
    out.truncated = true
    return out
  }
  try {
    out.cause = cause instanceof Error ? serializeErrorNode(cause, depth + 1, seen) : fromNonThrown(cause)
  } catch {
    out.truncated = true
  }
  return out
}

/**
 * 把任意被抛出的值转成闭集结构:字段只有 name/message/stack/cause/truncated。
 * 非 Error 输入 ⇒ `{ name: 'NonThrownError', message: String(err) }`。
 * 本函数在任何输入下都不抛(包括 getter 抛错、toString 抛错、循环 cause)。
 */
export function serializeError(err: unknown): SerializedError {
  try {
    if (err instanceof Error) return serializeErrorNode(err, 0, new Set())
    return fromNonThrown(err)
  } catch {
    return { name: NON_THROWN_NAME, message: '<unserializable error>' }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
