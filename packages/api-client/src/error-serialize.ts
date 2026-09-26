// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Error 序列化 —— @ihui/types 唯一出口的**包内逐字移植**(2026-09-26 立,发布收口)。
 *
 * 为什么包内有一份而不直接 import 值:
 * `@ihui/api-client` 是可发布产物(pnpm pack → 纯 Node ESM 消费者),而 `@ihui/types` 仍是
 * private、exports 指向 `./src/*.ts`(实测 `node scripts/check-pkg-installable.mjs packages/types`
 * 判红),所以 dist 里任何一条 `import { serializeError } from '@ihui/types'` 都构成"运行时用了
 * 却没(能)声明"的坏包 —— 可安装性自检判据 9 点名正是这一型。同文件上方
 * nullDeviceFingerprintCollector 的收口(2026-09-26)走的是同一条路:值改成本包实现,
 * 类型仍从 @ihui/types import,契约只有一个来源,漂移会响不会静默。
 *
 * 形状锚定:本模块的返回类型**不是**本地重新声明,而是 `import type { SerializedError }
 * from '@ihui/types'` —— 共享接口一旦新增必填成员,这里就地 typecheck 失败。
 * 行为规格(闭集输出 / 深度封顶 + 循环检测 / 永不抛)逐字沿用 @ihui/types/src/error-serialize.ts
 * 的三条纪律,不在此处重述成第二份散文。
 */
import type { SerializedError } from '@ihui/types'

/** cause 链(含根节点)最多展开的节点数。与 @ihui/types 的 ERROR_SERIALIZE_MAX_DEPTH 同值。 */
export const ERROR_SERIALIZE_MAX_DEPTH = 5

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
