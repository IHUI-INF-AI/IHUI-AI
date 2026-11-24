// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 腾讯云短信回调的解析与验签判据(纯函数,便于成对夹具)。
 *
 * 两类回调共用一套入口:
 *  - 状态回执:字段里带 result / error_code / status / serial_no,表示某条短信最终投递结果;
 *  - 上行回复:字段里带 content(用户回复的正文),没有投递状态字段。
 *
 * 安全前提:腾讯云回调本身**不带签名**。可用的两道闸是
 *  ① URL 上的共享 token(`SMS_CALLBACK_TOKEN`);
 *  ② 控制台侧固定出口 IP 白名单(`SMS_CALLBACK_IP_ALLOWLIST`)。
 * 两个变量都完全未设置时函数仍返回 true(否则首次接入会一直 403),调用方必须打 warning
 * 并把事件限定为"本地存在对应发送记录"才落库 —— 不能让任何人凭空给任意号码写退订。
 * 配置了却只有空白/逗号等无有效项的取值 ⇒ 视为配置错误直接拒绝(fail-closed)。
 */

export type TencentCallbackKind = 'status' | 'reply' | 'unknown'

export interface TencentCallbackMeta {
  phone: string
  content?: string
  requestId?: string
  serialNo?: string
  templateId?: string
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

function firstStr(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = str(obj[k])
    if (v) return v
  }
  return undefined
}

/** 从任意回调体里取对账所需字段;取不到手机号 ⇒ unknown,调用方直接丢弃。 */
export function parseTencentCallback(body: unknown): TencentCallbackMeta | null {
  if (!body || typeof body !== 'object') return null
  const obj = body as Record<string, unknown>
  // 部分回调会包一层 data / payload
  const nested =
    obj.data && typeof obj.data === 'object' ? (obj.data as Record<string, unknown>) : obj
  const phone = firstStr(nested, ['phone_number', 'phoneNumber', 'mobile', 'phone'])
  if (!phone) return null
  return {
    phone,
    content: firstStr(nested, ['content', 'text', 'msg', 'reply']),
    requestId: firstStr(nested, ['request_id', 'requestId', 'RequestId']),
    serialNo: firstStr(nested, ['serial_no', 'serialNo', 'SerialNo']),
    templateId: firstStr(nested, ['template_id', 'templateId', 'TemplateId']),
  }
}

/** 有投递状态字段 ⇒ status;只有正文 ⇒ reply。两者都有时以状态字段优先
 *  (状态回执偶尔也会带 content 字段,那是模板内容,不是用户回复)。 */
export function classifyTencentCallback(body: unknown): TencentCallbackKind {
  if (!body || typeof body !== 'object') return 'unknown'
  const obj = body as Record<string, unknown>
  const nested =
    obj.data && typeof obj.data === 'object' ? (obj.data as Record<string, unknown>) : obj
  const hasStatusField = [
    'result',
    'error_code',
    'errorCode',
    'status',
    'serial_no',
    'serialNo',
  ].some((k) => nested[k] !== undefined)
  const hasContent = ['content', 'text', 'msg', 'reply'].some((k) => str(nested[k]) !== undefined)
  if (hasStatusField) return 'status'
  if (hasContent) return 'reply'
  return 'unknown'
}

export interface TencentReportVerdict {
  delivered: boolean
  /** 只留机器码,不留云侧自由文本 */
  code: string
}

const DELIVERED_CODES = new Set(['0', 'OK', 'SUCCESS', 'DELIVERED', 'DELIVRD', 'DELIVERY_SUCCESS'])

/** 投递成功判定。腾讯云不同接口版本给的字段不同,三面都认:
 *  result=0 / error_code=DELIVRD(运营商级) / status=DELIVERED。判不出来一律算**失败**。 */
export function judgeTencentReport(body: unknown): TencentReportVerdict {
  if (!body || typeof body !== 'object') return { delivered: false, code: 'unparsable' }
  const obj = body as Record<string, unknown>
  const nested =
    obj.data && typeof obj.data === 'object' ? (obj.data as Record<string, unknown>) : obj

  const rawResult = nested.result ?? nested.Result
  if (rawResult !== undefined) {
    const resultText = String(rawResult).trim().toUpperCase()
    if (resultText === '0' || resultText === 'OK') return { delivered: true, code: 'OK' }
    if (resultText) {
      return { delivered: false, code: `result_${sanitizeCode(resultText)}` }
    }
  }

  for (const key of ['error_code', 'errorCode', 'status', 'Status']) {
    const raw = nested[key]
    if (raw === undefined || raw === null || raw === '') continue
    const code = sanitizeCode(String(raw))
    return {
      delivered: DELIVERED_CODES.has(String(raw).trim().toUpperCase()),
      code: code || 'unknown',
    }
  }

  // 只有 errmsg 时无法判定成功与否 ⇒ 失败(不许默认成功)
  const errmsg = str(nested.errmsg ?? nested.message)
  return { delivered: false, code: errmsg ? 'unknown' : 'unparsable' }
}

function sanitizeCode(v: string): string {
  const t = v
    .trim()
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .slice(0, 64)
  return t || 'unknown'
}

/** 回调体的字符串形态(个别网关按 text/plain 转发)归一为对象。 */
export function coerceCallbackBody(body: unknown): unknown {
  if (typeof body !== 'string') return body
  const t = body.trim()
  if (!t) return null
  try {
    return JSON.parse(t)
  } catch {
    return null
  }
}

function normalizeIp(ip: string): string {
  let t = ip.trim()
  if (t.startsWith('::ffff:')) t = t.slice(7)
  if (t.startsWith('[') && t.includes(']')) t = t.slice(1, t.indexOf(']'))
  return t
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export interface CallbackAuthInput {
  providedToken?: string
  expectedToken?: string
  ip: string
  allowlist?: string
}

function parseAllowlist(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((s) => normalizeIp(s))
    .filter(Boolean)
}

/** 至少一道闸在规范化后真正生效(与 isSmsCallbackAuthorized 同一判据)。
 *  路由必须用它判"已配置":过去用未 trim 的原值判真值,纯空白 token / "," 白名单
 *  会被当成"配了",而服务内 trim 后跳过 ⇒ 两闸同时失效、回调端点无鉴权对外开放。 */
export function isSmsCallbackGateConfigured(input: {
  expectedToken?: string
  allowlist?: string
}): boolean {
  return Boolean(input.expectedToken?.trim()) || parseAllowlist(input.allowlist).length > 0
}

/** 两道闸:配了 token 就必须带对;配了 IP 白名单就必须来自白名单。
 *  两个变量完全未设置时仍放行(保持旧语义,由调用方再用"本地有发送记录"兜底);
 *  但显式配置过却规范化后拿不出任何有效项 = 配置错误,不能退化成"未配置"放行,一律拒绝。 */
export function isSmsCallbackAuthorized(input: CallbackAuthInput): boolean {
  if (input.expectedToken === undefined && input.allowlist === undefined) return true
  const expected = input.expectedToken?.trim()
  const allow = parseAllowlist(input.allowlist)
  if (!expected && allow.length === 0) return false
  if (expected) {
    const provided = input.providedToken?.trim() ?? ''
    if (!provided || !constantTimeEqual(provided, expected)) return false
  }
  if (allow.length > 0 && !allow.includes(normalizeIp(input.ip))) return false
  return true
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
