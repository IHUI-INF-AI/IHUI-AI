// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Trae CN 上游协议纯函数辅助库(2026-10-22 立,配套 trae-adapter.ts)。
 *
 * 只放"无 IO、可单测"的纯函数:多轮扁平化、稳定会话 id、SSE 帧解析、
 * 增量字段探测、token 过期宽松解析、ExchangeToken 报文形状等。
 * 网络调用与错误语义全部留在 trae-adapter.ts 里。
 */
import { createHash, randomBytes, sign as cryptoSign } from 'node:crypto'

// =============================================================================
// 多轮扁平化(FlattenQuery)
// =============================================================================

/** 角色 → 扁平化段标签(上游 remote 会话只收单条 query 文本,多轮靠标签还原) */
const ROLE_LABELS: Record<string, string> = {
  system: '[System Instructions]',
  assistant: '[Previous Assistant Response]',
  tool: '[Tool Result]',
  user: '[User]',
}

/** 未知形状 content → 纯文本(字符串直取;数组取各 part 的 text/content;对象取 text/content) */
export function contentToText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((part) => contentToText(part))
      .filter((s) => s !== '')
      .join('')
  }
  if (content !== null && typeof content === 'object') {
    const o = content as Record<string, unknown>
    if (typeof o.text === 'string') return o.text
    if (typeof o.content === 'string') return o.content
  }
  return ''
}

/**
 * OpenAI messages → Trae 单条 query 文本。
 * 每段 `[标签]\n<正文>`,段间空行;空正文/未知角色的消息跳过。
 */
export function flattenQuery(messages: Array<{ role: string; content: unknown }>): string {
  const sections: string[] = []
  for (const m of messages) {
    const label = ROLE_LABELS[m.role]
    if (!label) continue
    const text = contentToText(m.content)
    if (text === '') continue
    sections.push(`${label}\n${text}`)
  }
  return sections.join('\n\n')
}

// =============================================================================
// query 块数组(线上实证形状)
// =============================================================================

/**
 * 线上 web 客户端把 query 序列化为 [{type:"text",data:{content}}] 块数组,
 * 而非裸文本字符串。空文本产出空数组(上游对空 query 报参数错误)。
 */
export interface TraeQueryBlock {
  type: 'text'
  data: { content: string }
}

export function buildQueryBlocks(text: string): TraeQueryBlock[] {
  return text === '' ? [] : [{ type: 'text', data: { content: text } }]
}

// =============================================================================
// response_format 模拟(上游无该字段,以 system 提示实现)
// =============================================================================

/** json_object 的 JSON-only 固定提示(上游无 response_format,只能提示词约束) */
export const TRAE_JSON_OBJECT_HINT =
  'Respond with a single valid JSON object only. Do not wrap it in Markdown code fences and do not add any prose.'

/**
 * response_format → 追加到 query 头部的提示文本。
 * - json_object → 固定 JSON-only 提示
 * - json_schema → 与网关 applyJsonSchemaResponseFormat 完全同文案(便于 includes 去重)
 * - text/未知/缺失 → null(无需提示)
 */
export function responseFormatHint(responseFormat: unknown): string | null {
  if (responseFormat === null || typeof responseFormat !== 'object') return null
  const rf = responseFormat as Record<string, unknown>
  if (rf.type === 'json_object') return TRAE_JSON_OBJECT_HINT
  if (rf.type === 'json_schema') {
    const js = rf.json_schema
    if (js !== null && typeof js === 'object') {
      const schema = (js as Record<string, unknown>).schema
      if (schema !== undefined) {
        return `Your response must follow this JSON schema: ${JSON.stringify(schema)}`
      }
    }
    return TRAE_JSON_OBJECT_HINT
  }
  return null
}

// =============================================================================
// 稳定会话 id(biz_session_id)
// =============================================================================

/**
 * `sha256(accountId + 0x1f + model)` 格式化成 UUIDv4 形态。
 *
 * 每账号+模型恒定(勿随机:上游按会话维度做风控/配额,随机 id 会被判定异常流量)。
 * 版本位固定 4、变体位固定 10xx,保证输出符合 UUIDv4 形状。
 */
export function deriveBizSessionId(accountId: string, model: string): string {
  const digest = createHash('sha256')
    .update(accountId + String.fromCharCode(0x1f) + model, 'utf8')
    .digest('hex')
  const d = digest.slice(0, 32)
  const variantNibble = ((parseInt(d.slice(16, 17), 16) & 0b1011) | 0b1000).toString(16)
  const s = d.slice(0, 12) + '4' + d.slice(13, 16) + variantNibble + d.slice(17, 32)
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`
}

// =============================================================================
// custom_model 描述符(线上 web 客户端 buildSendMessageRequest 实证)
// =============================================================================

function nonEmptyString(v: unknown): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined
}

/**
 * reasoning 等级裁决(以 model_list 的 reasoning_effort_config 为权威枚举):
 * - 未请求 / 显式 support_thinking=false / 无枚举 → 不发
 * - 命中 options → 原样请求值
 * - 未命中 → default_level(必须也在 options 内),否则不发
 */
export function resolveReasoningEffortLevel(
  modelConfig: Record<string, unknown> | null | undefined,
  requested: string | number | undefined,
): string | number | undefined {
  if (requested === undefined || requested === null || requested === '') return undefined
  const raw = modelConfig?.reasoning_effort_config
  if (raw === null || typeof raw !== 'object') return undefined
  const cfg = raw as Record<string, unknown>
  if (cfg.support_thinking === false) return undefined
  const options = Array.isArray(cfg.options) ? cfg.options : []
  if (options.length === 0) return undefined
  const wanted = String(requested)
  const hit = options.find(
    (o) => (typeof o === 'string' || typeof o === 'number') && String(o) === wanted,
  )
  if (hit !== undefined) return requested
  const fallback = cfg.default_level
  if (
    (typeof fallback === 'string' || typeof fallback === 'number') &&
    options.some((o) => String(o) === String(fallback))
  ) {
    return fallback
  }
  return undefined
}

/**
 * 组装 custom_model(仅手动选模;auto 由服务端选,不带此字段)。
 *
 * 字段语义与线上一致:is_preset/config_source/config_name 标识预设模型,
 * model_name/display_model_name 传展示名,use_remote_service 表示走远端服务。
 * provider/ak/base_url/custom_model_id/custom_model_type/multimodal/prompt_max_tokens
 * 只在 model_list 真给了值时才写入 —— 绝不臆造模型路由信息。
 */
export function buildTraeCustomModel(
  model: string,
  modelConfig?: Record<string, unknown> | null,
  reasoningEffort?: string | number,
): Record<string, unknown> | undefined {
  if (model === '' || model === 'auto') return undefined
  const baseModel = model.endsWith('-work') ? model.slice(0, -5) : model
  if (baseModel === '') return undefined
  const cfg = modelConfig ?? {}

  const rawConfigSource = cfg.config_source
  const isPreset =
    cfg.is_preset !== undefined
      ? Boolean(cfg.is_preset)
      : rawConfigSource === undefined
        ? true
        : String(rawConfigSource) === '1'
  const modelName = nonEmptyString(cfg.model_name) ?? nonEmptyString(cfg.name) ?? baseModel
  const customModel: Record<string, unknown> = {
    is_preset: isPreset,
    config_name: nonEmptyString(cfg.config_name) ?? nonEmptyString(cfg.name) ?? baseModel,
    config_source: rawConfigSource ?? 1,
    model_name: modelName,
    display_model_name:
      nonEmptyString(cfg.display_name) ?? nonEmptyString(cfg.display_model_name) ?? modelName,
    use_remote_service:
      cfg.use_remote_service !== undefined
        ? Boolean(cfg.use_remote_service)
        : !Boolean(cfg.client_connect),
  }

  const provider = nonEmptyString(cfg.provider)
  if (provider) customModel.provider = provider
  const ak = nonEmptyString(cfg.ak)
  if (ak) customModel.ak = ak
  const baseUrl = nonEmptyString(cfg.base_url)
  if (baseUrl) customModel.base_url = baseUrl
  const customModelId = nonEmptyString(cfg.custom_model_id)
  if (customModelId) customModel.custom_model_id = customModelId
  const customModelType = nonEmptyString(cfg.custom_model_type)
  if (customModelType) customModel.custom_model_type = customModelType
  if (typeof cfg.multimodal === 'boolean') customModel.multimodal = cfg.multimodal
  if (typeof cfg.prompt_max_tokens === 'number') {
    customModel.prompt_max_tokens = cfg.prompt_max_tokens
  }

  const level = resolveReasoningEffortLevel(modelConfig, reasoningEffort)
  if (level !== undefined) customModel.reasoning_effort_level = level

  return customModel
}

// =============================================================================
// SSE 事件流解析
// =============================================================================

/** 一条 SSE 事件(缺省事件名按 SSE 规范为 "message") */
export interface TraeSseEvent {
  event: string
  data: string
}

/** 事件名归一化别名表(上游驼峰连写 → 下划线规范名) */
const EVENT_NAME_ALIASES: Record<string, string> = {
  tokenusage: 'token_usage',
  modelconfig: 'model_config',
  planitem: 'plan_item',
}

/** 事件名归一化:小写 + 别名映射 */
export function normalizeEventName(name: string): string {
  const lower = name.trim().toLowerCase()
  return EVENT_NAME_ALIASES[lower] ?? lower
}

/** 终止事件名(data 为 [DONE] 之外的另一路终止信号) */
export const TERMINAL_EVENT_NAMES: ReadonlySet<string> = new Set([
  'done',
  'response_done',
  'stream_done',
])

/** 解析单个 SSE 事件块(不含块间空行);心跳/注释行以 ":" 开头,忽略 */
export function parseSseEventBlock(block: string): TraeSseEvent | null {
  let event: string | null = null
  const dataLines: string[] = []
  for (const line of block.split('\n')) {
    if (line === '' || line.startsWith(':')) continue // 空行/心跳注释行
    if (line.startsWith('event:')) {
      event = line.slice(6).trim()
    } else if (line.startsWith('data:')) {
      let v = line.slice(5)
      if (v.startsWith(' ')) v = v.slice(1) // SSE 规范:冒号后单空格剥离
      dataLines.push(v)
    }
  }
  if (event === null && dataLines.length === 0) return null
  return { event: event ?? 'message', data: dataLines.join('\n') }
}

/**
 * 增量喂入缓冲区 → 完整事件列表 + 未完结余量。
 * 先归一 \r\n → \n,再按空行(\n\n)切块;最后一段无终止空行时留在 rest 里等下一批。
 */
export function splitSseBlocks(buffer: string): { events: TraeSseEvent[]; rest: string } {
  const normalized = buffer.replace(/\r\n/g, '\n')
  const parts = normalized.split('\n\n')
  const rest = parts.pop() ?? ''
  const events: TraeSseEvent[] = []
  for (const block of parts) {
    const ev = parseSseEventBlock(block)
    if (ev) events.push(ev)
  }
  return { events, rest }
}

/**
 * ReadableStream → SSE 事件异步序列。
 * 流结束时对残段做一次补解析(部分服务端最后一块不带终止空行)。
 */
export async function* iterateSseEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<TraeSseEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) buffer += decoder.decode(value, { stream: true })
      const { events, rest } = splitSseBlocks(buffer)
      buffer = rest
      for (const ev of events) yield ev
    }
    buffer += decoder.decode()
    if (buffer !== '') {
      const ev = parseSseEventBlock(buffer.replace(/\r\n/g, '\n'))
      if (ev) yield ev
    }
  } finally {
    reader.releaseLock()
  }
}

// =============================================================================
// 帧字段探测(文本增量 / 推理增量 / usage / error)
// =============================================================================

/**
 * 文本增量探测(按优先级):
 * delta / text / content / value / message.delta / message.text / data.delta / data.text。
 * content 为数组时按 parts 拼接。空串视为无增量(避免产出空 delta 帧)。
 */
export function extractTextDelta(obj: Record<string, unknown>): string | null {
  for (const key of ['delta', 'text', 'content', 'value'] as const) {
    const v = obj[key]
    if (typeof v === 'string' && v !== '') return v
    if (Array.isArray(v)) {
      const t = contentToText(v)
      if (t !== '') return t
    }
  }
  for (const [parentKey, childKey] of [
    ['message', 'delta'],
    ['message', 'text'],
    ['data', 'delta'],
    ['data', 'text'],
  ] as const) {
    const parent = obj[parentKey]
    if (parent !== null && typeof parent === 'object' && !Array.isArray(parent)) {
      const v = (parent as Record<string, unknown>)[childKey]
      if (typeof v === 'string' && v !== '') return v
    }
  }
  return null
}

/**
 * 推理增量探测(reasoning_content / reasoning / thinking 字段,仅字符串)。
 * 注意:线上实证(2026-10-23)reasoning_content 实为**累积快照**(每帧携带当前全文,
 * 随事件重发多次),差分化在 translateUpstreamEvents 内做,本函数只负责取字段。
 */
export function extractReasoningDelta(obj: Record<string, unknown>): string | null {
  for (const key of ['reasoning_content', 'reasoning', 'thinking'] as const) {
    const v = obj[key]
    if (typeof v === 'string' && v !== '') return v
  }
  return null
}

/**
 * 正文快照探测(线上实证 2026-10-23):正文答案住 `thought` 字段,且是**累积快照**——
 * 每帧携带当前全文(未开始时为空串),同一快照会随事件重发多次。不是增量,不能直接 append。
 */
export function extractThoughtSnapshot(obj: Record<string, unknown>): string | null {
  const v = obj['thought']
  return typeof v === 'string' && v !== '' ? v : null
}

/**
 * GetUserToken(web 官网 cookie 换票)响应解析。
 * 线上实证(2026-10-23)形状:{ Result: { Token: <JWT>, ExpiredAt, UserID, TenantID } }。
 * ExpiredAt 兼容 unix 秒/毫秒/ISO 字符串;全解不出时用 JWT payload.exp;仍解不出 ⇒ null(未知),
 * 不再兜底 6h —— 猜出来的未来时刻会被当成"票仍可用"的证据。
 */
export function extractGetUserTokenPayload(
  body: unknown,
): { token: string; expiresAt: Date | null } | null {
  const top = body !== null && typeof body === 'object' ? (body as Record<string, unknown>) : null
  const result =
    top && top['Result'] !== null && typeof top['Result'] === 'object'
      ? (top['Result'] as Record<string, unknown>)
      : null
  const token = result && typeof result['Token'] === 'string' ? result['Token'] : ''
  if (!token) return null
  let expiresAt: Date | null = null
  const raw = result?.['ExpiredAt']
  const fromNumber = (n: number): Date => new Date(n < 1e12 ? n * 1000 : n)
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    expiresAt = fromNumber(raw)
  } else if (typeof raw === 'string' && raw !== '') {
    const n = Number(raw)
    if (Number.isFinite(n) && n > 0) expiresAt = fromNumber(n)
    else {
      const d = new Date(raw)
      if (!Number.isNaN(d.getTime())) expiresAt = d
    }
  }
  if (!expiresAt || Number.isNaN(expiresAt.getTime())) {
    try {
      const payload = JSON.parse(
        Buffer.from(token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(
          'utf8',
        ),
      ) as { exp?: number }
      if (typeof payload?.exp === 'number' && payload.exp > 0) {
        expiresAt = new Date(payload.exp * 1000)
      }
    } catch {
      /* JWT 形态不合法,走兜底 */
    }
  }
  return { token, expiresAt }
}

/** OpenAI usage 形状(reasoning/cached 为 Trae 帧字段归一注入,便于网关 tap 统一提取) */
export interface OpenAiUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  prompt_tokens_details: { cached_tokens: number }
  completion_tokens_details: { reasoning_tokens: number }
}

/** web_user_ent_usage 归一余额(线上实证 2026-10-23:usage_summary + user_entitlement_pack_list) */
export interface TraeEntUsage {
  used: number
  total: number
  /** consumed/total,0..1;上游未给且算不出时缺省 */
  ratio?: number
  packs: Array<{ name?: string; limit?: number; endAt?: string }>
}

function asRec(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null
}

/**
 * 积分余额响应解析:GET /trae/api/v2/pay/web_user_ent_usage。
 * 线上实证 200 形状(2026-10-23,Authorization: Cloud-IDE-JWT;无 cookie 时 401/1001):
 * { is_credits_billing, is_pay_freshman, trial_status,
 *   usage_summary: { consumed_amount, total_amount, consumption_ratio },
 *   user_entitlement_pack_list: [{ display_desc, group_name, expire_time,
 *     entitlement_base_info: { end_time, quota: { credits_limit } },
 *     quota: { credits_limit }, usage: { credits_amount } }] }
 * 包名只在 display_desc/group_name(无 name 键);到期时刻在 expire_time 与
 * entitlement_base_info.end_time(秒),quota 内只有 credits_limit。
 * usage.credits_amount 语义未取证(不知是已用还是余量)⇒ 不映射成 remaining。
 * 兼容 {code,data:{...}} 包裹层(仅作防御,实证未出现)。usage_summary 缺失 ⇒ null(不猜)。
 */
export function extractEntUsage(body: unknown): TraeEntUsage | null {
  const top = asRec(body)
  if (!top) return null
  const src = asRec(top.data) ?? top
  const summary = asRec(src.usage_summary)
  if (!summary) return null
  const used = num(summary.consumed_amount) ?? num(summary.used_amount)
  const total = num(summary.total_amount)
  if (used === null && total === null) return null
  const ratio =
    num(summary.consumption_ratio) ??
    (used !== null && total !== null && total > 0 ? used / total : undefined)
  const rawPacks = Array.isArray(src.user_entitlement_pack_list)
    ? src.user_entitlement_pack_list
    : []
  const packs = rawPacks
    .map((p) => {
      const rec = asRec(p)
      if (!rec) return null
      const quota = asRec(rec.quota)
      const base = asRec(rec.entitlement_base_info)
      const limit =
        num(quota?.credits_limit) ?? num(base?.credits_limit) ?? num(quota?.total_amount)
      const endSec = num(rec.expire_time) ?? num(base?.end_time)
      return {
        name: str(rec.display_desc) ?? str(rec.group_name),
        limit: limit === null ? undefined : limit,
        endAt: endSec === null ? undefined : new Date(endSec * 1000).toISOString(),
      }
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)
  return { used: used ?? 0, total: total ?? 0, ratio, packs }
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined
}

/**
 * token_usage 帧探测:事件名为 token_usage/usage 时整帧即 usage 对象;
 * 否则找 obj.usage 子对象。字段兼容 input_tokens/prompt_tokens、
 * output_tokens/completion_tokens、cached_tokens。无任何计数字段 → null。
 */
export function extractUsage(obj: Record<string, unknown>, eventName: string): OpenAiUsage | null {
  let src: Record<string, unknown> | null = null
  if (eventName === 'token_usage' || eventName === 'usage') src = obj
  else if (obj.usage !== null && typeof obj.usage === 'object' && !Array.isArray(obj.usage)) {
    src = obj.usage as Record<string, unknown>
  }
  if (!src) return null
  const prompt = num(src.input_tokens) ?? num(src.prompt_tokens)
  const completion = num(src.output_tokens) ?? num(src.completion_tokens)
  const cached = num(src.cached_tokens) ?? num(src.cache_creation_input_tokens)
  const reasoning = num(src.reasoning_tokens) ?? num(src.reasoning_output_tokens)
  if (prompt === null && completion === null && cached === null && reasoning === null) return null
  const p = prompt ?? 0
  const c = completion ?? 0
  return {
    prompt_tokens: p,
    completion_tokens: c,
    total_tokens: num(src.total_tokens) ?? p + c,
    prompt_tokens_details: { cached_tokens: cached ?? 0 },
    completion_tokens_details: { reasoning_tokens: reasoning ?? 0 },
  }
}

/**
 * error 帧探测:{code, message|error|detail}。
 * 判据:code 为数字形态(非 0),或带 error/detail 字段;普通内容帧不会误中。
 */
export function extractErrorInfo(
  obj: Record<string, unknown>,
): { code: string; message: string } | null {
  const codeRaw = obj.code
  const numericCode =
    typeof codeRaw === 'number' && Number.isFinite(codeRaw) && codeRaw !== 0
      ? String(codeRaw)
      : typeof codeRaw === 'string' && /^-?\d+$/.test(codeRaw) && codeRaw !== '0'
        ? codeRaw
        : null
  const hasErrorField = obj.error !== undefined || obj.detail !== undefined
  if (numericCode === null && !hasErrorField) return null
  const msg = [obj.message, obj.error, obj.detail].find((v) => typeof v === 'string' && v !== '')
  const msgStr =
    typeof msg === 'string'
      ? msg
      : obj.error !== undefined && typeof obj.error !== 'string'
        ? JSON.stringify(obj.error)
        : ''
  return { code: numericCode ?? 'unknown', message: msgStr }
}

// =============================================================================
// Token 刷新报文(ExchangeToken)
// =============================================================================

/** Trae OAuth ExchangeToken 固定 ClientID(web 渠道公开常量) */
export const TRAE_OAUTH_CLIENT_ID = 'ono9krqynydwx5'

/** SOLO 线客户端 ClientID(桌面 SOLO 客户端签发的票用它续;开源实现同源常量) */
export const TRAE_OAUTH_CLIENT_ID_SOLO = 'en1oxy7wnw8j9n'

/**
 * 设备证明通道的「ClientID × 产品线」组合链(2026-10-25,对表开源实现):
 * 票由哪条产品线签发就只能用哪条线续 —— TRAE 线签发的票用 SOLO 组合会被 10101/20403 拒,
 * 反之亦然。按顺序试到成功为止;失败不消耗 rt(只有 2xx 才轮换)。
 */
export const TRAE_EXCHANGE_TOKEN_COMBOS: ReadonlyArray<{
  clientId: string
  platformCode: 'IDE_PC' | 'SOLO_PC'
}> = [
  { clientId: TRAE_OAUTH_CLIENT_ID, platformCode: 'IDE_PC' },
  { clientId: TRAE_OAUTH_CLIENT_ID_SOLO, platformCode: 'SOLO_PC' },
]

/** ExchangeToken 请求体固定形状(ClientSecret/UserID 为占位常量) */
export function buildExchangeTokenBody(refreshToken: string): Record<string, string> {
  return {
    ClientID: TRAE_OAUTH_CLIENT_ID,
    RefreshToken: refreshToken,
    ClientSecret: '-',
    UserID: '',
  }
}

// =============================================================================
// ExchangeToken 设备证明(新版端点,2026-10-25 实测:缺证明回 20405/10101)
// =============================================================================

/**
 * 新版续票端点:桌面渠道签发/续期的唯一通道。
 * 旧 `/cloudide/.../ExchangeToken` 只认 web 渠道签发的票;桌面客户端签发的 rt
 * 必须走这里,并且带 DeviceProof(ECDSA P-256 设备私钥签名)。
 */
export const TRAE_EXCHANGE_TOKEN_PROOF_URL = 'https://api.trae.cn/trae/api/v3/oauth/ExchangeToken'

/** 签名 canonical 第二行:必须与真实请求路径逐字一致(客户端同款) */
export const TRAE_EXCHANGE_TOKEN_PROOF_PATH = '/trae/api/v3/oauth/ExchangeToken'

/** 客户端版本(进 DeviceInfo.ClientVersion / IDEVersion;与设备密钥无关,只作身份档位) */
export const TRAE_IDE_VERSION = '1.107.1'

/** P-256 曲线阶(低 s 归一化用;导出供单测核对半区) */
export const P256_ORDER = BigInt(
  '0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551',
)

export interface TraeDeviceMaterial {
  deviceId: string
  machineId?: string
  privateKeyPem: string
  publicKeyPem: string
  /** 可选展示字段(与客户端真实 DeviceInfo 对齐用;缺省 'PC'/空) */
  deviceName?: string
  deviceModel?: string
  deviceBrand?: string
}

export interface TraeDeviceProof extends TraeDeviceMaterial {
  refreshToken: string
  clientId?: string
  platformCode?: 'IDE_PC' | 'SOLO_PC'
  /** 注入点(单测固定时刻/随机数用;生产不传) */
  timestamp?: number
  nonce?: string
}

function derEncodeInt(raw: Buffer): Buffer {
  let i = 0
  while (i < raw.length - 1 && raw[i] === 0) i++
  let v = raw.subarray(i)
  if ((v[0] ?? 0) & 0x80) v = Buffer.concat([Buffer.from([0]), v])
  return Buffer.concat([Buffer.from([0x02, v.length]), v])
}

/** P1363(r||s 各 32B) → DER,并把 s 归一化为低半区(客户端同款) */
export function p1363ToDerLowS(raw: Buffer): Buffer {
  if (raw.length !== 64) throw new Error(`P-256 签名长度应为 64B,实际 ${raw.length}B`)
  const r = raw.subarray(0, 32)
  let s = raw.subarray(32)
  const sVal = BigInt(`0x${s.toString('hex')}`)
  if (sVal > P256_ORDER / 2n) {
    s = Buffer.from((P256_ORDER - sVal).toString(16).padStart(64, '0'), 'hex')
  }
  const body = Buffer.concat([derEncodeInt(r), derEncodeInt(s)])
  return Buffer.concat([Buffer.from([0x30, body.length]), body])
}

/** ECDSA P-256 / SHA-256,返回 base64(DER 低 s)—— 与服务端验签口径一致 */
export function signTraeDeviceProof(privateKeyPem: string, canonical: string): string {
  const raw = cryptoSign('sha256', Buffer.from(canonical, 'utf8'), {
    key: privateKeyPem,
    dsaEncoding: 'ieee-p1363',
  })
  return p1363ToDerLowS(raw).toString('base64')
}

/** 设备证明 canonical 串(单列导出:单测逐字钉形状) */
export function buildTraeProofCanonical(i: {
  clientId: string
  refreshToken: string
  timestamp: number
  nonce: string
}): string {
  return [
    'POST',
    TRAE_EXCHANGE_TOKEN_PROOF_PATH,
    i.clientId,
    i.refreshToken,
    String(i.timestamp),
    i.nonce,
  ].join('\n')
}

export interface TraeDeviceProofPayload {
  DeviceInfo: Record<string, string>
  DeviceProof: { Timestamp: number; Nonce: string; Signature: string }
  clientId: string
}

/** 构造 (DeviceInfo, DeviceProof) —— 新版 ExchangeToken 报文的两个附加块 */
export function buildTraeDeviceProof(i: TraeDeviceProof): TraeDeviceProofPayload {
  const clientId = i.clientId ?? TRAE_OAUTH_CLIENT_ID
  const timestamp = i.timestamp ?? Math.floor(Date.now() / 1000)
  const nonce = i.nonce ?? randomBytes(16).toString('hex')
  const canonical = buildTraeProofCanonical({
    clientId,
    refreshToken: i.refreshToken,
    timestamp,
    nonce,
  })
  return {
    clientId,
    DeviceProof: {
      Timestamp: timestamp,
      Nonce: nonce,
      Signature: signTraeDeviceProof(i.privateKeyPem, canonical),
    },
    DeviceInfo: {
      DeviceID: i.deviceId,
      MachineID: i.machineId ?? '',
      PlatformCode: i.platformCode ?? 'IDE_PC',
      DeviceType: 'PC',
      DeviceName: i.deviceName ?? 'PC',
      DeviceModel: i.deviceModel ?? '',
      ClientVersion: TRAE_IDE_VERSION,
      DevicePublicKey: i.publicKeyPem,
      DeviceBrand: i.deviceBrand ?? '',
      DeviceCPU: '',
      OSInfo: 'Windows',
      OSVersion: '',
    },
  }
}

/** 新版 ExchangeToken 完整请求体 */
export function buildExchangeTokenProofBody(i: TraeDeviceProof): Record<string, unknown> {
  const { clientId, DeviceInfo, DeviceProof } = buildTraeDeviceProof(i)
  return {
    ClientID: clientId,
    ClientSecret: '',
    RefreshToken: i.refreshToken,
    DeviceInfo,
    DeviceProof,
    IDEVersion: TRAE_IDE_VERSION,
  }
}

/** 从账号 secrets 解设备材料;缺任一必需项 → null(调用方退回旧通道) */
export function deviceMaterialFromSecrets(
  secrets: Record<string, unknown> | null | undefined,
  deviceId: string | null | undefined,
  machineId: string | null | undefined,
): TraeDeviceMaterial | null {
  const priv = typeof secrets?.['deviceKeyPem'] === 'string' ? secrets['deviceKeyPem'].trim() : ''
  const pub = typeof secrets?.['devicePubPem'] === 'string' ? secrets['devicePubPem'].trim() : ''
  const did = typeof deviceId === 'string' ? deviceId.trim() : ''
  if (!priv || !pub || !did) return null
  const str = (k: string): string | undefined => {
    const v = secrets?.[k]
    return typeof v === 'string' && v.trim() ? v.trim() : undefined
  }
  // 设备展示字段可选覆盖(secrets.deviceName/deviceModel/deviceBrand):
  // 默认不传 → 'PC' / 空串;要与客户端真实 DeviceInfo 对齐时才填。
  return {
    deviceId: did,
    machineId: machineId ?? undefined,
    privateKeyPem: priv,
    publicKeyPem: pub,
    deviceName: str('deviceName'),
    deviceModel: str('deviceModel'),
    deviceBrand: str('deviceBrand'),
  }
}

/**
 * 过期时刻宽松解析:unix 秒(<1e12)/毫秒(>=1e12)/ISO 字符串均可;
 * 纯数字字符串按数字处理。无法解析 → null(调用方决定兜底)。
 */
export function parseExpiresAt(raw: unknown): Date | null {
  if (raw === null || raw === undefined || raw === '') return null
  let n: number | null = null
  if (typeof raw === 'number') n = raw
  else if (typeof raw === 'string') {
    const t = raw.trim()
    if (/^-?\d+(\.\d+)?$/.test(t)) n = Number(t)
    else {
      const parsed = Date.parse(t)
      return Number.isNaN(parsed) ? null : new Date(parsed)
    }
  }
  if (n === null || !Number.isFinite(n) || n <= 0) return null
  // 秒/毫秒启发式:1e12 秒 ≈ 公元 33658 年,超过它的一律按毫秒
  const ms = n < 1e12 ? n * 1000 : n
  return new Date(ms)
}

/** 刷新响应解析结果 */
export interface TraeTokenPayload {
  token: string
  refreshToken: string | null
  expiresAt: Date | null
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'string' && v !== '') return v
  }
  return null
}

function pickAny(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return obj[k]
  }
  return undefined
}

/**
 * ExchangeToken 响应宽松提取:Result/result 包裹层或顶层皆可;
 * Token 兼容 AccessToken/access_token;RefreshToken 可能轮换(有则回传);
 * 过期字段兼容 ExpiredAt/TokenExpireAt。无 Token → null(调用方抛错)。
 */
export function extractTokenPayload(body: unknown): TraeTokenPayload | null {
  if (body === null || typeof body !== 'object') return null
  const top = body as Record<string, unknown>
  const wrapped =
    top.Result !== null && typeof top.Result === 'object'
      ? (top.Result as Record<string, unknown>)
      : top.result !== null && typeof top.result === 'object'
        ? (top.result as Record<string, unknown>)
        : null
  const inner = wrapped ?? top
  const token =
    pickString(inner, ['Token', 'token', 'AccessToken', 'access_token']) ??
    pickString(top, ['Token', 'token', 'AccessToken', 'access_token'])
  if (!token) return null
  const refreshToken =
    pickString(inner, ['RefreshToken', 'refresh_token']) ??
    pickString(top, ['RefreshToken', 'refresh_token'])
  const expiresRaw =
    pickAny(inner, ['ExpiredAt', 'TokenExpireAt']) ?? pickAny(top, ['ExpiredAt', 'TokenExpireAt'])
  return { token, refreshToken: refreshToken ?? null, expiresAt: parseExpiresAt(expiresRaw) }
}
// =============================================================================
// stop 序列本地截断(上游无 stop 字段,流式安全模拟)
// =============================================================================

export interface StopSequenceFilter {
  /** 喂入增量,返回可安全下发的文本;hit=true 表示命中 stop,应立即终止 */
  feed(delta: string): { emit: string; hit: boolean }
  /** 流正常结束:放出扣留的尾部余量(命中 stop 后为空) */
  flush(): string
}

/**
 * 跨帧 stop 序列过滤器。
 *
 * 为覆盖 stop 串被拆在多个 delta 帧的情形,始终扣留尾部 maxLen-1 个字符:
 * - 命中 → 只发命中点之前的文本,并置 hit=true(之后不再放任何字节)
 * - 未命中 → 放出扣留前的部分,尾部继续扣留
 * - 流结束 → flush 放出余量
 * 空列表/无有效串 → null(调用方零开销跳过)。
 */
export function createStopSequenceFilter(
  stops?: readonly string[] | null,
): StopSequenceFilter | null {
  const list = (stops ?? []).filter((s): s is string => typeof s === 'string' && s !== '')
  if (list.length === 0) return null
  const keep = Math.max(...list.map((s) => s.length)) - 1

  let pending = ''
  let hitDone = false

  return {
    feed(delta: string): { emit: string; hit: boolean } {
      if (hitDone) return { emit: '', hit: true }
      const buf = pending + delta
      let hitIndex = -1
      for (const s of list) {
        const idx = buf.indexOf(s)
        if (idx >= 0 && (hitIndex === -1 || idx < hitIndex)) hitIndex = idx
      }
      if (hitIndex >= 0) {
        hitDone = true
        const emit = buf.slice(0, hitIndex)
        pending = ''
        return { emit, hit: true }
      }
      if (buf.length <= keep) {
        pending = buf
        return { emit: '', hit: false }
      }
      const emit = buf.slice(0, buf.length - keep)
      pending = buf.slice(buf.length - keep)
      return { emit, hit: false }
    },
    flush(): string {
      if (hitDone) return ''
      const tail = pending
      pending = ''
      return tail
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
