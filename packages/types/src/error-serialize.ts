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

import { z } from 'zod'
import { ContractValidationError } from './api-contracts.js'

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
    out.cause =
      cause instanceof Error ? serializeErrorNode(cause, depth + 1, seen) : fromNonThrown(cause)
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

// ===================== 契约定义与运行时校验同源(b76-01 票2) =====================
// SerializedError 是跨进程/落库的错误载荷面:类型与校验从同一份 zod schema 派生,
// 两侧不可能各自演化。strict 白面 —— 序列化出口本来就是闭集(纪律 1),读回来
// 多一个字段即判失败;新字段一律 optional,与 serializeError 的输出同步扩展。

/** SerializedError strict schema:与上方 hand-written interface 逐字段对齐(双向 satisfies)。 */
export const SerializedErrorSchema: z.ZodType<SerializedError> = z.strictObject({
  name: z.string(),
  message: z.string(),
  stack: z.string().optional(),
  cause: z.lazy(() => SerializedErrorSchema).optional(),
  truncated: z.literal(true).optional(),
})

export type SerializedErrorWire = z.infer<typeof SerializedErrorSchema>

export type SerializedErrorParseResult =
  { success: true; data: SerializedErrorWire } | { success: false; issues: readonly string[] }

/** 读前校验(不抛):把逐条判据交回调用方裁决。 */
export function safeParseSerializedError(input: unknown): SerializedErrorParseResult {
  const result = SerializedErrorSchema.safeParse(input)
  if (result.success) return { success: true, data: result.data }
  return {
    success: false,
    issues: result.error.issues.map(
      (issue) => `${issue.path.map(String).join('.')}: ${issue.message}`,
    ),
  }
}

/** 读回唯一入口:失败抛 ContractValidationError。 */
export function parseSerializedError(input: unknown): SerializedErrorWire {
  const result = safeParseSerializedError(input)
  if (!result.success) throw new ContractValidationError(result.issues)
  return result.data
}

// ===================== 判别式 outcome + 禁文本判流程(b76-01 票3) =====================
// 可预期业务分支的唯一失败形态:判别式 outcome + 封闭 errorCategory/failureStage 联合
// + 稳定 errorCode。判定一律走判别式与 code 字段 —— **禁止降级为 message 字符串判断**
// (message 只是给人看的文案,措辞随时会改;"429"/"quota"这类词不构成判定依据)。
// 跨进程拿不到同一实例时,按稳定 errorCode 字段比对;投影/持久化保留
// type/code/detail/attribution 归因,不折叠成一格文本。

/** 失败发生在哪条边界上(封闭联合)。 */
export type FailureStage = 'client_validation' | 'upstream_request' | 'local_persist'

export const FAILURE_STAGES = [
  'client_validation',
  'upstream_request',
  'local_persist',
] as const satisfies readonly FailureStage[]

/**
 * 错误类别(封闭联合,跨进程可判)。"限流"这类判定只能由 errorCategory 得出:
 * 类别缺失时判定器必须返回 false,绝不回退到 message 文本匹配。
 */
export type ErrorCategory =
  | 'rate_limited'
  | 'quota_exhausted'
  | 'auth'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'validation'
  | 'upstream'
  | 'internal'

export const ERROR_CATEGORIES = [
  'rate_limited',
  'quota_exhausted',
  'auth',
  'forbidden',
  'not_found',
  'conflict',
  'validation',
  'upstream',
  'internal',
] as const satisfies readonly ErrorCategory[]

/** 判别式失败 outcome strict schema:未知字段判失败,新字段一律 optional。 */
export const FailureOutcomeSchema = z.strictObject({
  ok: z.literal(false),
  failureStage: z.enum(FAILURE_STAGES),
  errorCategory: z.enum(ERROR_CATEGORIES),
  /** 稳定业务错误码(跨进程按此比对);缺席时按 errorCategory 判。 */
  errorCode: z.string().optional(),
  /** 仅展示用。判定器不得读它。 */
  message: z.string().optional(),
  detail: z.unknown().optional(),
  /** 归因:错误发生在哪个通道/端口(如 'carrier:sms')。 */
  attribution: z.string().optional(),
})

export type FailureOutcome = z.infer<typeof FailureOutcomeSchema>

/**
 * 判定器:值是不是一个判别式失败 outcome。
 * 负例契约:伪造 `{ message: 'quota exceeded' }` 但 errorCategory 缺失 ⇒ 必须 false
 * (按文本判的实现会 true,测试即红 —— 见 tests/failure-outcome.test.ts)。
 */
export function isFailureOutcome(value: unknown): value is FailureOutcome {
  return FailureOutcomeSchema.safeParse(value).success
}

/** 按封闭类别判定。**禁止**传 message 进来比对 —— 本函数只读 errorCategory。 */
export function isFailureCategory(value: unknown, category: ErrorCategory): boolean {
  return isFailureOutcome(value) && value.errorCategory === category
}

/** 便捷构造:ok:false 形态的失败 outcome(跨边界返回值的唯一失败形状)。 */
export function createFailureOutcome(input: {
  failureStage: FailureStage
  errorCategory: ErrorCategory
  errorCode?: string
  message?: string
  detail?: unknown
  attribution?: string
}): FailureOutcome {
  return { ok: false, ...input }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
