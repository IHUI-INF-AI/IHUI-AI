// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 错误归因证据强度阶梯(机制吸收 G-937980;上游出处 zcode
 * packages/ui/src/lib/chatErrorAttribution.ts + chatErrorAttributionEvidence.ts)。
 *
 * 核心规则:**证据按可信度排序短路,弱文案永不覆盖强证据**。
 * 每层原子返回同一份证据决定的 (errorSource, failureReason);低层(弱)一旦被高层(强)
 * 抢先命中就永远不再执行。层序(高 → 低):
 *
 *  1. 结构化 reason 中无歧义的 network/runtime 桶 —— reason 自带更窄边界,直接定桶;
 *     quota_exhausted 终态改写需要「可信 providerId + retryable===false」双证据;
 *  2. 稳定传输码(EPIPE/ECONNRESET/ETIMEDOUT 等 errno)—— 字段优先,message 兜底提取;
 *     仅当无更高优先级结构化 reason 时消费,绝不覆盖已有归因(上游 Bug:EPIPE 被
 *     response boundary 的 provider source 盖掉);
 *  3. legacy 三段 envelope([code][provider][message],message 内提取,严格形态);
 *  4. 可信 provider 业务码表(1308→quota_exhausted 等)—— **只对可信 builtin providerId
 *     生效**;上游 1308 号缺陷:自定义 provider 的同名 code 会被误判成套餐/配额语义,
 *     所以 providerId 不在可信名单时业务码一概不采信,只能落到 HTTP 状态码/文案证据;
 *  5. HTTP status 阶梯(401/403→auth_failed、408/504→timeout、429→rate_limited、
 *     5xx→server_error……)—— 字段优先,message 中 keyword-gated 提取次之
 *     (必须有 http/status 关键字前缀,防把 1308 里的 "308" 之类误提);
 *  6. 受控/裸文案匹配 —— **最低优先级证据**。提前返回会覆盖 401/1308 等更可靠的
 *     结构化事实(上游关键判据注释,原文:"受控文案是最低优先级证据,提前返回会覆盖
 *     401/1308 等更可靠结构化事实");因此 401 + quota 字样 ⇒ auth_failed 而非
 *     quota_exhausted,本层只在所有强证据缺席时才轮到。
 *
 * 每条规则的判定都是低基数 allowlist/有限表,不解析自由文本语义;结果只用于
 * 遥测归因/展示分桶,不改变重试或授权行为。
 */

/** 归因来源(空串 = 现有证据不足以定桶,保持 unknown 而不是猜) */
export type ErrorAttributionSource = 'provider' | 'runtime' | 'network' | 'tool' | ''

export interface ErrorAttribution {
  errorSource: ErrorAttributionSource
  /** 低基数失败原因桶(auth_failed / network_error / quota_exhausted / timeout / ...) */
  failureReason: string
}

/** 归因证据输入:结构化字段是强证据,message 永远是最低优先级证据 */
export interface ErrorAttributionEvidence {
  /** 底层错误文本(展示文案与原始 message 的拼接面) */
  message: string
  /** HTTP 状态码(强证据) */
  statusCode?: number
  /** 稳定错误码,如 EPIPE / ECONNRESET / ETIMEDOUT(强证据) */
  errorCode?: string
  /** provider 业务码,如 1308 —— 仅当 providerId 可信时才采信 */
  providerErrorCode?: string
  /** provider 身份;不在可信 builtin 名单内时业务码表一概不采信 */
  providerId?: string
  /** 上游已给出的结构化 reason(空串/'unknown' 视为无) */
  reason?: string
  /** 上游可重试标记(quota 终态改写的第二证据) */
  retryable?: boolean
}

/** 稳定传输错误码(网络层 errno,adapter/OS 已确认语义;上游同表裁剪) */
const STABLE_TRANSPORT_ERROR_CODES = new Set([
  'EPIPE',
  'ECONNABORTED',
  'ECONNRESET',
  'ECONNREFUSED',
  'EAI_AGAIN',
  'ENOTFOUND',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'EADDRNOTAVAIL',
  'EADDRINUSE',
  'ENOBUFS',
  'ENOTCONN',
  'UND_ERR_SOCKET',
])

/** 稳定传输超时码(语义更窄:timeout 而非笼统 network_error) */
const STABLE_TRANSPORT_TIMEOUT_ERROR_CODES = new Set([
  'ETIMEDOUT',
  'ETIMEOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
])

const TRANSPORT_CODE_RE =
  /\b(EPIPE|ECONNABORTED|ECONNRESET|ECONNREFUSED|EAI_AGAIN|ENOTFOUND|ENETUNREACH|EHOSTUNREACH|EADDRNOTAVAIL|EADDRINUSE|ENOBUFS|ENOTCONN|UND_ERR_SOCKET|ETIMEDOUT|ETIMEOUT|UND_ERR_CONNECT_TIMEOUT|UND_ERR_HEADERS_TIMEOUT|UND_ERR_BODY_TIMEOUT)\b/u

/**
 * 可信 builtin provider 名单 —— 业务码表只对这些身份生效。
 * 本地现有 vendor 词表(fallback-models.ts)里,业务码 1005-1321/3001-3012 是
 * zhipu(BigModel/Z.AI)一家的局部词表、ihui_relay 是第一方中转(码表由本方后端定义);
 * 其余(用户自配 provider)同名 code 不得套用该表(上游 1308 号缺陷模式)。
 */
const TRUSTED_PROVIDER_BUSINESS_CODE_IDS: ReadonlySet<string> = new Set(['ihui_relay', 'zhipu'])

/** 可信 provider 业务码 → failureReason(上游 chatErrorAttributionEvidence 同表) */
const PROVIDER_CODE_FAILURE_REASONS: Readonly<Record<string, string>> = {
  '1005': 'quota_exhausted',
  '1006': 'auth_failed',
  '1120': 'server_error',
  '1210': 'invalid_request',
  '1211': 'model_not_found',
  '1214': 'model_not_found',
  '1230': 'server_error',
  '1234': 'network_error',
  '1261': 'context_exceeded',
  '1301': 'invalid_request',
  '1302': 'rate_limited',
  '1303': 'rate_limited',
  '1304': 'quota_exhausted',
  '1305': 'rate_limited',
  '1308': 'quota_exhausted',
  '1309': 'plan_expired',
  '1310': 'quota_exhausted',
  '1311': 'plan_access_denied',
  '1312': 'provider_overloaded',
  '1313': 'quota_exhausted',
  '1314': 'quota_exhausted',
  '1315': 'quota_exhausted',
  '1316': 'quota_exhausted',
  '1317': 'quota_exhausted',
  '1318': 'quota_exhausted',
  '1319': 'quota_exhausted',
  '1320': 'quota_exhausted',
  '1321': 'quota_exhausted',
  '2007': 'server_error',
  '3001': 'invalid_request',
  '3002': 'rate_limited',
  '3006': 'model_not_found',
  '3007': 'auth_failed',
  '3008': 'rate_limited',
  '3009': 'rate_limited',
  '3010': 'rate_limited',
  '1213': 'invalid_request',
  '3012': 'invalid_request',
  '429': 'rate_limited',
}

/** legacy 三段 envelope:([code][provider][message] 尾部可带 request id),严格形态防误收 */
const LEGACY_PROVIDER_ENVELOPE_RE =
  /^\[(\d{3,6})\]\[[^\]\r\n]{1,500}\]\[[^\]\r\n]{4,160}\](?:\s*\(request id: [^)]+\))?$/u

const NETWORK_FAILURE_REASONS = new Set([
  'network_error',
  'proxy_error',
  'stale_connection',
  'stream_idle_timeout',
  'timeout',
  'tls_error',
])

const RUNTIME_FAILURE_REASONS = new Set([
  'storage_error',
  'model_config_missing',
  'stream_recovery_discarded',
  'invalid_input',
  'cancelled',
  'provider_not_configured',
])

const PROVIDER_FAILURE_REASONS = new Set([
  'auth_failed',
  'balance_insufficient',
  'context_exceeded',
  'empty_model_response',
  'model_not_found',
  'plan_access_denied',
  'plan_expired',
  'provider_overloaded',
  'quota_exhausted',
  'server_error',
])

// ---- 弱文案层(最低优先级证据)的模式表;顺序即同层内的先手序,auth 必须先于 quota ----
const WEAK_COPY_PATTERNS: ReadonlyArray<{
  readonly re: RegExp
  readonly source: ErrorAttributionSource
  readonly reason: string
}> = [
  { re: /turn\s+was\s+cancelled|任务已取消/iu, source: 'runtime', reason: 'cancelled' },
  {
    re: /internal\s+server\s+error|a\s+server\s+error\s+occurred|服务端错误|内部错误/iu,
    source: 'provider',
    reason: 'server_error',
  },
  {
    re: /rate[_ -]?limit|too\s+many\s+requests|throttl|请求过于频繁|并发上限/iu,
    source: 'provider',
    reason: 'rate_limited',
  },
  {
    re: /insufficient\s+(?:balance|funds|credit)|余额不足|余额不够/iu,
    source: 'provider',
    reason: 'balance_insufficient',
  },
  {
    re: /context.{0,32}(?:length|window|exceed|limit)|上下文.{0,16}(?:超|限制)/iu,
    source: 'provider',
    reason: 'context_exceeded',
  },
  {
    // auth 先于 quota:401 + quota 字样的裸文案必须归 auth_failed(上游同序)
    re: /unauthori[sz]ed|authentication|invalid\s+(?:api\s+)?key|access\s+denied|鉴权|认证失败/iu,
    source: 'provider',
    reason: 'auth_failed',
  },
  {
    re: /network|connection|econn(?:reset|refused)|enotfound|tls|proxy|socket|网络|连接失败/iu,
    source: 'network',
    reason: 'network_error',
  },
  { re: /timeout|timed\s+out|超时/iu, source: 'network', reason: 'timeout' },
  {
    re: /overload|overloaded|server\s+busy|at\s+capacity|服务繁忙|过载/iu,
    source: 'provider',
    reason: 'provider_overloaded',
  },
  {
    re: /quota|usage\s+limit|limit\s+exhausted|额度|用量上限|使用上限/iu,
    source: 'provider',
    reason: 'quota_exhausted',
  },
  {
    re: /invalid\s+(?:request|argument|parameter)|bad\s+request|参数错误|请求参数/iu,
    source: '',
    reason: 'invalid_request',
  },
]

/**
 * 从 message 提取 HTTP 状态码 —— keyword-gated:必须带 http/status 前缀,
 * 防止把业务码(如 "1308")或普通数字误当状态码。evidence.statusCode 字段永远优先。
 */
const HTTP_STATUS_IN_MESSAGE_RE =
  /\b(?:http(?:\s+status)?|status(?:\s+code)?)\s*[:=]?\s*(\d{3})\b/iu

function resolveSourceFromReason(reason: string): ErrorAttributionSource {
  if (NETWORK_FAILURE_REASONS.has(reason)) return 'network'
  if (RUNTIME_FAILURE_REASONS.has(reason)) return 'runtime'
  if (PROVIDER_FAILURE_REASONS.has(reason)) return 'provider'
  return ''
}

function resolveTransportCodeAttribution(code: string): ErrorAttribution | undefined {
  const normalized = code.trim().toUpperCase()
  if (STABLE_TRANSPORT_TIMEOUT_ERROR_CODES.has(normalized)) {
    return { errorSource: 'network', failureReason: 'timeout' }
  }
  if (STABLE_TRANSPORT_ERROR_CODES.has(normalized)) {
    return { errorSource: 'network', failureReason: 'network_error' }
  }
  return undefined
}

function resolveTrustedProviderCodeFailureReason(
  providerId: string | undefined,
  providerErrorCode: string | undefined,
  errorCode: string | undefined,
): string | undefined {
  const id = providerId?.trim()
  // 可信名单门:上游 1308 号缺陷的根治点。providerId 缺席或不可信 ⇒ 业务码一概不采信。
  if (!id || !TRUSTED_PROVIDER_BUSINESS_CODE_IDS.has(id)) return undefined
  const code = providerErrorCode?.trim() || errorCode?.trim()
  if (!code) return undefined
  return PROVIDER_CODE_FAILURE_REASONS[code]
}

function resolveLegacyEnvelopeCode(message: string): string | undefined {
  return LEGACY_PROVIDER_ENVELOPE_RE.exec(message.trim())?.[1]
}

function resolveStatusCode(evidence: ErrorAttributionEvidence): number | undefined {
  if (evidence.statusCode !== undefined) return evidence.statusCode
  const fromMessage = HTTP_STATUS_IN_MESSAGE_RE.exec(evidence.message)?.[1]
  return fromMessage ? Number(fromMessage) : undefined
}

/**
 * HTTP status 阶梯(强证据;弱文案层之前的最后一道结构化证据)。
 * 顺序对齐上游:413 分流 → 405 → 402+balance 文案 → 401/403 → 408/504 → 429 →
 * 404/410 → 400/422 → 5xx。
 */
function resolveHttpStatusAttribution(
  statusCode: number,
  message: string,
): ErrorAttribution | undefined {
  const asProvider = (failureReason: string): ErrorAttribution => ({
    errorSource: 'provider',
    failureReason,
  })
  if (
    statusCode === 413 &&
    /context.{0,80}(?:exceed|limit)|token.{0,80}(?:exceed|limit)/iu.test(message)
  ) {
    return asProvider('context_exceeded')
  }
  if (statusCode === 413) return asProvider('invalid_request')
  if (statusCode === 405) return asProvider('invalid_request')
  if (statusCode === 402 && /余额不足|insufficient\s+balance/iu.test(message)) {
    return asProvider('balance_insufficient')
  }
  // 401 + quota 文案 ⇒ auth_failed:status 是强证据,quota 只是弱文案,不得反判。
  if (statusCode === 401 || statusCode === 403) return asProvider('auth_failed')
  if (statusCode === 408 || statusCode === 504) {
    return { errorSource: 'network', failureReason: 'timeout' }
  }
  if (statusCode === 429) return asProvider('rate_limited')
  if (statusCode === 404 || statusCode === 410) return asProvider('model_not_found')
  if (statusCode === 400 || statusCode === 422) return asProvider('invalid_request')
  if (statusCode >= 500 && statusCode <= 599) return asProvider('server_error')
  return undefined
}

/**
 * 证据阶梯主入口。层序见文件头注释;每层命中即原子返回,低层永不覆盖高层。
 */
export function resolveErrorAttribution(evidence: ErrorAttributionEvidence): ErrorAttribution {
  const message = evidence.message ?? ''
  const structuredReason = evidence.reason?.trim()
  const hasMeaningfulReason = !!structuredReason && structuredReason !== 'unknown'

  // -- 强证据 ①:结构化 reason(仅当真的有结构化事实时,传输码不得反超) --
  if (hasMeaningfulReason) {
    const reason = structuredReason as string
    const source = resolveSourceFromReason(reason)
    if (source === 'network' || source === 'runtime') {
      // network/runtime reason 自带无歧义边界,直接定桶(上游同判据)
      return { errorSource: source, failureReason: reason }
    }
    // quota_exhausted 终态改写:可信 builtin + retryable===false 双证据缺一不可
    const trustedReason = resolveTrustedProviderCodeFailureReason(
      evidence.providerId,
      evidence.providerErrorCode,
      evidence.errorCode,
    )
    if (
      reason === 'rate_limited' &&
      evidence.retryable === false &&
      trustedReason === 'quota_exhausted'
    ) {
      return { errorSource: 'provider', failureReason: 'quota_exhausted' }
    }
    // 歧义 reason(rate_limited/invalid_request):source 用同一份证据反推;反推不出保持空
    return { errorSource: source, failureReason: reason }
  }

  // -- 强证据 ②:稳定传输码(字段优先,message 兜底;EPIPE ⇒ network_error) --
  const transportCode = evidence.errorCode?.trim()
  if (transportCode) {
    const transport = resolveTransportCodeAttribution(transportCode)
    if (transport) return transport
  } else {
    const fromMessage = TRANSPORT_CODE_RE.exec(message)?.[1]
    if (fromMessage) {
      const transport = resolveTransportCodeAttribution(fromMessage)
      if (transport) return transport
    }
  }

  // -- 强证据 ③:legacy 三段 envelope(message 内严格形态提取) --
  const envelopeCode = resolveLegacyEnvelopeCode(message)
  if (envelopeCode) {
    const reason = PROVIDER_CODE_FAILURE_REASONS[envelopeCode]
    if (reason) {
      // 1234 表示网络失败,不能把 envelope 的载体来源误当成失败边界
      return { errorSource: resolveSourceFromReason(reason) || 'provider', failureReason: reason }
    }
  }

  // -- 强证据 ④:可信 provider 业务码(不可信 providerId 的 1308 不会走到这一层) --
  const trustedReason = resolveTrustedProviderCodeFailureReason(
    evidence.providerId,
    evidence.providerErrorCode,
    evidence.errorCode,
  )
  if (trustedReason) {
    return {
      errorSource: resolveSourceFromReason(trustedReason) || 'provider',
      failureReason: trustedReason,
    }
  }

  // -- 强证据 ⑤:HTTP status 阶梯(字段优先,message keyword-gated 提取次之) --
  const statusCode = resolveStatusCode(evidence)
  if (statusCode !== undefined) {
    const statusAttribution = resolveHttpStatusAttribution(statusCode, message)
    if (statusAttribution) return statusAttribution
  }

  // -- 弱证据 ⑥:受控/裸文案(最低优先级;绝不在 ①-⑤ 之前返回) --
  for (const pattern of WEAK_COPY_PATTERNS) {
    if (pattern.re.test(message)) {
      return { errorSource: pattern.source, failureReason: pattern.reason }
    }
  }

  // -- 兜底:不足以定桶就如实说 unknown,不猜 --
  return { errorSource: '', failureReason: 'unknown' }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
