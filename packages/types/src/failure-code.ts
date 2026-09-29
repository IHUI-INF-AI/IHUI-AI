// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 封闭失败码联合(G-710,2026-09-30 立)。
 *
 * 我们在修什么:重试决策由**错误文本**决定。`apps/cli/src/tools/index.ts` 的 `classifyError()`
 * 注释自述"根据错误文本启发式分类",判据含 `includes('429')` / `'rate limit'` / `'限流'`;
 * `apps/cli/src/compaction-v2.ts` 里第二座同型。文本档的问题不是"不够准",而是**它与抛错方
 * 之间没有任何契约**:上游改一句措辞、换个语言、把 429 写成 "too many requests" 之外的第三种
 * 说法,判定就静默翻转,而 typecheck / lint / 单测全都不会红(现象写在 `agent.ts` 自己的注释里:
 * "超时…classifyError 会分类为瞬态 → sampleWithRetry 重试" —— 那是一次靠措辞维持的行为)。
 *
 * 上游对照(逐行读到体):`apps/zcode-cli/packages/dynamic-workflow/src/engine/errors.ts` 把错误
 * 按**可处理位置**分档成一条判别联合,原文"不依赖错误文本…正是本联合类型存在的目的"。本文件借
 * 同一条思路,但只取"决策码"这一维(不搬它的分档论证 —— 那属另一票)。
 *
 * 三条判序纪律(为什么这里只有一份解释器):
 * 1. **判序只有一份**。我方已有 `packages/shared/src/utils/error-messages.ts` 的三档判序
 *    `errorCode → HTTP status → 文案正则`(那一条管的是"给用户看哪句话")。本文件复用它的
 *    **前两档形状** —— 结构化字段(code / errorType / errorCode / status)先读,读不到才算"无码"。
 *    "有码/无码"的分界由 {@link structuredFailureCodeOf} 一处给出,任何人不得再写第二个
 *    "先看 errorCode 再看 status"的判定;文案档(第三档)**只有** CLI 的兜底出口一处
 *    (`apps/cli/src/tools/failure-classification.ts`),且每次走到那里都必须计数报名。
 * 2. **本文件不读文本**。这里没有 `includes`、没有正则 —— 一旦出现,本文件就变成第二个解释器。
 * 3. **闭集**。新增值必须同枚提交给出至少一个发射方与一个消费方(与 `radius.js` 的 RADIUS_ROLES
 *    同一条规矩:不得先建表再等人用)。
 */

/**
 * 闭集成员的依据(每档都有真实发射点,不是设想):
 * - `rate_limited`            — `executeToolCall` 的滑动窗口拒绝(`errorType: 'rate_limited'`)、
 *                                HTTP 429、后端 `RATE_LIMITED` / `*_QUOTA_EXHAUSTED`
 * - `timeout`                 — `executeWithinExecBudget` 的墙钟到点(`errorType: 'timeout'`)、
 *                                压缩 sampler 的 AbortController 计时到点、HTTP 408 / 504
 * - `cancelled`               — `executeWithinExecBudget` 的外层取消(`errorType: 'cancelled'`)、
 *                                `ctx.signal.aborted`;**与 timeout 分档**是因为"用户按了停止"
 *                                与"系统判它慢"的可恢复性不同(前者重试等于违背用户意图)
 * - `provider_unavailable`    — HTTP 5xx、`INTERNAL_ERROR` / `PROVIDER_ERROR` / `ENGINE_UNAVAILABLE`;
 *                                刻意与 `timeout` 分开:上游砖了时的出路是换模型/换通道,不是再等一次
 * - `context_limit`           — HTTP 413、`CONTEXT_TOO_LONG` / `FILE_TOO_LARGE` / `MEDIA_COUNT_EXCEEDED`;
 *                                **非瞬态**(原样重投必然再撞),它的出路只有压缩或换窗口
 * - `network` / `permission` / `not_found` / `invalid_arguments` — 承接 `ErrorType` 既有四档,
 *                                以及工具面实际发射的 `permission_denied` / `invalid_arguments*`
 *                                (见 {@link FAILURE_CODE_ALIASES};不收它们就会把"其实带了码"
 *                                的结果读成"无码",兜底计数当场虚高)
 * - `unknown`                 — **显式**的"判不出"档。它不是一个码,而是"结构化与兜底都没给出
 *                                结论"这一事实;调用方不得把 `unknown` 当成一种处置依据之外的东西
 *                                (压缩面按它保守重试、工具面按它不重试,两种策略都写在消费方)。
 */
export const FAILURE_CODES = [
  'rate_limited',
  'timeout',
  'cancelled',
  'provider_unavailable',
  'context_limit',
  'network',
  'permission',
  'not_found',
  'invalid_arguments',
  'unknown',
] as const

export type FailureCode = (typeof FAILURE_CODES)[number]

const FAILURE_CODE_SET: ReadonlySet<string> = new Set(FAILURE_CODES as readonly string[])

/** 运行时收窄:任何来自面上(字符串/JSON/别的进程)的码名都必须过这一道,不得 `as FailureCode`。 */
export function isFailureCode(value: unknown): value is FailureCode {
  return typeof value === 'string' && FAILURE_CODE_SET.has(value)
}

/**
 * 既有发射名 → 闭集规范码。方向是**单向归一**,不反向展开成第二个名字。
 *
 * - `permission_denied` → `permission`:工具面两处拒绝闸发射前者,而 `isFatalErrorType` 判的是
 *   后者 —— 即"权限拒绝"在旧口径里从来没被认成致命过。两档都不在可重试集合里,所以没有任何
 *   调用点的重试结论被改动(改的只是"能不能认出它是权限")。
 * - `invalid_arguments_exhausted` → `invalid_arguments`:前者是"修复窗用尽"这一子态,决策上与
 *   "参数不合法"同档(都不可自动重试)。不归一的后果很具体:发射方**明明带了身份**,却被判成
 *   "无码"从而走文本兜底并计数 —— 那会让兜底台账虚高,而虚高的台账就没法用来决定"先给哪一处补码"。
 *
 * 只加**已存在的发射名**(逐条取自 `apps/cli/src/tools/index.ts` 与 `commands/agent.ts` 的字面量),
 * 不得为"看着像"预新增成员。
 */
export const FAILURE_CODE_ALIASES: Readonly<Record<string, FailureCode>> = Object.freeze({
  permission_denied: 'permission',
  invalid_arguments_exhausted: 'invalid_arguments',
})

/** 把一个码名(可能是既有发射名)归一成闭集规范码;认不出返回 undefined(= 无码),绝不猜 `unknown`。 */
export function normalizeFailureCode(value: unknown): FailureCode | undefined {
  if (isFailureCode(value)) return value
  if (typeof value !== 'string') return undefined
  const aliased = FAILURE_CODE_ALIASES[value]
  return aliased
}

/**
 * 后端稳定 `errorCode` → 失败码。
 *
 * 键的出处逐字取自两张既有表,**不得新增未登记的码**:
 * - `packages/shared/src/chat/error-catalog.ts` 的 `ERROR_CODE_CATALOG`(ai-service / CLI 面)
 * - `packages/shared/src/utils/error-messages.ts` 的 `ERROR_CODE_TO_ZH`(apps/api 的 AppError 面)
 *
 * 没进这张表的码一律落 undefined(= 无码 ⇒ 由唯一兜底出口按计数处理)。这是刻意的窄口径:
 * 把"没登记"洗成 `unknown` 就等于替调用方做出"已经判过"的判断 —— 本仓最高频的失效型正是
 * "把没判写成判过了"。
 */
export const FAILURE_CODE_BY_BACKEND_ERROR_CODE: Readonly<Record<string, FailureCode>> = Object.freeze({
  RATE_LIMITED: 'rate_limited',
  PROVIDER_QUOTA_EXHAUSTED: 'rate_limited',
  TRIAL_QUOTA_EXHAUSTED: 'rate_limited',
  CONCURRENCY_LIMIT_EXCEEDED: 'rate_limited',
  TIMEOUT: 'timeout',
  REQUEST_TIMEOUT: 'timeout',
  DELEGATE_TIMEOUT: 'timeout',
  NEEDS_INPUT_TIMEOUT: 'timeout',
  CONTEXT_TOO_LONG: 'context_limit',
  FILE_TOO_LARGE: 'context_limit',
  IMAGE_TOO_LARGE: 'context_limit',
  TOO_LARGE: 'context_limit',
  TEXT_TOO_LARGE: 'context_limit',
  MEDIA_COUNT_EXCEEDED: 'context_limit',
  BUDGET_EXHAUSTED: 'context_limit',
  PERMISSION_DENIED: 'permission',
  EXEC_POLICY_DENIED: 'permission',
  NETWORK_APPROVAL_DENIED: 'permission',
  ACCOUNT_RESTRICTED: 'permission',
  TOKEN_EXPIRED: 'permission',
  UNAUTHORIZED: 'permission',
  FORBIDDEN: 'permission',
  NOT_FOUND: 'not_found',
  FILE_NOT_FOUND: 'not_found',
  TOOL_NOT_FOUND: 'not_found',
  VERSION_NOT_FOUND: 'not_found',
  PROVIDER_NOT_CONFIGURED: 'provider_unavailable',
  MODEL_NOT_CONFIGURED: 'provider_unavailable',
  NETWORK_ERROR: 'network',
  FETCH_FAILED: 'network',
  INTERNAL_ERROR: 'provider_unavailable',
  ENGINE_ERROR: 'provider_unavailable',
  ENGINE_UNAVAILABLE: 'provider_unavailable',
  PROVIDER_ERROR: 'provider_unavailable',
  LLM_ERROR: 'provider_unavailable',
  LLM_FAILED: 'provider_unavailable',
  API_BRIDGE_ERROR: 'provider_unavailable',
  UPSTREAM_FAILURE: 'provider_unavailable',
  SERVICE_UNAVAILABLE: 'provider_unavailable',
  INVALID_ARGS: 'invalid_arguments',
  INVALID_ARGUMENT: 'invalid_arguments',
  INVALID_PARAMS: 'invalid_arguments',
  BAD_PARAMS: 'invalid_arguments',
  MISSING_PARAMS: 'invalid_arguments',
  VALIDATION_FAILED: 'invalid_arguments',
})

/**
 * HTTP status → 失败码。只认**状态码本身**,不读任何文本。
 * 落在区间之外(含 2xx / 3xx / 未知高位)返回 undefined,由调用方决定是不是"无码"。
 */
export function failureCodeFromHttpStatus(status: unknown): FailureCode | undefined {
  if (typeof status !== 'number' || !Number.isFinite(status)) return undefined
  if (status === 408 || status === 504) return 'timeout'
  if (status === 429) return 'rate_limited'
  if (status === 401 || status === 403) return 'permission'
  if (status === 404) return 'not_found'
  if (status === 413) return 'context_limit'
  if (status === 400 || status === 422) return 'invalid_arguments'
  if (status >= 500 && status <= 599) return 'provider_unavailable'
  return undefined
}

/**
 * 可以被结构化读到的四类载体(`ToolError.code` / `ToolResult.errorType` /
 * `apiFailureToError` 挂的 `errorCode` 与 `status`)。字段名固定,值一律按 `unknown` 收 ——
 * 它们可能来自别的进程或别人的库,不能假定类型。
 */
export interface FailureCodeCarrier {
  code?: unknown
  errorType?: unknown
  errorCode?: unknown
  status?: unknown
}

function readField(source: unknown, key: keyof FailureCodeCarrier): unknown {
  if (typeof source !== 'object' || source === null) return undefined
  try {
    return (source as Record<string, unknown>)[key]
  } catch {
    // 坏 getter(代理对象 / 第三方 Error 子类)不得把一次判定升级成二次故障:
    // 读不到就当这一档没有,继续下一档。与 error-serialize.ts 的"永不抛"是同一条纪律。
    return undefined
  }
}

/**
 * **"有码/无码"的唯一分界出口**。
 *
 * 判序(复用 error-messages.ts 的结构化两档,顺序一致):
 * 1. `code`         —— 具名错误类(ToolError)显式携带的规范码,优先级最高
 * 2. `errorType`    —— ToolResult 的既有字段(经 {@link normalizeFailureCode} 归一)
 * 3. `errorCode`    —— 后端稳定码,查 {@link FAILURE_CODE_BY_BACKEND_ERROR_CODE}
 * 4. `status`       —— HTTP 状态,查 {@link failureCodeFromHttpStatus}
 *
 * 返回 `undefined` 是**结论**而不是失败:它表示"这次错误没有携带任何结构化身份",
 * 调用方因此**只许**走那一个计数报名的文本兜底出口,不得就地读文本。
 *
 * @param source 错误对象 / ToolResult / ApiResult 失败分支 / 任意携带上述字段的对象。
 *               传字符串按"无码"处理 —— 那正是本出口存在的理由:文本里没有身份。
 */
export function structuredFailureCodeOf(source: unknown): FailureCode | undefined {
  const direct = normalizeFailureCode(readField(source, 'code'))
  if (direct) return direct
  const legacy = normalizeFailureCode(readField(source, 'errorType'))
  if (legacy) return legacy
  const backendCode = readField(source, 'errorCode')
  if (typeof backendCode === 'string') {
    const mapped = FAILURE_CODE_BY_BACKEND_ERROR_CODE[backendCode]
    if (mapped) return mapped
  }
  return failureCodeFromHttpStatus(readField(source, 'status'))
}
