// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * v1-realtime.ts — OpenAI Realtime API 兼容 WebSocket 端点。
 *
 * 端点: GET /v1/realtime?model=xxx
 * 鉴权: header Authorization: Bearer ihui_xxx(推荐);query 参数 api_key 仅兼容并告警(F-86)
 *
 * 协议兼容 OpenAI Realtime API:
 *   - 客户端→服务端事件:session.update / input_audio_buffer.append / .commit /
 *     conversation.item.create / response.create
 *   - 服务端→客户端事件:session.created / .updated / input_audio_buffer.* /
 *     conversation.item.created / .deleted / response.created / .done /
 *     response.output_audio.delta / .done / response.audio_transcript.delta / .done /
 *     response.text.delta / .done / response.function_call_arguments.delta / .done / error
 *
 * 上游代理:根据 model 选择上游(OpenAI gpt-4o-realtime / gpt-4o-mini-realtime /
 *   阿里 dashscope qwen-audio-realtime),从 process.env.UPSTREAM_REALTIME_BASE +
 *   UPSTREAM_REALTIME_KEY 读取配置,做双向 WebSocket 透传 + dashscope 最小协议转换。
 *
 * 待主 agent 在 routes/index.ts 注册:
 *   import { v1RealtimeRoutes } from './v1-realtime.js'
 *   server.register(v1RealtimeRoutes)  // 无前缀,路由为 /v1/realtime
 */
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { eq } from 'drizzle-orm'
import WebSocket from 'ws'
import { db } from '../db/index.js'
import { declareCapability } from '../utils/capability-guard.js'
import { developerApiKeys, users } from '@ihui/database'
import {
  checkAllowedModels,
  checkExpiresAt,
  checkPerModelRateLimit,
  ipInList,
} from '../plugins/api-key-auth.js'
import { checkKeyIpAcl } from '../services/key-rate-window-service.js'
import { checkQuota, recordCall } from '../services/relay-billing-service.js'

// ===========================================================================
// 类型定义 — OpenAI Realtime API 事件结构(参考官方文档)
// ===========================================================================

/** 语音端点检测配置( VAD)。 */
interface TurnDetection {
  type: 'server_vad' | 'none'
  threshold?: number
  prefix_padding_ms?: number
  silence_duration_ms?: number
}

/** 会话配置(用于 session.update / session.created / session.updated)。 */
interface SessionConfig {
  modalities?: string[]
  voice?: string
  instructions?: string
  turn_detection?: TurnDetection | null
  input_audio_format?: string
  output_audio_format?: string
  input_audio_transcription?: { model: string } | null
  temperature?: number
  max_response_output_tokens?: number | 'inf'
  tools?: ReadonlyArray<Record<string, unknown>>
  tool_choice?: string
}

/** 对话项内容。 */
interface ConversationContent {
  type: 'input_text' | 'input_audio' | 'item_reference' | 'text' | 'audio'
  text?: string
  audio?: string
  id?: string
}

/** 对话项。 */
interface ConversationItem {
  id?: string
  type: 'message' | 'function_call' | 'function_call_output'
  role?: 'user' | 'assistant' | 'system'
  status?: 'completed' | 'incomplete'
  content?: ConversationContent[]
  call_id?: string
  output?: string
}

/** 响应配置(response.create 可选参数)。 */
interface ResponseConfig {
  modalities?: string[]
  instructions?: string
  voice?: string
  output_audio_format?: string
  tools?: ReadonlyArray<Record<string, unknown>>
  tool_choice?: string
  temperature?: number
  max_output_tokens?: number | 'inf'
}

// --- 客户端 → 服务端事件 ---

interface SessionUpdateEvent {
  type: 'session.update'
  event_id?: string
  session: SessionConfig
}

interface InputAudioBufferAppendEvent {
  type: 'input_audio_buffer.append'
  event_id?: string
  audio: string
}

interface InputAudioBufferCommitEvent {
  type: 'input_audio_buffer.commit'
  event_id?: string
}

interface ConversationItemCreateEvent {
  type: 'conversation.item.create'
  event_id?: string
  previous_item_id?: string
  item: ConversationItem
}

interface ResponseCreateEvent {
  type: 'response.create'
  event_id?: string
  response?: ResponseConfig
}

/** 客户端 → 服务端事件联合类型。 */
type ClientToServerEvent =
  | SessionUpdateEvent
  | InputAudioBufferAppendEvent
  | InputAudioBufferCommitEvent
  | ConversationItemCreateEvent
  | ResponseCreateEvent

// --- 服务端 → 客户端事件 ---

interface SessionCreatedEvent {
  type: 'session.created'
  event_id?: string
  session: SessionConfig & { id: string; object: 'realtime.session'; model: string }
}

interface SessionUpdatedEvent {
  type: 'session.updated'
  event_id?: string
  session: SessionConfig & { id: string; object: 'realtime.session'; model: string }
}

interface InputAudioBufferCommittedEvent {
  type: 'input_audio_buffer.committed'
  event_id?: string
  previous_item_id?: string
  item_id: string
}

interface InputAudioBufferClearedEvent {
  type: 'input_audio_buffer.cleared'
  event_id?: string
}

interface InputAudioBufferSpeechStartedEvent {
  type: 'input_audio_buffer.speech_started'
  event_id?: string
  audio_start_ms: number
  item_id: string
}

interface InputAudioBufferSpeechStoppedEvent {
  type: 'input_audio_buffer.speech_stopped'
  event_id?: string
  audio_end_ms: number
  item_id: string
}

interface ConversationItemCreatedEvent {
  type: 'conversation.item.created'
  event_id?: string
  previous_item_id?: string | null
  item: ConversationItem
}

interface ConversationItemDeletedEvent {
  type: 'conversation.item.deleted'
  event_id?: string
  item_id: string
}

interface ResponseCreatedEvent {
  type: 'response.created'
  event_id?: string
  response: {
    id: string
    object: 'realtime.response'
    status: 'in_progress' | 'completed' | 'cancelled' | 'failed' | 'incomplete'
    status_details?: Record<string, unknown>
    output?: ConversationItem[]
    metadata?: Record<string, unknown>
  }
}

interface ResponseDoneEvent {
  type: 'response.done'
  event_id?: string
  response: {
    id: string
    object: 'realtime.response'
    status: 'completed' | 'cancelled' | 'failed' | 'incomplete'
    status_details?: Record<string, unknown>
    output?: ConversationItem[]
    metadata?: Record<string, unknown>
  }
}

interface ResponseOutputAudioDeltaEvent {
  type: 'response.output_audio.delta'
  event_id?: string
  response_id: string
  item_id: string
  output_index: number
  content_index: number
  delta: string
}

interface ResponseOutputAudioDoneEvent {
  type: 'response.output_audio.done'
  event_id?: string
  response_id: string
  item_id: string
  output_index: number
  content_index: number
}

interface ResponseAudioTranscriptDeltaEvent {
  type: 'response.audio_transcript.delta'
  event_id?: string
  response_id: string
  item_id: string
  output_index: number
  content_index: number
  delta: string
}

interface ResponseAudioTranscriptDoneEvent {
  type: 'response.audio_transcript.done'
  event_id?: string
  response_id: string
  item_id: string
  output_index: number
  content_index: number
  transcript: string
}

interface ResponseTextDeltaEvent {
  type: 'response.text.delta'
  event_id?: string
  response_id: string
  item_id: string
  output_index: number
  content_index: number
  delta: string
}

interface ResponseTextDoneEvent {
  type: 'response.text.done'
  event_id?: string
  response_id: string
  item_id: string
  output_index: number
  content_index: number
  text: string
}

interface ResponseFunctionCallArgumentsDeltaEvent {
  type: 'response.function_call_arguments.delta'
  event_id?: string
  response_id: string
  item_id: string
  output_index: number
  delta: string
}

interface ResponseFunctionCallArgumentsDoneEvent {
  type: 'response.function_call_arguments.done'
  event_id?: string
  response_id: string
  item_id: string
  output_index: number
  arguments: string
}

interface ErrorEvent {
  type: 'error'
  event_id?: string
  error: {
    code: string
    message: string
    param?: string | null
    event_id?: string | null
  }
}

/** 服务端 → 客户端事件联合类型。 */
type ServerToClientEvent =
  | SessionCreatedEvent
  | SessionUpdatedEvent
  | InputAudioBufferCommittedEvent
  | InputAudioBufferClearedEvent
  | InputAudioBufferSpeechStartedEvent
  | InputAudioBufferSpeechStoppedEvent
  | ConversationItemCreatedEvent
  | ConversationItemDeletedEvent
  | ResponseCreatedEvent
  | ResponseDoneEvent
  | ResponseOutputAudioDeltaEvent
  | ResponseOutputAudioDoneEvent
  | ResponseAudioTranscriptDeltaEvent
  | ResponseAudioTranscriptDoneEvent
  | ResponseTextDeltaEvent
  | ResponseTextDoneEvent
  | ResponseFunctionCallArgumentsDeltaEvent
  | ResponseFunctionCallArgumentsDoneEvent
  | ErrorEvent

// ===========================================================================
// 常量
// ===========================================================================

/** 模型白名单。 */
const MODEL_WHITELIST = ['gpt-4o-realtime', 'gpt-4o-mini-realtime', 'qwen-audio-realtime'] as const

/** 上游 provider 映射。 */
function resolveProvider(model: string): 'openai' | 'dashscope' | null {
  // 2026-09-13 修复:provider 前缀判定大小写不敏感(model 形参保持原样)
  const m = model.trim().toLowerCase()
  if (m.startsWith('gpt-4o')) return 'openai'
  if (m.startsWith('qwen')) return 'dashscope'
  return null
}

/** WebSocket close code。 */
const CLOSE_CODE = {
  /** API Key 无效(WebSocket 拒绝升级)。 */
  AUTH_FAILED: 4001,
  /** 模型不在白名单。 */
  MODEL_NOT_ALLOWED: 1003,
  /** 上游 realtime 渠道未配置。 */
  UPSTREAM_NOT_CONFIGURED: 5014,
  /** 上游 WebSocket 连接失败。 */
  UPSTREAM_CONNECTION_FAILED: 1011,
} as const

// ===========================================================================
// API Key 校验(F-86:复用共享鉴权判据,WS upgrade 专用)
// ===========================================================================
//
// F-86(2026-11-11):原实现只查 developer_api_keys.status === 'active',
// expiresAt / allowedIps / allowedModels / per-model rateLimit 全部被绕过,
// 且 api_key 从 query 读取(会进入访问日志)。
// WS upgrade 无法直接挂 requireApiKeyAuth preHandler(升级前没有 socket,且历史客户端
// 只带 key、不带 X-Api-Secret),故抽出异步校验函数,判据全部复用既有导出:
// api-key-auth 的 checkExpiresAt / checkAllowedModels / ipInList / checkPerModelRateLimit、
// key-rate-window-service 的 checkKeyIpAcl、relay-billing-service 的 checkQuota。

/** WS 鉴权失败原因。 */
export type RealtimeAuthFailureReason =
  | 'missing_key'
  | 'invalid_key'
  | 'expired'
  | 'ip_denied'
  | 'model_denied'
  | 'rate_limited'
  | 'quota_exceeded'
  | 'backend_unavailable'

/** WS 鉴权结果(ok=true 时携带计费所需的 key/user 标识)。 */
export type RealtimeAuthResult =
  | { ok: true; apiKeyId: string; userId: string }
  | { ok: false; reason: RealtimeAuthFailureReason; message: string; retryAfter?: number }

/** 鉴权所需的 Key 快照(纯数据,便于单测不连库)。 */
export interface RealtimeKeySnapshot {
  id: string
  userId: string
  status: string
  /** users.status:0=禁用 1=正常 3=注销 */
  userStatus: number
  expiresAt: Date | null
  allowedIps: string[] | null
  blockedIps: string[] | null
  allowedModels: string[] | null
}

function authFailed(reason: RealtimeAuthFailureReason, message: string): RealtimeAuthResult {
  return { ok: false, reason, message }
}

/**
 * 纯判据:与 plugins/api-key-auth.authenticateApiKey 共用同一套检查函数
 * (checkExpiresAt / checkKeyIpAcl / checkAllowedModels),不另写匹配算法。
 */
export function evaluateRealtimeKey(
  snapshot: RealtimeKeySnapshot,
  model: string,
  requestIp: string,
): RealtimeAuthResult {
  // 与主鉴权链路一致:Key 状态 + 账号状态(SDB-29)双检
  if (snapshot.status !== 'active' || snapshot.userStatus !== 1) {
    return authFailed('invalid_key', 'Invalid or revoked API key')
  }
  const expiresCheck = checkExpiresAt(snapshot.expiresAt)
  if (!expiresCheck.ok) return authFailed('expired', expiresCheck.reason ?? 'API Key 已过期')
  const ipCheck = checkKeyIpAcl(
    { blockedIps: snapshot.blockedIps, allowedIps: snapshot.allowedIps, requestIp },
    ipInList,
  )
  if (!ipCheck.ok) return authFailed('ip_denied', ipCheck.reason ?? 'IP 不在白名单')
  const modelCheck = checkAllowedModels(snapshot.allowedModels, model)
  if (!modelCheck.ok) return authFailed('model_denied', modelCheck.reason ?? '模型不在白名单')
  return { ok: true, apiKeyId: snapshot.id, userId: snapshot.userId }
}

/** 余额/配额预检的保守 token 预估(与主鉴权链路无 max_tokens 时的默认值一致)。 */
const REALTIME_ESTIMATED_TOKENS = 1000

/**
 * 从请求中提取 API Key:优先 header Authorization: Bearer(F-86:header 为主)。
 * query api_key 仅作兼容保留,命中时记 warn(会进访问日志),下一版本移除。
 */
export function extractApiKey(
  request: FastifyRequest,
): { key: string; source: 'header' | 'query' } | null {
  const auth = request.headers.authorization
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    const key = auth.slice('Bearer '.length).trim()
    if (key) return { key, source: 'header' }
  }
  // 兼容期:历史客户端把 key 放在 query
  const query = request.query as { api_key?: string } | undefined
  if (query?.api_key) {
    request.log.warn(
      { path: request.url.split('?')[0] },
      'v1/realtime: api_key 放在 query 已废弃(会进入访问日志),请改用 Authorization: Bearer',
    )
    return { key: query.api_key, source: 'query' }
  }
  return null
}

/**
 * WS 鉴权 + 配额预检(F-86)。
 * 失败一律 fail-close:该端点直连平台上游 Realtime Key,不能放行未验证/无额度的连接。
 */
export async function authenticateRealtimeApiKey(
  request: FastifyRequest,
  model: string,
): Promise<RealtimeAuthResult> {
  const credential = extractApiKey(request)
  if (!credential) return authFailed('missing_key', 'API key required')

  let joined: { key: typeof developerApiKeys.$inferSelect; userStatus: number } | undefined
  try {
    // P1-3 口径:鉴权关键路径走主库(避免副本延迟导致新 Key 查不到)
    const rows = await db
      .select({ key: developerApiKeys, userStatus: users.status })
      .from(developerApiKeys)
      .innerJoin(users, eq(developerApiKeys.userId, users.id))
      .where(eq(developerApiKeys.key, credential.key))
      .limit(1)
    joined = rows[0]
  } catch (err) {
    request.log.error({ err }, 'v1/realtime: api key lookup failed')
    return authFailed('backend_unavailable', '鉴权服务暂不可用')
  }
  if (!joined) return authFailed('invalid_key', 'Invalid API key')

  const row = joined.key
  const evaluated = evaluateRealtimeKey(
    {
      id: row.id,
      userId: row.userId,
      status: row.status,
      userStatus: joined.userStatus,
      expiresAt: row.expiresAt,
      allowedIps: (row.allowedIps as string[] | null) ?? null,
      blockedIps: (row.blockedIps as string[] | null) ?? null,
      allowedModels: (row.allowedModels as string[] | null) ?? null,
    },
    model,
    request.ip,
  )
  if (!evaluated.ok) return evaluated

  // per-model RPM/TPM:与主鉴权链路同一个共享函数(Redis 滑动窗口)
  const rl = await checkPerModelRateLimit(
    row.id,
    model,
    REALTIME_ESTIMATED_TOKENS,
    row.perModelRpmLimit?.[model],
    row.perModelTpmLimit?.[model],
  )
  if (!rl.allowed) {
    return {
      ok: false,
      reason: 'rate_limited',
      message: rl.reason === 'tpm' ? '超过单模型 TPM 限制' : '超过单模型 RPM 限制',
      retryAfter: rl.retryAfter,
    }
  }
  if (rl.backendUnavailable) {
    // 该端点 100% billable ⇒ 限流后端不可用时 fail-close(与 API_KEY_RATE_LIMIT_FAIL_MODE 默认 close 一致)
    return authFailed('rate_limited', '限流后端不可用,请稍后重试')
  }

  // 余额/配额预检:复用 relay-billing-service.checkQuota(含 Key 级窗口 + 组池/个人余额)
  try {
    const quota = await checkQuota(row.id, REALTIME_ESTIMATED_TOKENS, { clientIp: request.ip })
    if (!quota.allowed) {
      const reasonMap: Record<string, string> = {
        no_balance_token: 'Token 余额不足',
        no_balance_cost: '成本余额不足',
        key_not_found: 'API Key 不存在',
        key_revoked: 'API Key 已被吊销',
        subscription_window_exceeded: '订阅窗口额度已用尽',
        ip_blocked: 'IP 在黑名单',
        ip_not_allowed: 'IP 不在白名单',
        key_rate_window_exceeded: '超过 Key 级限流窗口',
      }
      return authFailed('quota_exceeded', reasonMap[quota.reason ?? ''] ?? '额度不足,无法建立会话')
    }
  } catch (err) {
    request.log.error({ err }, 'v1/realtime: quota precheck failed')
    return authFailed('backend_unavailable', '额度服务暂不可用')
  }

  return { ok: true, apiKeyId: row.id, userId: row.userId }
}

/**
 * 升级前 fail-fast:只拦"完全无凭据"的握手。
 * F-86:原 `wsUpgradeRequiresCredential()` 默认只看 query token,会让
 * `Authorization: Bearer` 客户端在升级前就被 401;这里按本端点凭据形态判定
 * (header Bearer / query api_key 兼容 / query token 兼容)。
 */
export function realtimeUpgradeRequiresCredential() {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const auth = request.headers.authorization
    const hasHeader = typeof auth === 'string' && auth.startsWith('Bearer ') && auth.length > 7
    const q = request.query as Record<string, string | undefined> | undefined
    const hasQuery = Boolean(q?.api_key || q?.token)
    if (!hasHeader && !hasQuery) {
      await reply.status(401).send({ code: 401, message: 'WS 连接缺少凭据' })
    }
  }
}

// ===========================================================================
// Dashscope 协议转换(最小转换)
// ===========================================================================

/** Dashscope 消息 header 结构。 */
interface DashscopeHeader {
  action: string
  event?: string
  task_id?: string
  streaming?: string
  attributes?: Record<string, unknown>
}

/** Dashscope 消息体。 */
interface DashscopeMessage {
  header: DashscopeHeader
  payload?: {
    input?: Record<string, unknown>
    output?: Record<string, unknown>
    parameters?: Record<string, unknown>
  }
}

/** Dashscope action → OpenAI type 映射。 */
const DASHSCOPE_ACTION_MAP: Record<string, string> = {
  'session-updated': 'session.updated',
  'task-started': 'session.created',
  'task-finished': 'response.done',
  'task-failed': 'error',
  'input-audio-buffer-speech-started': 'input_audio_buffer.speech_started',
  'input-audio-buffer-speech-stopped': 'input_audio_buffer.speech_stopped',
  'input-audio-buffer-committed': 'input_audio_buffer.committed',
}

/**
 * 将客户端(OpenAI 格式)消息转换为 dashscope 格式。
 * 仅转换 session.update,其余消息透传(OpenAI 兼容客户端可直接发给 dashscope)。
 */
function convertToDashscope(raw: string): string {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return raw // 非 JSON,原样透传
  }

  const event = parsed as ClientToServerEvent
  if (event.type !== 'session.update') return raw

  const session = event.session
  const dashscopeMsg: DashscopeMessage = {
    header: { action: 'session-updated' },
    payload: {
      input: {
        session_configuration: {
          modalities: session.modalities ?? ['text', 'audio'],
          voice: session.voice ?? 'longxiaochun',
          instructions: session.instructions ?? '',
          turn_detection: session.turn_detection ?? { type: 'server_vad' },
        },
      },
    },
  }
  return JSON.stringify(dashscopeMsg)
}

/**
 * 将 dashscope 上游消息转换为 OpenAI Realtime 格式。
 * 已知 action 做格式转换,未知 action 原样透传(保持前向兼容)。
 */
function convertFromDashscope(raw: string): string {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return raw
  }

  const msg = parsed as DashscopeMessage
  if (!msg.header || !msg.header.action) return raw

  const action = msg.header.action
  const openaiType = DASHSCOPE_ACTION_MAP[action]

  // 未知 action:原样透传(dashscope 可能发新事件,不做阻塞)
  if (!openaiType) return raw

  const output = (msg.payload?.output ?? {}) as Record<string, unknown>

  // 根据映射后的 type 构造 OpenAI 格式事件
  switch (openaiType) {
    case 'session.created': {
      const sessionConfig = (output.session_configuration ??
        msg.payload?.parameters ??
        {}) as Record<string, unknown>
      const event: ServerToClientEvent = {
        type: 'session.created',
        session: {
          id: msg.header.task_id ?? 'realtime-session',
          object: 'realtime.session',
          model: (sessionConfig.model as string) ?? 'qwen-audio-realtime',
          modalities: (sessionConfig.modalities as string[]) ?? ['text', 'audio'],
          voice: (sessionConfig.voice as string) ?? 'longxiaochun',
          instructions: (sessionConfig.instructions as string) ?? '',
          turn_detection: (sessionConfig.turn_detection as TurnDetection) ?? null,
        },
      }
      return JSON.stringify(event)
    }
    case 'session.updated': {
      const sessionConfig = (output.session_configuration ??
        msg.payload?.parameters ??
        {}) as Record<string, unknown>
      const event: ServerToClientEvent = {
        type: 'session.updated',
        session: {
          id: msg.header.task_id ?? 'realtime-session',
          object: 'realtime.session',
          model: (sessionConfig.model as string) ?? 'qwen-audio-realtime',
          modalities: (sessionConfig.modalities as string[]) ?? ['text', 'audio'],
          voice: (sessionConfig.voice as string) ?? 'longxiaochun',
          instructions: (sessionConfig.instructions as string) ?? '',
          turn_detection: (sessionConfig.turn_detection as TurnDetection) ?? null,
        },
      }
      return JSON.stringify(event)
    }
    case 'response.done': {
      const event: ServerToClientEvent = {
        type: 'response.done',
        response: {
          id: msg.header.task_id ?? 'response',
          object: 'realtime.response',
          status: 'completed',
          output: [],
        },
      }
      return JSON.stringify(event)
    }
    case 'error': {
      const event: ServerToClientEvent = {
        type: 'error',
        error: {
          code: String(msg.header.attributes?.error_code ?? 'upstream_error'),
          message: String(output.message ?? msg.header.attributes?.error_message ?? '上游错误'),
        },
      }
      return JSON.stringify(event)
    }
    case 'input_audio_buffer.speech_started': {
      const event: ServerToClientEvent = {
        type: 'input_audio_buffer.speech_started',
        audio_start_ms: Number(output.audio_start_ms ?? 0),
        item_id: String(output.item_id ?? msg.header.task_id ?? ''),
      }
      return JSON.stringify(event)
    }
    case 'input_audio_buffer.speech_stopped': {
      const event: ServerToClientEvent = {
        type: 'input_audio_buffer.speech_stopped',
        audio_end_ms: Number(output.audio_end_ms ?? 0),
        item_id: String(output.item_id ?? msg.header.task_id ?? ''),
      }
      return JSON.stringify(event)
    }
    case 'input_audio_buffer.committed': {
      const event: ServerToClientEvent = {
        type: 'input_audio_buffer.committed',
        item_id: String(output.item_id ?? msg.header.task_id ?? ''),
      }
      return JSON.stringify(event)
    }
    default:
      return raw
  }
}

// ===========================================================================
// 辅助函数
// ===========================================================================

/** 安全发送文本消息(连接已关闭时静默失败)。 */
function safeSend(socket: WebSocket, data: string): boolean {
  if (socket.readyState !== WebSocket.OPEN) return false
  try {
    socket.send(data)
    return true
  } catch {
    return false
  }
}

/** 发送 error 事件给客户端。 */
function sendErrorEvent(socket: WebSocket, code: string, message: string): void {
  const event: ServerToClientEvent = {
    type: 'error',
    error: { code, message },
  }
  safeSend(socket, JSON.stringify(event))
}

/** 安全关闭 WebSocket(已关闭时静默)。 */
function safeClose(socket: WebSocket, code: number, reason: string): void {
  if (socket.readyState === WebSocket.CLOSED) return
  try {
    socket.close(code, reason)
  } catch {
    /* already closed */
  }
}

/** 上游 response.done 的 usage 形状(OpenAI Realtime)。 */
interface RealtimeUsageFrame {
  type?: string
  response?: {
    id?: string
    usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number }
  }
}

/**
 * F-86:按上游 response.done 的真实 usage 记量(每个 response 记一次,按响应 id 去重),
 * 复用 relay-billing-service.recordCall(内部已做成本计算/余额扣减/try-catch)。
 * 没有 usage 的帧(含 dashscope 未透出 usage 的转换帧)不记 —— 见票据遗留缺口。
 */
export function meterRealtimeResponseUsage(
  raw: string,
  ctx: {
    apiKeyId: string
    userId: string
    model: string
    clientIp: string
    billedResponseIds: Set<string>
  },
): void {
  let frame: RealtimeUsageFrame
  try {
    frame = JSON.parse(raw) as RealtimeUsageFrame
  } catch {
    return
  }
  if (frame.type !== 'response.done' || !frame.response) return
  const usage = frame.response.usage
  if (!usage) return
  const promptTokens = Math.max(0, Number(usage.input_tokens ?? 0))
  const completionTokens = Math.max(0, Number(usage.output_tokens ?? 0))
  const totalTokens = Math.max(0, Number(usage.total_tokens ?? promptTokens + completionTokens))
  if (totalTokens <= 0) return
  const responseId = frame.response.id ?? ''
  if (responseId) {
    if (ctx.billedResponseIds.has(responseId)) return
    ctx.billedResponseIds.add(responseId)
  }
  void recordCall({
    apiKeyId: ctx.apiKeyId,
    userId: ctx.userId,
    model: ctx.model,
    prompt: '',
    response: null,
    promptTokens,
    completionTokens,
    totalTokens,
    latencyMs: 0,
    status: 'success',
    clientIp: ctx.clientIp,
    metadata: { protocol: 'realtime', realtimeResponseId: responseId || null },
  })
}

// ===========================================================================
// 核心连接处理
// ===========================================================================

/**
 * 处理单个 /v1/realtime WebSocket 连接:
 * 1. 鉴权(API Key 校验)
 * 2. 模型白名单校验
 * 3. 上游配置校验
 * 4. 建立上游 WebSocket 连接
 * 5. 双向消息透传(+ dashscope 协议转换)
 * 6. 上游 response.done 带 usage 时按真实用量记量(F-86)
 */
async function handleRealtimeConnection(socket: WebSocket, request: FastifyRequest): Promise<void> {
  // --- 1. 模型参数(Key 的 allowedModels 判据需要 model) ---
  const query = request.query as { model?: string }
  const model = query.model ?? ''
  if (!model) {
    safeClose(socket, CLOSE_CODE.MODEL_NOT_ALLOWED, 'Missing model parameter')
    return
  }

  // --- 2. 鉴权 + 配额预检(F-86:status/expiresAt/IP/allowedModels/限流/余额) ---
  const auth = await authenticateRealtimeApiKey(request, model)
  if (!auth.ok) {
    request.log.warn({ reason: auth.reason }, 'v1/realtime connection rejected')
    safeClose(
      socket,
      auth.reason === 'model_denied' ? CLOSE_CODE.MODEL_NOT_ALLOWED : CLOSE_CODE.AUTH_FAILED,
      auth.message,
    )
    return
  }
  const { apiKeyId, userId } = auth

  // --- 3. 模型白名单校验 ---
  // 2026-09-13 修复:白名单大小写不敏感(GPT-4o-Realtime 等同 gpt-4o-realtime,仅比较归一)
  if (!MODEL_WHITELIST.includes(model.trim().toLowerCase() as (typeof MODEL_WHITELIST)[number])) {
    safeClose(socket, CLOSE_CODE.MODEL_NOT_ALLOWED, `Model "${model}" not allowed`)
    return
  }

  // --- 4. 上游配置校验 ---
  const provider = resolveProvider(model)
  if (!provider) {
    safeClose(socket, CLOSE_CODE.MODEL_NOT_ALLOWED, `No upstream provider for model "${model}"`)
    return
  }

  const upstreamBase = process.env.UPSTREAM_REALTIME_BASE
  const upstreamKey = process.env.UPSTREAM_REALTIME_KEY
  if (!upstreamBase || !upstreamKey) {
    sendErrorEvent(socket, '5014', '上游 realtime 渠道未配置')
    safeClose(socket, CLOSE_CODE.UPSTREAM_NOT_CONFIGURED, 'Upstream realtime not configured')
    return
  }

  // --- 5. 建立上游 WebSocket 连接 ---
  const wsUrl = buildUpstreamWsUrl(provider, model, upstreamBase)
  let upstream: WebSocket
  try {
    upstream = new WebSocket(wsUrl, {
      headers: { Authorization: `Bearer ${upstreamKey}` },
    })
    upstream.binaryType = 'arraybuffer'
  } catch (err) {
    sendErrorEvent(socket, '502', `上游连接失败: ${(err as Error).message}`)
    safeClose(socket, CLOSE_CODE.UPSTREAM_CONNECTION_FAILED, 'Upstream connection failed')
    return
  }

  // --- 6. 双向消息透传 ---

  // F-86:同一 response 的 usage 只记一次(上游可能重发/重复帧)
  const billedResponseIds = new Set<string>()

  // 上游 → 客户端(dashscope 做协议转换,OpenAI 原样透传)
  upstream.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
    const raw =
      data instanceof Buffer
        ? data.toString('utf8')
        : data instanceof ArrayBuffer
          ? Buffer.from(data).toString('utf8')
          : Buffer.concat(data as ReadonlyArray<Buffer>).toString('utf8')

    // F-86:记量只读帧、不改帧;失败由 recordCall 内部兜住,不影响透传
    meterRealtimeResponseUsage(raw, {
      apiKeyId,
      userId,
      model,
      clientIp: request.ip,
      billedResponseIds,
    })

    const converted = provider === 'dashscope' ? convertFromDashscope(raw) : raw
    safeSend(socket, converted)
  })

  upstream.on('error', (err: Error) => {
    request.log.warn({ err: err.message, model, provider }, 'v1/realtime upstream error')
    sendErrorEvent(socket, '502', `上游错误: ${err.message}`)
    safeClose(socket, CLOSE_CODE.UPSTREAM_CONNECTION_FAILED, 'Upstream error')
  })

  upstream.on('close', () => {
    safeClose(socket, 1000, 'upstream closed')
  })

  // 客户端 → 上游(dashscope 做协议转换,OpenAI 原样透传)
  // 注意:必须在 upstream open 后才能转发,否则消息会丢失
  upstream.on('open', () => {
    socket.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
      const raw =
        data instanceof Buffer
          ? data.toString('utf8')
          : data instanceof ArrayBuffer
            ? Buffer.from(data).toString('utf8')
            : Buffer.concat(data as ReadonlyArray<Buffer>).toString('utf8')

      const converted = provider === 'dashscope' ? convertToDashscope(raw) : raw
      if (upstream.readyState === WebSocket.OPEN) {
        try {
          upstream.send(converted)
        } catch {
          /* upstream closed */
        }
      }
    })
  })

  // 客户端关闭 → 关闭上游
  socket.on('close', () => {
    safeClose(upstream, 1000, 'client closed')
  })

  socket.on('error', (err: Error) => {
    request.log.warn({ err: err.message, model }, 'v1/realtime client socket error')
    safeClose(upstream, 1011, 'client error')
  })
}

/** 构建上游 WebSocket URL。 */
function buildUpstreamWsUrl(
  provider: 'openai' | 'dashscope',
  model: string,
  baseUrl: string,
): string {
  const base = baseUrl.replace(/\/$/, '')
  if (provider === 'dashscope') {
    return `${base}/?model=${encodeURIComponent(model)}`
  }
  return `${base}?model=${encodeURIComponent(model)}`
}

// ===========================================================================
// Fastify Plugin 导出
// ===========================================================================

/**
 * OpenAI Realtime API 兼容 WebSocket 路由插件。
 *
 * 待主 agent 在 routes/index.ts 注册:
 *   import { v1RealtimeRoutes } from './v1-realtime.js'
 *   server.register(v1RealtimeRoutes)
 */
export const v1RealtimeRoutes: FastifyPluginAsync = async (server) => {
  server.get(
    '/v1/realtime',
    {
      websocket: true,
      preValidation: realtimeUpgradeRequiresCredential(),
      preHandler: [declareCapability('realtime:connect')],
    },
    (socket: WebSocket, request: FastifyRequest) => {
      // P1 修复(2026-08-02):加 .catch 防止 handleRealtimeConnection 内部抛错导致
      // unhandledRejection + socket 未关闭(连接泄漏)。catch 中尝试关闭 socket + log。
      void handleRealtimeConnection(socket, request).catch((err) => {
        request.log.error({ err }, 'v1/realtime connection handler failed')
        try {
          socket.close(1011, 'Internal server error')
        } catch {
          /* socket 已关闭或不可写,忽略 */
        }
      })
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
