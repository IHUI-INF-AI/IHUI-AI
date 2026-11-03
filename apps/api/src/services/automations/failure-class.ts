// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-669 自动化失败的确定性分类(2026-10-01 立)。
 *
 * 要治的形态是"失败之后,下一步该不该再试"没有人判:
 *  - `agent-automation-scheduler.ts` 的 catch 只 `log.warn` 并 `return null`,不写任何时间戳
 *    ⇒ tick 的到期查询(`isNull(lastRunAt)` / `lte(nextRunAt, now)`)必然再次命中同一行
 *    ⇒ 抛穿路径每 60 秒无限重放(票面 A 格);
 *  - 上游非 2xx(401/403/400 = 缺凭据形状)被 `consumeAgentStream` 吞成 `errorMessage` 后
 *    **正常返回** ⇒ 调用方按成功落 `lastRunAt` 并重排、`status` 留 `active`
 *    ⇒ 缺凭据今天根本走不到 catch(票面 B 格)。
 * 两格共同的缺口都是"分流",所以分类逻辑住在这里,由**调度器**与 **D30 编排器**共用一份实现
 * (两处各写一遍必然漂开 —— 这是本仓记过最多次的失败型)。
 *
 * 判据取向:**拿不准一律按 transient**。permanent 是终态(自动 paused、要用户手动恢复),
 * 把一次偶发抖动判成 permanent,等于静默停掉用户的定时任务,比多试几次贵得多;
 * 而 transient 一侧有上限与退避(见 scheduler 的 `MAX_TRANSIENT_ATTEMPTS` /
 * `transientBackoffMs`),超上限同样落 paused 并留 `lastError`,所以"默认 transient"
 * 不是"无限重试",而是"有界退避后仍会喊人"。
 */

/** permanent = 重试不会变好(缺凭据 / 4xx 请求本身错 / rrule 非法);transient = 可退避重试。 */
export type AutomationFailureKind = 'permanent' | 'transient'

/** 分类入参:三个来源都能单独给,也可以同时给(状态码优先于文案)。 */
export interface AutomationFailureInput {
  /** 抛出的异常(tick 的 catch 路径);会从 `status`/`statusCode`/`cause.code` 取证据。 */
  error?: unknown
  /** 上游 HTTP 状态码 —— 非 ok 响应必须把它传进来,否则 B 那一格仍然只能靠文案猜。 */
  status?: number | null
  /** 可读失败文案(`capture.errorMessage` / 执行器的 `error` 字段)。 */
  message?: string | null
}

/** 分类结论:除档位外还带"命中了哪条判据",lastError 要能说清为什么是终态。 */
export interface AutomationFailureVerdict {
  kind: AutomationFailureKind
  /** 命中的判据标识(如 `status:401` / `credential-message` / `default-transient`)。 */
  reason: string
}

/**
 * 状态码分档:4xx 里除了"客户端等一会再发就好"的那三档,其余都是请求本身的问题 ——
 * 重试不会变好。5xx / 网络层一律 transient(上游可能在重启)。
 */
const TRANSIENT_STATUS_CODES: ReadonlySet<number> = new Set([408, 425, 429])

/**
 * 缺凭据 / 配置类文案 ⇒ permanent。
 * 这些形态的共同点:**服务端不动配置就不会自己好**(系统 token 签不出来、JWT_SECRET 与
 * ai-service 不一致、用户没绑 API key、rrule 本身写坏了)。
 *
 * 名词与状态词各自成表,并**两向都在 40 字符窗口内**才算命中:
 * "missing credentials"、"API key 未配置"、"凭证已过期" 都算,而孤零零一个 "token"
 * 或孤零零一个 "invalid" 都不算 —— 单向窗口曾经漏掉 "missing credentials for provider openai"
 * (复数不被 `\bcredential\b` 接住)与 "JWT_SECRET not configured"(状态词表里没有 not configured)。
 */
const CREDENTIAL_NOUN = String.raw`(?:api[ _-]?keys?|access[ _-]?tokens?|refresh[ _-]?tokens?|credentials?|secrets?|tokens?|凭据|凭证|密钥)`
const PROBLEM_STATE = String.raw`(?:missing|invalid|not\s*configured|unconfigured|unset|expired|未配置|缺少|无效|为空|已过期)`

const PERMANENT_MESSAGE_PATTERNS: readonly RegExp[] = [
  /rrule/i,
  /invalid or expired token/i,
  /unauthorized/i,
  /forbidden/i,
  /\bpermission denied\b/i,
  new RegExp(`(?:${PROBLEM_STATE})[^\\n]{0,40}(?:${CREDENTIAL_NOUN})`, 'i'),
  new RegExp(`(?:${CREDENTIAL_NOUN})[^\\n]{0,40}(?:${PROBLEM_STATE})`, 'i'),
  /(缺少|未配置)[^\n]{0,12}(密钥|凭据|凭证|api)/i,
  /认证(失败|信息缺失)/,
]

/** 网络 / 上游抖动类文案 ⇒ transient。放在 permanent 之后判,见下面的优先级说明。 */
const TRANSIENT_MESSAGE_PATTERNS: readonly RegExp[] = [
  /\bE(CONNREFUSED|CONNRESET|CONNABORTED|TIMEDOUT|PIPE|HOSTUNREACH|NETUNREACH|ADDRINUSE|ADDRNOTAVAIL)\b/,
  /\bEAI_AGAIN\b/,
  /\bUND_ERR_[A-Z_]+\b/,
  /\bfetch failed\b/i,
  /\bsocket hang up\b/i,
  /\bnetwork\s*(error|timeout|failure)\b/i,
  /\btimed?\s*out\b/i,
  /\baborted\b/i,
  /服务(暂时)?不可用|上游服务异常|连接(失败|超时|中断)/,
]

/**
 * 从文案里抠状态码的四种书写形态(全部要求前后不是数字,否则 8803 这种端口会被读成 803)。
 * 显式 `status` 入参优先;这里只兜"把状态码写进了一句话"的执行器/流式路径。
 */
const STATUS_IN_TEXT_PATTERNS: readonly RegExp[] = [
  /状态码\s*\(?\s*(\d{3})(?!\d)/,
  /→\s*(\d{3})(?!\d)/,
  /\bhttp\s*(\d{3})(?!\d)/i,
  /\bstatus(?:\s*code)?\s*[=:]\s*(\d{3})(?!\d)/i,
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** 把任意失败信号读成一段可判读的文本(含 name/message,便于匹配网络码)。 */
function textsOf(input: AutomationFailureInput): string[] {
  const out: string[] = []
  if (typeof input.message === 'string' && input.message) out.push(input.message)
  const err = input.error
  if (typeof err === 'string') out.push(err)
  else if (err instanceof Error) out.push(`${err.name}: ${err.message}`)
  else if (err !== undefined && err !== null) out.push(String(err))
  return out
}

/** 从 error 对象(含 cause 链,最多 5 跳)里找数值状态码。 */
function statusFromError(error: unknown): number | null {
  let current: unknown = error
  for (let hop = 0; hop < 5 && isRecord(current); hop += 1) {
    for (const key of ['status', 'statusCode']) {
      const raw = current[key]
      if (typeof raw === 'number' && Number.isFinite(raw)) {
        const code = Math.trunc(raw)
        if (code >= 100 && code <= 599) return code
      }
    }
    current = current.cause
  }
  return null
}

/** 从文案里找状态码;找到即返回第一个可用的。 */
function statusFromText(texts: readonly string[]): number | null {
  for (const text of texts) {
    for (const pattern of STATUS_IN_TEXT_PATTERNS) {
      const hit = pattern.exec(text)
      const code = hit?.[1] === undefined ? Number.NaN : Number(hit[1])
      if (Number.isFinite(code) && code >= 100 && code <= 599) return code
    }
  }
  return null
}

/** 状态码这一维的判读:4xx(除 408/425/429)= permanent,其余 = transient。 */
function verdictOfStatus(code: number): AutomationFailureVerdict {
  if (code >= 400 && code < 500 && !TRANSIENT_STATUS_CODES.has(code)) {
    return { kind: 'permanent', reason: `status:${code}` }
  }
  if (code >= 500) return { kind: 'transient', reason: `status:${code}` }
  return { kind: 'transient', reason: `status:${code}` }
}

/**
 * 分类一条自动化失败。
 *
 * 优先级(高在前):
 *  1. 显式 `status` 入参 —— 非 ok 响应必须走这一条,它比文案可靠;
 *  2. error 对象上的 status/statusCode(含 cause 链);
 *  3. 文案里书写的状态码;
 *  4. 文案命中缺凭据/配置/rrule 族 ⇒ permanent;
 *  5. 文案命中网络/超时/上游不可用族 ⇒ transient;
 *  6. 都没命中 ⇒ **transient**(默认档,理由见文件头"判据取向")。
 */
export function describeAutomationFailure(input: AutomationFailureInput): AutomationFailureVerdict {
  const explicit =
    typeof input.status === 'number' && Number.isFinite(input.status)
      ? Math.trunc(input.status)
      : Number.NaN
  if (Number.isFinite(explicit) && explicit >= 100 && explicit <= 599) {
    return verdictOfStatus(explicit)
  }

  const fromError = statusFromError(input.error)
  if (fromError !== null) return verdictOfStatus(fromError)

  const texts = textsOf(input)
  const fromText = statusFromText(texts)
  if (fromText !== null) return verdictOfStatus(fromText)

  // 4) permanent 族先判:缺凭据不会自己好;偶发的网络文案与凭据文案同时出现时(实测
  //    "上游服务异常(状态码 401)"这类已被 1 拿走),剩下的重叠几乎都指向配置问题。
  for (const pattern of PERMANENT_MESSAGE_PATTERNS) {
    for (const text of texts) {
      if (pattern.test(text)) return { kind: 'permanent', reason: 'credential-message' }
    }
  }
  for (const pattern of TRANSIENT_MESSAGE_PATTERNS) {
    for (const text of texts) {
      if (pattern.test(text)) return { kind: 'transient', reason: 'network-message' }
    }
  }
  return { kind: 'transient', reason: 'default-transient' }
}

/** 只要档位的简写(调用方多数只需要这一个结论)。 */
export function classifyAutomationFailure(input: AutomationFailureInput): AutomationFailureKind {
  return describeAutomationFailure(input).kind
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
