// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 错误归一:候选路径阶梯 + 泛化包装降权 + detail 业务码提取
 * (机制吸收 G-977987;上游出处 zcode packages/ui/src/lib/zcodeUiError.ts:62-263)。
 *
 * 核心规则:**主提示永远优先给结构化根因,外层包装词不许盖住它**。
 *
 *  1. 候选路径阶梯(去重保序):message → detail → data.message/data.detail/
 *     data.details(复数!历史只认 detail 会丢可执行提示)/data.reason →
 *     data.error.{message,detail,details} → data.zcode.error.{message,detail,details};
 *     同一条候选只在首次出现时收(保序),重复路径不挤占位置。
 *  2. JSON 字符串错误先 parse 取结构化字段(解析不到回退整段原文);对象字段里
 *     再嵌 JSON 字符串时递归解析(turn 错误常见双层包裹)。
 *  3. 泛化包装文案降权:"Internal error"/"Turn execution failed"/"Compact failed"/
 *     "Rewind failed" 这类外层包装词不配当主提示 —— 主提示取第一个非泛化候选,
 *     泛化词降权进 detail(上游直接丢弃泛化词;本仓吸收票判据要求降权成 detail,
 *     给排查留一线线索)。
 *  4. 业务码提取:外层 code 可能只是包装码,真实业务码藏在 detail 的
 *     `provider_code=NNNN` 标记里 —— 正则提取后优先于 code 路径阶梯。
 *  5. attribution 从 4 条路径提取(attribution / data.attribution /
 *     data.error.attribution / data.zcode.error.attribution),用轻量手写校验
 *     代替上游 zod schema,不新增依赖。注意分工:**证据→归因分桶的求解器**
 *     在本仓 lib/error-attribution.ts(已有等价,此处只做"已结构化 attribution
 *     的路径提取与合法性校验",两者互补不重叠)。
 */

import type { ErrorAttribution } from './error-attribution'

export interface NormalizedError {
  /** 业务码:detail 内 provider_code=NNNN 优先,其次 code 路径阶梯,最后 fallbackCode */
  code: string
  /** 主提示:第一个非泛化候选;全部泛化时退回首个候选 */
  message: string
  /** 次要提示:主提示之外的下一候选(泛化包装词降权后落在这里) */
  detail?: string
  underlyingErrorMessage?: string
  underlyingErrorDetail?: string
  /** 已结构化的归因(路径提取 + 轻量校验;分桶求解器见 lib/error-attribution.ts) */
  attribution?: ErrorAttribution
}

export interface NormalizeErrorOptions {
  fallbackCode?: string
  fallbackMessage?: string
}

/** 泛化包装文案集合:外层链路常见的"什么都没说"文案,不配当主提示 */
const GENERIC_WRAPPER_MESSAGES: ReadonlySet<string> = new Set([
  'Internal error',
  'Turn execution failed',
  'Compact failed',
  'Rewind failed',
])

/** detail 内业务码标记:外层 code 只是包装码时,真实业务码藏在这里 */
const PROVIDER_CODE_IN_DETAIL_RE = /provider_code=([0-9]+)/

/** attribution.errorSource 合法取值(与 lib/error-attribution.ts 的类型表同源) */
const ERROR_SOURCE_VALUES: ReadonlySet<string> = new Set([
  'provider',
  'runtime',
  'network',
  'tool',
  '',
])

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/** 沿路径逐段下钻;中途遇到非对象即断(缺失段一律 undefined,不抛) */
function readValueByPath(record: Record<string, unknown>, path: readonly string[]): unknown {
  let current: unknown = record
  for (const segment of path) {
    if (!isObjectRecord(current)) return undefined
    current = current[segment]
  }
  return current
}

/**
 * JSON 字符串 → 对象记录。只认 { / [ 开头的串(普通错误文案不是 JSON,
 * 无差别 JSON.parse 会把 "3" 之类裸数字误收);解析失败返回 null。
 */
function tryParseJsonRecord(value: string): Record<string, unknown> | null {
  const trimmed = value.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null
  try {
    const parsed: unknown = JSON.parse(trimmed)
    return isObjectRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** 对象形态的候选路径阶梯(顺序即优先级);data.details 复数是历史踩坑位,单独占位 */
const MESSAGE_PATH_LADDER: ReadonlyArray<readonly string[]> = [
  ['message'],
  ['detail'],
  ['data', 'message'],
  ['data', 'detail'],
  ['data', 'details'],
  ['data', 'reason'],
  ['data', 'error', 'message'],
  ['data', 'error', 'detail'],
  ['data', 'error', 'details'],
  ['data', 'zcode', 'error', 'message'],
  ['data', 'zcode', 'error', 'detail'],
  ['data', 'zcode', 'error', 'details'],
]

/** 业务码路径阶梯(含 turn-error 把业务码写进 context.providerCode 的深层位) */
const CODE_PATH_LADDER: ReadonlyArray<readonly string[]> = [
  ['code'],
  ['providerCode'],
  ['data', 'code'],
  ['data', 'error', 'code'],
  ['data', 'zcode', 'error', 'code'],
  ['data', 'zcode', 'error', 'context', 'providerCode'],
  ['data', 'error', 'context', 'providerCode'],
  ['context', 'providerCode'],
]

const DETAIL_PATH_LADDER: ReadonlyArray<readonly string[]> = [
  ['detail'],
  ['data', 'detail'],
  ['data', 'error', 'detail'],
  ['data', 'zcode', 'error', 'detail'],
]

const UNDERLYING_MESSAGE_PATH_LADDER: ReadonlyArray<readonly string[]> = [
  ['underlyingErrorMessage'],
  ['data', 'underlyingErrorMessage'],
  ['data', 'error', 'underlyingErrorMessage'],
  ['data', 'zcode', 'error', 'underlyingErrorMessage'],
]

const UNDERLYING_DETAIL_PATH_LADDER: ReadonlyArray<readonly string[]> = [
  ['underlyingErrorDetail'],
  ['data', 'underlyingErrorDetail'],
  ['data', 'error', 'underlyingErrorDetail'],
  ['data', 'zcode', 'error', 'underlyingErrorDetail'],
]

/** attribution 路径阶梯:上游经 zod safeParse 校验,这里用轻量手写校验同判据 */
const ATTRIBUTION_PATH_LADDER: ReadonlyArray<readonly string[]> = [
  ['attribution'],
  ['data', 'attribution'],
  ['data', 'error', 'attribution'],
  ['data', 'zcode', 'error', 'attribution'],
]

function pushCandidate(result: string[], seen: Set<string>, value: unknown): void {
  const normalized = normalizeString(value)
  if (!normalized || seen.has(normalized)) return
  seen.add(normalized)
  result.push(normalized)
}

/** 从对象记录按阶梯收候选;字段值本身是 JSON 字符串时递归解析(双层包裹容错) */
function collectCandidatesFromRecord(record: Record<string, unknown>): string[] {
  const result: string[] = []
  const seen = new Set<string>()
  for (const path of MESSAGE_PATH_LADDER) {
    const value = readValueByPath(record, path)
    if (typeof value === 'string') {
      // 字段值本身是 JSON 字符串:递归解析,成功且能取出结构化字段时,
      // 用结构化字段替代裸 JSON 串(裸串不适合直接展示);解析不出才保留原文
      const nested = tryParseJsonRecord(value)
      if (nested) {
        const nestedCandidates = collectCandidatesFromRecord(nested)
        if (nestedCandidates.length > 0) {
          for (const nestedCandidate of nestedCandidates) {
            pushCandidate(result, seen, nestedCandidate)
          }
          continue
        }
      }
    }
    pushCandidate(result, seen, value)
  }
  return result
}

function collectMessageCandidates(error: unknown): string[] {
  const result: string[] = []
  const seen = new Set<string>()
  if (error instanceof Error) {
    pushCandidate(result, seen, error.message)
  }
  if (typeof error === 'string') {
    // turn/task 错误常见整段是 JSON 字符串:先 parse 取结构化字段,
    // 只有解析不到结构化字段时才回退整段原文(原文常带转义噪声)。
    const parsed = tryParseJsonRecord(error)
    if (parsed) {
      for (const candidate of collectCandidatesFromRecord(parsed)) {
        pushCandidate(result, seen, candidate)
      }
      if (result.length > 0) return result
    }
    pushCandidate(result, seen, error)
    return result
  }
  if (isObjectRecord(error)) {
    // Error 实例也会走到这里(前一步已收过的 message 被去重吸收)
    return collectCandidatesFromRecord(error)
  }
  pushCandidate(result, seen, String(error))
  return result
}

/** record 形态归一:对象直接用;JSON 字符串先 parse;其余形态没有可下钻结构 */
function toReadableRecord(error: unknown): Record<string, unknown> | null {
  if (isObjectRecord(error)) return error
  if (typeof error === 'string') return tryParseJsonRecord(error)
  return null
}

function readFirstStringFromPaths(
  error: unknown,
  paths: ReadonlyArray<readonly string[]>,
): string | undefined {
  const record = toReadableRecord(error)
  if (!record) return undefined
  for (const path of paths) {
    const value = normalizeString(readValueByPath(record, path))
    if (value) return value
  }
  return undefined
}

function isWellFormedAttribution(value: unknown): value is ErrorAttribution {
  if (!isObjectRecord(value)) return false
  const { errorSource, failureReason } = value
  return (
    typeof errorSource === 'string' &&
    ERROR_SOURCE_VALUES.has(errorSource) &&
    typeof failureReason === 'string' &&
    failureReason.trim().length > 0
  )
}

function readAttributionFromPaths(error: unknown): ErrorAttribution | undefined {
  const record = toReadableRecord(error)
  if (!record) return undefined
  for (const path of ATTRIBUTION_PATH_LADDER) {
    const value = readValueByPath(record, path)
    if (isWellFormedAttribution(value)) return value
  }
  return undefined
}

/**
 * 错误归一主入口:任意形态(string / Error / 结构化对象 / 未知)→
 * { 业务码, 主提示, 次提示, 归因 }。判据见文件头。
 */
export function normalizeError(
  error: unknown,
  options: NormalizeErrorOptions = {},
): NormalizedError {
  const candidates = collectMessageCandidates(error)
  // 主提示取第一个非泛化候选:外层包装词不配盖住结构化根因
  const primaryMessage =
    candidates.find((candidate) => !GENERIC_WRAPPER_MESSAGES.has(candidate)) ??
    candidates[0] ??
    options.fallbackMessage ??
    'Internal error'
  // 泛化包装词降权成 detail(吸收票判据;上游直接丢弃,本仓保留一线线索):
  // detail 优先取非泛化的下一候选,没有非泛化候选时才退回泛化词。
  const detailMessage =
    candidates.find(
      (candidate) => candidate !== primaryMessage && !GENERIC_WRAPPER_MESSAGES.has(candidate),
    ) ?? candidates.find((candidate) => candidate !== primaryMessage)

  const codeFromError = readFirstStringFromPaths(error, CODE_PATH_LADDER)
  const detailFromError = readFirstStringFromPaths(error, DETAIL_PATH_LADDER)
  // 外层 code 不可信(常是包装码)时,真实业务码从 detail 的 provider_code=NNNN 提取:
  // 先查 detail 路径位,再查候选里降权出来的 detail,两个 detail 面都覆盖。
  const providerCodeFromDetail =
    PROVIDER_CODE_IN_DETAIL_RE.exec(detailFromError ?? '')?.[1] ??
    (detailMessage ? PROVIDER_CODE_IN_DETAIL_RE.exec(detailMessage)?.[1] : undefined)

  const underlyingErrorMessage = readFirstStringFromPaths(error, UNDERLYING_MESSAGE_PATH_LADDER)
  const underlyingErrorDetail = readFirstStringFromPaths(error, UNDERLYING_DETAIL_PATH_LADDER)
  const attribution = readAttributionFromPaths(error)

  return {
    code: providerCodeFromDetail ?? codeFromError ?? options.fallbackCode ?? 'UNKNOWN',
    message: primaryMessage,
    ...(detailMessage ? { detail: detailMessage } : {}),
    ...(underlyingErrorMessage ? { underlyingErrorMessage } : {}),
    ...(underlyingErrorDetail ? { underlyingErrorDetail } : {}),
    ...(attribution ? { attribution } : {}),
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
