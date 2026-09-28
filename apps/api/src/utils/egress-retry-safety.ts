// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * 「这条出站调用能不能重试」的唯一判据出口(2026-09-27 立)。
 *
 * 病灶(实测,不是假想):`apps/api/src/routes/webhooks-trigger.ts` 对下游是 **POST 且非幂等**
 * (一次调用起一次 agent run),而它把「抛了异常」当成「可以重试」——超时的语义是
 * 「**对方可能已经执行**」,照旧重试就是**重复跑 agent**(重复产出、重复计费);
 * 同时 `controller.abort()` 与真正的建连失败(`ECONNREFUSED`,请求根本没出去)塌成同一句话。
 *
 * 判据换轴:不问「有没有抛异常」,问「**请求是否可能已经发出**」。三态而非布尔:
 * - `retry-safe`     —— 有证据表明请求字节**必未**发出(建连前就失败),重放不会重复副作用;
 * - `result-unknown` —— 请求**可能已发出并对侧已执行**(超时、取消、写出后的复位、拿到响应后断流),
 *                        调用方必须显式回「结果未知」并交对账,不得自动重放;
 * - `permanent-fail` —— 请求必未发出**且**重放必然同样失败(URL 本身不合法、服务端在进入业务
 *                        处理前就明确拒绝的 4xx),重试没有意义。
 * 「结果未知」与「永久失败」的处置动作不同(前者要去对账、后者别再来了),所以不折成一个布尔。
 *
 * 关键纪律:**判不出即 `result-unknown`** —— 绝不允许把「不知道」折叠成「可以重试」。
 * 失效方向固定是「少重试一次」,而不是「多跑一遍别人的活」。
 *
 * 不新增第二份真相:错误分类只住在本文件,调用方(路由侧)**不得**再写一份 `instanceof` 或错误码清单。
 * `reason` 只落**错误码 / 错误名 / 状态码**这类闭集证据,**不落原始 message** —— Node 的传输错误
 * 消息里带对端地址与主机名(实测 `connect ECONNREFUSED 127.0.0.1:59999`、
 * `getaddrinfo ENOTFOUND <host>`),URL 里还可能带 query 凭据;与 §5e「失败必须响但不外带凭据」、
 * 守门 67「凭据不得进 message」是同一条禁令。
 *
 * 对标移植:ZCode `packages/services/src/providers/api/networkErrorClassifier.ts`
 * (建连阶段白名单 + `ETIMEDOUT`/`ECONNRESET` 须有 connect 阶段证据)与
 * `feedback/feedbackHttpClient.ts`(非幂等 POST 只在「肯定没发出」时重试)。
 * 按本仓语义收严两处:① 取消/超时在本仓下游是非幂等 POST ⇒ 直接判 `result-unknown`;
 * ② 出口返回三态,不把「永久失败」塞进「不可重试」里。
 *
 * 已知窄口径(如实登记,不当已证事实):`ENETUNREACH` / `EHOSTUNREACH` / undici 的
 * `UND_ERR_CONNECT_TIMEOUT` / `UND_ERR_CONNECT_ERROR` 同样发生在建连前,但**未列入**本出口白名单
 * —— 它们会落 `result-unknown`(少重试,安全侧)。要收进来需先有真站点产出这些码且确实需要重试的取证。
 */

/** 三态闭集:调用方按值分流,不得自行折算成布尔。 */
export const EGRESS_RETRY_DECISIONS = ['retry-safe', 'result-unknown', 'permanent-fail'] as const

export type EgressRetryDecision = (typeof EGRESS_RETRY_DECISIONS)[number]

export interface EgressRetryVerdict {
  readonly decision: EgressRetryDecision
  /** 单行判据说明:只含码/名/状态码与一句结论,可进日志也可进响应正文(不含原始 message)。 */
  readonly reason: string
}

/** 传输层失败(fetch 抛出):沿 cause / AggregateError.errors 取证「请求是否可能已发出」。 */
export interface EgressTransportFailureInput {
  readonly kind: 'transport-failure'
  readonly error: unknown
  /**
   * 这一趟**已经拿到过响应**(哪怕状态码非 2xx)⇒ 请求必已发出。
   * 此后的任何断流(读 body 读到一半复位)都只能算结果未知,与错误码无关。缺省 false。
   */
  readonly responseReceived?: boolean
}

/** 拿到了 HTTP 响应但不算成功:按状态码与幂等性判。 */
export interface EgressHttpResponseInput {
  readonly kind: 'http-response'
  readonly status: number
  /** 重放该请求是否幂等安全(按方法/幂等键判定)。缺省 false = 按非幂等处理(最保守)。 */
  readonly idempotent?: boolean
}

export type EgressRetryInput = EgressTransportFailureInput | EgressHttpResponseInput

/**
 * 建连阶段错误码白名单 —— 命中即「请求字节必未发出」,依据是 Node 自身产生这些码的位置:
 * - `ECONNREFUSED`:`lib/net.js` 在 socket `connect` 失败时报 `connect ECONNREFUSED <host>:<port>`
 *   (实测 `cause.code` 正是该值)。TCP 握手没完成 ⇒ 连「可写字节的 socket」都不存在;
 * - `ENOTFOUND`:`dns.lookup` 的 getaddrinfo 码(`getaddrinfo ENOTFOUND <host>`)。域名都没解析出来,
 *   地址都没拿到,谈不上发出请求;
 * - `EAI_AGAIN`:同一个 lookup 的**临时** DNS 失败码(`getaddrinfo EAI_AGAIN <host>`)⇒ 同样落在
 *   「建连之前」,且按定义是瞬时故障,这一档重试最有价值。
 * 刻意**不**收 `ECONNRESET` / `ETIMEDOUT`:两者都可能在请求已写出之后才发生,须看 connect 阶段证据。
 */
const NEVER_SENT_ERROR_CODES: readonly string[] = ['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN']

/**
 * 这两码**自身**不区分「复位/超时发生在写出前还是写出后」,只能看证据:Node 的建连阶段失败消息带
 * `connect ` 前缀(`lib/net.js` 把 errno 拼成 `connect <code> <addr>` —— 上面 ECONNREFUSED 的实测
 * 消息就是该形状),TLS 握手未完成时 `_tls_wrap` 报 `...before secure TLS connection was established`,
 * 连接尝试超时报 `Connection attempts timed out`。只有这类证据在场才按「没发出去」处理。
 */
const CONNECT_PHASE_EVIDENCE_CODES: readonly string[] = ['ECONNRESET', 'ETIMEDOUT']

const CONNECT_PHASE_EVIDENCE_PATTERNS: readonly RegExp[] = [
  /^connect\s/i,
  /before secure (?:the )?TLS connection was established/i,
  /connection attempts? timed out/i,
]

/**
 * 取消与超时两类「没等到答案」的异常名(实测:`AbortSignal.timeout(ms)` 抛 `TimeoutError`、
 * `controller.abort()` 抛 `AbortError`,均为 DOMException)。它们**不**证明请求没发出 ——
 * signal 也可能在请求已写出之后才中止 ⇒ 一律结果未知。
 * (已知局限:signal 在 dispatch **之前**就已 abort 时同样只判结果未知 —— 结构上区分不了,
 * 而区分的代价是让「可能重复执行」被放行,故不猜。)
 */
const ABORT_LIKE_ERROR_NAMES: readonly string[] = ['TimeoutError', 'AbortError']

/**
 * URL 根本没解析出来(实测链:`TypeError('Failed to parse URL from …')` → `cause.code`
 * `ERR_INVALID_URL`)⇒ 一个字节都不可能发出,**而同样的输入重试必然同样失败**,
 * 所以这不是「结果未知」而是「永久失败」。刻意只收这一码:参数类错误码覆盖面太宽,判不出请求是否发出。
 */
const NEVER_SENT_AND_POINTLESS_CODES: readonly string[] = ['ERR_INVALID_URL']

/**
 * 服务端在**进入业务处理之前**就拒绝/失败的档位:与请求幂等与否无关,重放不产生副作用。
 * - 408 Request Timeout:请求体都没收完 ⇒ 处理还没开始;
 * - 425 Too Early:早数据(0-RTT)被明确要求重发,定义上未处理;
 * - 429 Too Many Requests:服务端明确「这次不处理」,业务分支未进入。
 * 刻意**不**收 500/502/503/504:对非幂等 POST 而言「网关没拿到上游响应」恰恰等于
 * 「上游可能已经跑完」—— 正是本票立论的那一型。它们只在幂等请求下算 retry-safe(见下)。
 */
const ALWAYS_RETRYABLE_STATUSES: readonly number[] = [408, 425, 429]

/** 幂等请求额外可重试的档位(重放无副作用,所以这些 5xx 也安全)。 */
const IDEMPOTENT_ONLY_RETRYABLE_STATUSES: readonly number[] = [500, 502, 503, 504]

/** cause/AggregateError 链的取证上限:防环状与超长包装;命中上限只会让证据变少 ⇒ 更保守,不会误放行。 */
const MAX_CHAIN_NODES = 24

interface ChainFacts {
  readonly codes: string[]
  readonly names: string[]
  readonly messages: string[]
}

/**
 * 沿 `cause` 与 `AggregateError.errors` 走链收集错误码/错误名/消息(happy-eyeballs 的
 * `AggregateError` 会把真实码藏在 `errors[]` 里,undici 又把 Node 的 errno 藏在 `cause` 里 ——
 * 只看顶层 `error.code` 会判不出,实测顶层永远是 `TypeError('fetch failed')` 且无 code)。
 * 只吃 string 形态的 code(DOMException 的 `code` 是遗留数字,不是 errno 字符串)。
 */
function collectChainFacts(error: unknown): ChainFacts {
  const codes = new Set<string>()
  const names = new Set<string>()
  const messages: string[] = []
  const seen = new Set<object>()
  const pending: unknown[] = [error]
  let visited = 0

  while (pending.length > 0 && visited < MAX_CHAIN_NODES) {
    const current = pending.pop()
    visited += 1
    if (typeof current !== 'object' || current === null || seen.has(current)) continue
    seen.add(current)
    const node = current as {
      cause?: unknown
      code?: unknown
      name?: unknown
      message?: unknown
      errors?: unknown
    }
    if (typeof node.code === 'string') codes.add(node.code)
    if (typeof node.name === 'string') names.add(node.name)
    if (typeof node.message === 'string') messages.push(node.message)
    if (node.cause !== undefined) pending.push(node.cause)
    if (Array.isArray(node.errors)) pending.push(...node.errors)
  }

  return { codes: [...codes], names: [...names], messages }
}

function firstPresent<T extends string | number>(
  found: readonly T[],
  wanted: readonly T[],
): T | null {
  for (const item of wanted) {
    if (found.includes(item)) return item
  }
  return null
}

function retrySafe(reason: string): EgressRetryVerdict {
  return { decision: 'retry-safe', reason }
}

function resultUnknown(reason: string): EgressRetryVerdict {
  return { decision: 'result-unknown', reason }
}

function permanentFail(reason: string): EgressRetryVerdict {
  return { decision: 'permanent-fail', reason }
}

/** 传输层失败的判据:先排除「已发出」的强证据,再看建连前白名单,判不出一律结果未知。 */
function classifyTransportFailure(input: EgressTransportFailureInput): EgressRetryVerdict {
  const { codes, names, messages } = collectChainFacts(input.error)

  // ① 已经拿到过响应 ⇒ 请求必已发出,此后断流与错误码无关。
  if (input.responseReceived === true) {
    return resultUnknown('已取得响应后传输中断,下游可能已执行')
  }
  // ② 超时 / 取消:「没等到答案」不等于「没送出去」。
  const abortName = firstPresent(names, ABORT_LIKE_ERROR_NAMES)
  if (abortName !== null) {
    return resultUnknown(`${abortName}:请求可能已送达并对侧已执行`)
  }
  // ③ 连请求都没构造出来 ⇒ 没发出,且重试必然同样失败。
  const pointlessCode = firstPresent(codes, NEVER_SENT_AND_POINTLESS_CODES)
  if (pointlessCode !== null) {
    return permanentFail(`请求未构造成功(${pointlessCode}),重试同样失败`)
  }
  // ④ 建连阶段白名单:握手/解析都没过 ⇒ 字节必未发出。
  const neverSentCode = firstPresent(codes, NEVER_SENT_ERROR_CODES)
  if (neverSentCode !== null) {
    return retrySafe(`建连前失败(${neverSentCode}),请求字节必未发出`)
  }
  // ⑤ ECONNRESET / ETIMEDOUT:必须看到 connect 阶段证据才算「没发出」。
  const phaseCode = firstPresent(codes, CONNECT_PHASE_EVIDENCE_CODES)
  if (phaseCode !== null) {
    const hasConnectEvidence = messages.some((message) =>
      CONNECT_PHASE_EVIDENCE_PATTERNS.some((pattern) => pattern.test(message)),
    )
    return hasConnectEvidence
      ? retrySafe(`${phaseCode} 且证据是 connect 阶段,请求字节必未发出`)
      : resultUnknown(`${phaseCode} 无 connect 阶段证据,请求可能已写出`)
  }
  // ⑥ 判不出:既不冒红也不记绿 —— 交人工/对账,不自动重放。
  const counted = codes.length > 0 ? codes.join(',') : '无错误码'
  return resultUnknown(`无建连阶段证据(${counted}),无法判定请求是否已发出`)
}

/** 拿到了响应但状态码非成功:非幂等请求只在「服务端明确未进入业务处理」的档位上重试。 */
function classifyHttpResponse(input: EgressHttpResponseInput): EgressRetryVerdict {
  const { status, idempotent = false } = input
  const always = firstPresent<number>([status], ALWAYS_RETRYABLE_STATUSES)
  if (always !== null) {
    return retrySafe(`${status}:服务端在进入业务处理前即拒绝,重放不产生副作用`)
  }
  if (idempotent && firstPresent<number>([status], IDEMPOTENT_ONLY_RETRYABLE_STATUSES) !== null) {
    return retrySafe(`${status} 且请求幂等,重放无副作用`)
  }
  if (status >= 500) {
    return resultUnknown(`${status}:非幂等请求可能已被对侧执行`)
  }
  if (status >= 400) {
    return permanentFail(`${status}:请求已被对侧明确拒绝,重试同样失败`)
  }
  return permanentFail(`${status}:非失败响应,不在重试面内`)
}

/**
 * 唯一出口:一次出站调用的失败该按哪种处置走。
 *
 * 用法:`const verdict = classifyEgressRetryOutcome({ kind: 'transport-failure', error })`
 * / `classifyEgressRetryOutcome({ kind: 'http-response', status, idempotent: false })`。
 * 只有 `verdict.decision === 'retry-safe'` 才允许自动重放非幂等写请求。
 */
export function classifyEgressRetryOutcome(input: EgressRetryInput): EgressRetryVerdict {
  return input.kind === 'http-response'
    ? classifyHttpResponse(input)
    : classifyTransportFailure(input)
}
