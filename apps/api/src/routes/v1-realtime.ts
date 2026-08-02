/**
 * v1-realtime.ts — OpenAI Realtime API 兼容 WebSocket 端点。
 *
 * 端点: GET /v1/realtime?model=xxx
 * 鉴权: query 参数 api_key 或 header Authorization: Bearer sk-xxx
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
import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { eq } from 'drizzle-orm'
import WebSocket from 'ws'
import { dbRead } from '../db/index.js'
import { developerApiKeys } from '@ihui/database'

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
  if (model.startsWith('gpt-4o')) return 'openai'
  if (model.startsWith('qwen')) return 'dashscope'
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
// API Key 校验(轻量级 Bearer 校验)
// ===========================================================================

/**
 * 校验 API Key 是否有效(developer_api_keys 表,status=active)。
 *
 * TODO: 主 agent 后续替换为共享 api-key-auth(requireApiKeyAuth),
 * 以复用 P0-7 安全粒度检查(expiresAt / allowedIps / allowedModels 等)。
 */
async function validateApiKey(apiKey: string): Promise<boolean> {
  const [row] = await dbRead
    .select({ status: developerApiKeys.status })
    .from(developerApiKeys)
    .where(eq(developerApiKeys.key, apiKey))
    .limit(1)
  return row?.status === 'active'
}

/** 从请求中提取 API Key:优先 query 参数 api_key,其次 header Authorization: Bearer。 */
function extractApiKey(request: FastifyRequest): string | null {
  const query = request.query as { api_key?: string }
  if (query.api_key) return query.api_key

  const auth = request.headers.authorization
  if (auth && auth.startsWith('Bearer ')) {
    const key = auth.slice('Bearer '.length).trim()
    if (key) return key
  }
  return null
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
 */
async function handleRealtimeConnection(socket: WebSocket, request: FastifyRequest): Promise<void> {
  // --- 1. 鉴权 ---
  const apiKey = extractApiKey(request)
  if (!apiKey) {
    safeClose(socket, CLOSE_CODE.AUTH_FAILED, 'API key required')
    return
  }
  const valid = await validateApiKey(apiKey)
  if (!valid) {
    safeClose(socket, CLOSE_CODE.AUTH_FAILED, 'Invalid API key')
    return
  }

  // --- 2. 模型白名单校验 ---
  const query = request.query as { model?: string }
  const model = query.model ?? ''
  if (!model) {
    safeClose(socket, CLOSE_CODE.MODEL_NOT_ALLOWED, 'Missing model parameter')
    return
  }
  if (!MODEL_WHITELIST.includes(model as (typeof MODEL_WHITELIST)[number])) {
    safeClose(socket, CLOSE_CODE.MODEL_NOT_ALLOWED, `Model "${model}" not allowed`)
    return
  }

  // --- 3. 上游配置校验 ---
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

  // --- 4. 建立上游 WebSocket 连接 ---
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

  // --- 5. 双向消息透传 ---

  // 上游 → 客户端(dashscope 做协议转换,OpenAI 原样透传)
  upstream.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
    const raw =
      data instanceof Buffer
        ? data.toString('utf8')
        : data instanceof ArrayBuffer
          ? Buffer.from(data).toString('utf8')
          : Buffer.concat(data as ReadonlyArray<Buffer>).toString('utf8')

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
  server.get('/v1/realtime', { websocket: true }, (socket: WebSocket, request: FastifyRequest) => {
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
  })
}
