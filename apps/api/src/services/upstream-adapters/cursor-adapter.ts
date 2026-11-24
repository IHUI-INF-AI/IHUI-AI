// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Cursor 上游适配器(2026-11-14 立,本机对机主账号全链路实测)。
 *
 * Cursor 没有公开 API。本文件只承载「已实测通过」的私有协议,不猜测任何未取证形状:
 *
 * - 凭证:state.vscdb 的 cursorAuth/accessToken / refreshToken(Chromium OSCrypt v10),
 *   由 scripts/lib/cursor-auth-extract.mjs 解出后导入;machineId = sha256(小写 MachineGuid),
 *   checksum 需要它才能过上游设备校验。
 * - 聊天:HTTP/2 双向流 POST https://agentn.us.api5.cursor.sh/agent.v1.AgentService/Run,
 *   Connect 帧 = flags(1B) + uint32BE 长度 + protobuf;flag&2 = end-stream JSON。
 *   实测唯一可用形状:文本必须放 action.user_message_action.prepend_user_messages(field 4),
 *   user_message.text(field 1)留空;requested_model(field 9)子消息 field 1 = 模型名。
 * - 服务端帧:interaction_update(text_delta / thinking_delta / turn_ended / heartbeat)、
 *   exec_server_message(须回 request_context_result,否则 Agent 停在等环境)、
 *   kv_server_message(须回 kv_client_message)。客户端每 15s 发 heartbeat。
 * - 模型清单:一元 JSON POST https://api2.cursor.sh/aiserver.v1.AiService/AvailableModels,
 *   body {"useModelParameters":true} → {models:[{name,...}]}(2026-11-14 真弹 200)。
 * - 额度:一元 JSON POST https://api2.cursor.sh/aiserver.v1.DashboardService/GetSandUsageStatus
 *   → 200,实测形状 { usagePercent, nextResetTimestampUtc, cursorPlanName, grokPlanLabel, … }。
 * - 续期:refresh_token 换票流程只有文档、未实测 ⇒ refreshTokenSupported:false(不进保活窗口)。
 *
 * 边界:
 * - 聊天是 HTTP/2 长连接,账号级代理(proxyUrl)暂不支持 —— 显式报错,绝不静默直连绕过出口约束;
 * - 额度 / 模型清单走普通 fetch,支持账号级代理(与 raccoon 同款实现)。
 */
import { randomBytes, randomUUID } from 'node:crypto'
import http2 from 'node:http2'
import { ProxyAgent, fetch as undiciFetch } from 'undici'
import type {
  AdapterAccountContext,
  AdapterCallOptions,
  NormalizedChatRequest,
  QuotaCallOptions,
  RelayQuotaResult,
  RelayUpstreamAdapter,
  StreamState,
  TranslatedChunk,
  UpstreamHttpRequest,
} from '../relay-upstream-adapters.js'
import type { TokenRefreshResult } from '../relay-upstream-adapters.js'

const CHAT_ORIGIN = 'https://agentn.us.api5.cursor.sh'
const CHAT_PATH = '/agent.v1.AgentService/Run'
const API_ORIGIN = 'https://api2.cursor.sh'
const MODELS_PATH = '/aiserver.v1.AiService/AvailableModels'
const QUOTA_PATH = '/aiserver.v1.DashboardService/GetSandUsageStatus'

/** 聊天通道客户端标识(2026-11-14 实测可用字面量) */
const CHAT_CLIENT_TYPE = 'cli'
const CHAT_CLIENT_VERSION = 'cli-2026.09.02-fa0c06e-lab'
/** 一元 JSON 通道客户端标识(与桌面端同族;实测可用) */
const UNARY_CLIENT_VERSION = '3.27.22'
const UNARY_CLIENT_COMMIT = 'b1aa50cb6db84fd3e8c808259cb172ea73425c10'
/** 客户端心跳间隔(实测 15s;不发上游会断流) */
const HEARTBEAT_MS = 15_000
const HEARTBEAT_T = 165

// =============================================================================
// protobuf / Connect 帧(纯函数,供测试)
// =============================================================================

/** 无符号 varint 编码(protobuf 线格式) */
export function encodeVarint(n: number): Buffer {
  let v = Math.max(0, Math.floor(n))
  const out: number[] = []
  while (v > 0x7f) {
    out.push((v & 0x7f) | 0x80)
    v = Math.floor(v / 128)
  }
  out.push(v & 0x7f)
  return Buffer.from(out)
}

/** 字段键:field_no << 3 | wire_type */
export function pbTag(field: number, wire: number): Buffer {
  return encodeVarint(field * 8 + wire)
}

/** 长度分隔字段(string / bytes / 嵌套消息) */
export function pbString(field: number, value: string): Buffer {
  const body = Buffer.from(value, 'utf8')
  return Buffer.concat([pbTag(field, 2), encodeVarint(body.length), body])
}

/** varint 字段 */
export function pbInt(field: number, value: number): Buffer {
  return Buffer.concat([pbTag(field, 0), encodeVarint(value)])
}

/** 嵌套消息字段 */
export function pbMessage(field: number, body: Buffer): Buffer {
  return Buffer.concat([pbTag(field, 2), encodeVarint(body.length), body])
}

/** Connect 帧:flags(1B) + uint32BE 长度 + payload */
export function encodeConnectFrame(payload: Buffer): Buffer {
  const head = Buffer.alloc(5)
  head.writeUInt32BE(payload.length, 1)
  return Buffer.concat([head, payload])
}

export interface ProtoField {
  no: number
  wire: number
  /** wire=0 为数值,其余为字节切片 */
  value: number | Buffer
}

function readVarint(buf: Buffer, pos: number): [number, number] {
  let n = 0
  let scale = 1
  let b = 0
  do {
    if (pos >= buf.length) throw new Error('protobuf varint 截断(未判定)')
    b = buf[pos]!
    pos += 1
    n += (b & 0x7f) * scale
    scale *= 128
  } while (b & 0x80)
  return [n, pos]
}

/** 解析一层 protobuf 字段(未知 wire 类型即停止,不猜) */
export function decodeFields(buf: Buffer): ProtoField[] {
  const out: ProtoField[] = []
  let pos = 0
  while (pos < buf.length) {
    let key = 0
    try {
      ;[key, pos] = readVarint(buf, pos)
    } catch {
      break
    }
    const no = Math.floor(key / 8)
    const wire = key % 8
    if (no <= 0) break
    if (wire === 0) {
      let v = 0
      ;[v, pos] = readVarint(buf, pos)
      out.push({ no, wire, value: v })
    } else if (wire === 2) {
      let len = 0
      ;[len, pos] = readVarint(buf, pos)
      if (pos + len > buf.length) break
      out.push({ no, wire, value: buf.subarray(pos, pos + len) })
      pos += len
    } else if (wire === 1) {
      if (pos + 8 > buf.length) break
      out.push({ no, wire, value: buf.subarray(pos, pos + 8) })
      pos += 8
    } else if (wire === 5) {
      if (pos + 4 > buf.length) break
      out.push({ no, wire, value: buf.subarray(pos, pos + 4) })
      pos += 4
    } else {
      break
    }
  }
  return out
}

/** 取首个指定字段(便捷读数;不存在 → undefined) */
export function firstField(fields: ProtoField[], no: number): ProtoField | undefined {
  return fields.find((f) => f.no === no)
}

/** 取字段的字符串形态(wire=2) */
export function fieldText(fields: ProtoField[], no: number): string {
  const f = firstField(fields, no)
  return f && Buffer.isBuffer(f.value) ? f.value.toString('utf8') : ''
}

/** 取字段的子消息字段(wire=2) */
export function fieldMessage(fields: ProtoField[], no: number): ProtoField[] {
  const f = firstField(fields, no)
  return f && Buffer.isBuffer(f.value) ? decodeFields(f.value) : []
}

export interface ConnectFrame {
  flags: number
  payload: Buffer
}

/**
 * Connect 帧流解析器:data 回调是任意切片,可能半包/粘包。
 * push() 返回本次可完整交付的帧;end-stream(flag&2)照常交付,由调用方判 JSON。
 */
export class ConnectFrameParser {
  private buf: Buffer = Buffer.alloc(0)

  push(chunk: Buffer): ConnectFrame[] {
    this.buf = this.buf.length === 0 ? chunk : Buffer.concat([this.buf, chunk])
    const frames: ConnectFrame[] = []
    while (this.buf.length >= 5) {
      const flags = this.buf[0]!
      const len = this.buf.readUInt32BE(1)
      if (this.buf.length < 5 + len) break
      frames.push({ flags, payload: this.buf.subarray(5, 5 + len) })
      this.buf = this.buf.subarray(5 + len)
    }
    return frames
  }

  /** 尚未消费的残留字节数(测试用) */
  pending(): number {
    return this.buf.length
  }
}

// =============================================================================
// checksum / 请求头(纯函数,供测试)
// =============================================================================

/**
 * Cursor 设备校验头:6 字节大端时间桶(floor(nowMs/1e6),桶宽 1000 秒)+
 * 逐字节 xor/add 混淆,t=165 起始,末尾拼 machineId。
 * machineId = sha256(小写 MachineGuid) hex(提取器产出)。
 */
export function buildCursorChecksum(machineId: string, nowMs: number = Date.now()): string {
  const bucket = Math.floor(nowMs / 1e6)
  const bytes = new Uint8Array(6)
  for (let i = 5; i >= 0; i--) {
    bytes[i] = (bucket >> ((5 - i) * 8)) & 0xff
  }
  let t = HEARTBEAT_T
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = ((bytes[i]! ^ t) + (i % 256)) & 0xff
    t = bytes[i]!
  }
  return Buffer.from(bytes).toString('base64') + machineId
}

/** 聊天通道请求头(Bearer + 设备校验 + CLI 客户端标识) */
export function buildCursorChatHeaders(token: string, machineId: string): Record<string, string> {
  return {
    authorization: `Bearer ${token}`,
    cookie: `CursorCookie=Cookie-${token.slice(0, 15)}`,
    'content-type': 'application/connect+proto',
    'connect-protocol-version': '1',
    te: 'trailers',
    'x-client-key': randomBytes(32).toString('hex'),
    'x-cursor-checksum': buildCursorChecksum(machineId),
    'x-cursor-client-type': CHAT_CLIENT_TYPE,
    'x-cursor-client-version': CHAT_CLIENT_VERSION,
    'x-cursor-client-os': 'win32',
    'x-cursor-client-arch': 'x64',
    'x-ghost-mode': 'true',
    'x-request-id': randomUUID(),
  }
}

/** 一元 JSON 通道请求头(桌面端同族标识;实测 AvailableModels / GetSandUsageStatus 可用) */
export function buildCursorUnaryHeaders(token: string, machineId: string): Record<string, string> {
  return {
    authorization: `Bearer ${token}`,
    cookie: `CursorCookie=Cookie-${token.slice(0, 15)}`,
    'content-type': 'application/json',
    'connect-protocol-version': '1',
    accept: 'application/json',
    'x-client-key': randomBytes(32).toString('hex'),
    'x-cursor-checksum': buildCursorChecksum(machineId),
    'x-cursor-client-type': 'ide',
    'x-cursor-client-version': UNARY_CLIENT_VERSION,
    'x-cursor-client-commit': UNARY_CLIENT_COMMIT,
    'x-cursor-client-device-type': 'desktop',
    'x-cursor-client-os': 'win32',
    'x-cursor-client-arch': 'x64',
    'x-cursor-timezone': 'Asia/Shanghai',
    'x-ghost-mode': 'false',
    'x-request-id': randomUUID(),
  }
}

// =============================================================================
// 账号读数
// =============================================================================

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function readToken(ctx: AdapterAccountContext): string {
  const token = str(ctx.credentials.token)
  if (!token) throw new Error('cursor 账号缺少 token(state.vscdb 会话未导入或未解密)')
  return token
}

/** machineId:行内列优先,secrets.machineId 兜底(两者导入时同写) */
function readMachineId(ctx: AdapterAccountContext): string {
  const id = str(ctx.row.machineId) || str(ctx.credentials.secrets['machineId'])
  if (!id) {
    throw new Error(
      'cursor 账号缺少 machineId:checksum 无法生成,请用 scripts/lib/cursor-auth-extract.mjs 重新提取导入',
    )
  }
  return id
}

/** 上游模型名去掉 `<平台>/` 前缀(转发器已剥过则原样) */
function bareModel(model: string): string {
  return model.startsWith('cursor/') ? model.slice('cursor/'.length) : model
}

// =============================================================================
// 请求构造(chat)
// =============================================================================

/** OpenAI content → 纯文本(多模态数组只取 text 段;其余类型 JSON 化,不丢信息) */
function contentToText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    const parts: string[] = []
    for (const p of content) {
      if (typeof p === 'string') parts.push(p)
      else if (p && typeof p === 'object') {
        const rec = p as Record<string, unknown>
        if (typeof rec['text'] === 'string') parts.push(rec['text'])
      }
    }
    return parts.join('\n')
  }
  if (content === null || content === undefined) return ''
  try {
    return JSON.stringify(content)
  } catch {
    return String(content)
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * 组 AgentRunRequest(实测形状,注释见文件头)。
 * 历史消息逐条落进 user_message_action.prepend_user_messages(field 4),role 以 `[role]` 行前缀保留;
 * user_message_action.field 1 是一个**空 UserMessage**,真正的内容全在 field 4(实测唯一可用形状)。
 */
export function buildAgentRunRequest(req: NormalizedChatRequest): Buffer {
  const conversationId =
    req.conversationId && UUID_RE.test(req.conversationId) ? req.conversationId : randomUUID()

  const prepend = req.messages
    .map((m) => {
      const text = contentToText(m.content)
      if (!text) return null
      const userMessage = Buffer.concat([
        pbString(1, `[${m.role}]\n${text}`),
        pbString(2, randomUUID()),
        pbInt(4, 1),
      ])
      return pbMessage(4, userMessage)
    })
    .filter((b): b is Buffer => b !== null)

  const userMessageAction = Buffer.concat([pbMessage(1, Buffer.alloc(0)), ...prepend])
  const action = pbMessage(1, userMessageAction)

  const conversationState = Buffer.concat([
    pbInt(10, 1),
    pbString(22, 'cursor-agent'),
    pbString(9, 'file:///tmp'),
  ])
  const requestedModel = pbMessage(9, pbString(1, bareModel(req.model)))

  return Buffer.concat([
    pbMessage(1, conversationState),
    pbMessage(2, action),
    pbString(5, conversationId),
    requestedModel,
  ])
}

/** exec_server_message 的 request_context_result 回复(实测必须回,否则 Agent 等环境) */
function buildContextReply(id: number, execId: string): Buffer {
  const env = Buffer.concat([
    pbString(1, 'windows'),
    pbString(2, 'file:///tmp'),
    pbString(3, 'powershell'),
    pbString(10, 'Asia/Shanghai'),
    pbString(11, 'file:///tmp'),
  ])
  // 层级实测固定为 result(10) → success(1) → request_context(1) → env(4),
  // 少一层 request_context 上游就回 "Failed to get request context"
  const result = pbMessage(10, pbMessage(1, pbMessage(1, pbMessage(4, env))))
  const execClient = Buffer.concat([pbInt(1, id), pbString(15, execId), result])
  return pbMessage(2, execClient)
}

/** exec_server_message 的兜底回复(非 request_context_args 的参数面:Hermes 明确说 unsupported) */
function buildUnsupportedExecReply(id: number, execId: string): Buffer {
  const failure = pbMessage(3, pbString(1, 'unsupported'))
  const execClient = Buffer.concat([pbInt(1, id), pbString(15, execId), pbMessage(10, failure)])
  return pbMessage(2, execClient)
}

/** kv get_blob_result(空 blob = 本适配器不维护上游 KV 快照) */
function buildKvGetReply(id: number): Buffer {
  return pbMessage(3, Buffer.concat([pbInt(1, id), pbMessage(2, Buffer.alloc(0))]))
}

/** kv set_blob_result(空成功) */
function buildKvSetReply(id: number): Buffer {
  return pbMessage(3, Buffer.concat([pbInt(1, id), pbMessage(3, Buffer.alloc(0))]))
}

/** 客户端心跳(空 message) */
function buildHeartbeat(): Buffer {
  return pbMessage(7, Buffer.alloc(0))
}

// =============================================================================
// 聊天流
// =============================================================================

export interface CursorRunEvent {
  text?: string
  thinking?: string
  done?: boolean
}

/** 上游错误:带 HTTP 状态,供 isAuthError 走状态码判据(不靠文案) */
export class CursorUpstreamError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message)
    this.name = 'CursorUpstreamError'
  }
}

/**
 * 打开 Run 双向流并逐事件产出。
 * 上游帧 → 文本/思考/结束;env 请求、KV 请求就地回复;心跳按 15s 发。
 */
async function* streamCursorRun(
  ctx: AdapterAccountContext,
  req: NormalizedChatRequest,
  signal?: AbortSignal,
): AsyncGenerator<CursorRunEvent> {
  const token = readToken(ctx)
  const machineId = readMachineId(ctx)
  const client = http2.connect(CHAT_ORIGIN)
  const queue: CursorRunEvent[] = []
  let finished = false
  let failure: Error | null = null
  let heartbeat: ReturnType<typeof setInterval> | null = null
  let wake: (() => void) | null = null
  const notify = () => {
    const fn = wake
    wake = null
    fn?.()
  }
  const push = (ev: CursorRunEvent) => {
    queue.push(ev)
    notify()
  }
  const finish = (err?: Error) => {
    if (finished) return
    finished = true
    if (err) failure = err
    if (heartbeat) clearInterval(heartbeat)
    try {
      stream.close()
    } catch {
      /* 已关闭 */
    }
    try {
      client.close()
    } catch {
      /* 已关闭 */
    }
    notify()
  }

  let stream: http2.ClientHttp2Stream
  try {
    stream = client.request({
      ':method': 'POST',
      ':path': CHAT_PATH,
      ...buildCursorChatHeaders(token, machineId),
    })
  } catch (e) {
    client.close()
    throw new CursorUpstreamError(
      `cursor 建流失败: ${e instanceof Error ? e.message : String(e)}`,
      0,
    )
  }

  let httpStatus = 0
  let errorText = ''
  let ended = false
  const parser = new ConnectFrameParser()

  stream.on('response', (headers) => {
    httpStatus = Number(headers[':status'] ?? 0)
  })

  stream.on('data', (chunk: Buffer) => {
    if (httpStatus !== 0 && httpStatus !== 200) {
      errorText += chunk.toString('utf8')
      return
    }
    for (const frame of parser.push(chunk)) {
      if (frame.flags & 2) {
        // end-stream:payload 是 JSON(正常 {"metadata":…},异常带 error)
        const json = frame.payload.toString('utf8')
        try {
          const parsed = json ? (JSON.parse(json) as Record<string, unknown>) : {}
          const err = parsed['error']
          if (err && typeof err === 'object') {
            const rec = err as Record<string, unknown>
            const msg = typeof rec['message'] === 'string' ? rec['message'] : '上游 end-stream 报错'
            finish(new CursorUpstreamError(`cursor: ${msg}`, 0))
            continue
          }
        } catch {
          /* 非 JSON 的 end-stream 只当正常收尾 */
        }
        ended = true
        push({ done: true })
        continue
      }
      handleServerMessage(frame.payload, {
        write: (buf) => {
          try {
            if (!stream.destroyed) stream.write(encodeConnectFrame(buf))
          } catch {
            /* 流已关闭 */
          }
        },
        push,
        finish,
      })
    }
  })

  stream.on('end', () => {
    finish(
      httpStatus !== 0 && httpStatus !== 200
        ? new CursorUpstreamError(
            `cursor HTTP ${httpStatus}: ${errorText.slice(0, 300)}`,
            httpStatus,
          )
        : undefined,
    )
  })
  stream.on('error', (e) => finish(new CursorUpstreamError(`cursor 流异常: ${e.message}`, 0)))
  client.on('error', (e) => finish(new CursorUpstreamError(`cursor 连接异常: ${e.message}`, 0)))

  heartbeat = setInterval(() => {
    try {
      if (!stream.destroyed) stream.write(encodeConnectFrame(buildHeartbeat()))
    } catch {
      /* 已关闭 */
    }
  }, HEARTBEAT_MS)
  heartbeat.unref?.()

  const onAbort = () => finish(new Error('cursor 请求已取消'))
  signal?.addEventListener('abort', onAbort, { once: true })

  try {
    stream.write(encodeConnectFrame(pbMessage(1, buildAgentRunRequest(req))))
    while (true) {
      if (queue.length > 0) {
        const ev = queue.shift()!
        if (ev.done && !ended) {
          yield ev
          return
        }
        yield ev
        if (ev.done) return
        continue
      }
      if (finished) {
        if (failure) throw failure
        return
      }
      await new Promise<void>((resolve) => {
        wake = resolve
      })
    }
  } finally {
    signal?.removeEventListener('abort', onAbort)
    finish()
  }
}

/** 单帧服务端消息处理(纯调度,测试可经 handleServerMessage 直接断言回复帧) */
export function handleServerMessage(
  payload: Buffer,
  io: {
    write: (buf: Buffer) => void
    push: (ev: CursorRunEvent) => void
    finish: (err?: Error) => void
  },
): void {
  for (const top of decodeFields(payload)) {
    if (top.no === 1 && Buffer.isBuffer(top.value)) {
      // interaction_update
      for (const ev of decodeFields(top.value)) {
        if (ev.no === 1 && Buffer.isBuffer(ev.value)) {
          const text = fieldText(decodeFields(ev.value), 1)
          if (text) io.push({ text })
        } else if (ev.no === 4 && Buffer.isBuffer(ev.value)) {
          const thinking = fieldText(decodeFields(ev.value), 1)
          if (thinking) io.push({ thinking })
        } else if (ev.no === 14) {
          io.finish()
        }
      }
    } else if (top.no === 2 && Buffer.isBuffer(top.value)) {
      // exec_server_message:必须回包,否则 Agent 停在等环境
      const inner = decodeFields(top.value)
      const id = firstField(inner, 1)?.value
      const execId = fieldText(inner, 15)
      const numericId = typeof id === 'number' ? id : 0
      const hasContextArgs = inner.some((f) => f.no === 10)
      io.write(
        hasContextArgs
          ? buildContextReply(numericId, execId)
          : buildUnsupportedExecReply(numericId, execId),
      )
    } else if (top.no === 4 && Buffer.isBuffer(top.value)) {
      // kv_server_message:get / set 分别回空结果
      const inner = decodeFields(top.value)
      const id = firstField(inner, 1)?.value
      const numericId = typeof id === 'number' ? id : 0
      const isGet = inner.some((f) => f.no === 2)
      io.write(isGet ? buildKvGetReply(numericId) : buildKvSetReply(numericId))
    }
    // field 7(interaction_query)与未知字段:没有已实证的回复形状 ⇒ 不猜、不回
  }
}

// =============================================================================
// OpenAI 形状翻译
// =============================================================================

function chunkBase(model: string): Record<string, unknown> {
  return {
    id: `chatcmpl_${randomBytes(12).toString('hex')}`,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
  }
}

function textChunk(model: string, delta: Record<string, unknown>, finishReason: string | null) {
  return {
    ...chunkBase(model),
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  }
}

// =============================================================================
// fetch(额度/模型清单;支持账号级代理)
// =============================================================================

const proxyAgentCache = new Map<string, ProxyAgent>()

function makeProxiedFetch(proxyUrl: string): typeof fetch {
  let agent = proxyAgentCache.get(proxyUrl)
  if (!agent) {
    agent = new ProxyAgent(proxyUrl)
    proxyAgentCache.set(proxyUrl, agent)
  }
  return ((input: string | URL, init?: RequestInit) =>
    undiciFetch(
      input as never,
      { ...(init ?? {}), dispatcher: agent } as never,
    ) as unknown as Promise<Response>) as unknown as typeof fetch
}

function resolveFetchImpl(opts: AdapterCallOptions): typeof fetch {
  if (opts.fetchImpl) return opts.fetchImpl
  if (opts.proxyUrl) return makeProxiedFetch(opts.proxyUrl)
  return globalThis.fetch.bind(globalThis)
}

async function postUnaryJson(
  ctx: AdapterAccountContext,
  path: string,
  body: unknown,
  opts?: AdapterCallOptions,
): Promise<{ status: number; body: Record<string, unknown> | null; text: string }> {
  const token = readToken(ctx)
  const machineId = readMachineId(ctx)
  const res = await resolveFetchImpl(opts ?? {})(`${API_ORIGIN}${path}`, {
    method: 'POST',
    headers: buildCursorUnaryHeaders(token, machineId),
    body: JSON.stringify(body ?? {}),
  })
  const text = await res.text().catch(() => '')
  let parsed: Record<string, unknown> | null = null
  try {
    const json = JSON.parse(text)
    if (json && typeof json === 'object' && !Array.isArray(json)) {
      parsed = json as Record<string, unknown>
    }
  } catch {
    /* 非 JSON 响应 → body 保持 null,由调用方如实报形状不符 */
  }
  return { status: res.status, body: parsed, text }
}

// =============================================================================
// 健康检查 / 额度
// =============================================================================

async function fetchUsage(
  ctx: AdapterAccountContext,
  opts?: AdapterCallOptions,
): Promise<{ status: number; body: Record<string, unknown> | null; text: string }> {
  return postUnaryJson(ctx, QUOTA_PATH, {}, opts)
}

async function checkHealth(
  ctx: AdapterAccountContext,
  opts?: AdapterCallOptions,
): Promise<{ ok: boolean; error?: string; indeterminate?: boolean; authFailed?: boolean }> {
  try {
    const { status, body, text } = await fetchUsage(ctx, opts)
    if (status === 401 || status === 403)
      return { ok: false, authFailed: true, error: `GetSandUsageStatus HTTP ${status}` }
    if (status >= 500 || status === 0)
      return { ok: false, indeterminate: true, error: `GetSandUsageStatus HTTP ${status}` }
    if (status !== 200)
      return {
        ok: false,
        indeterminate: true,
        error: `GetSandUsageStatus HTTP ${status}: ${text.slice(0, 160)}`,
      }
    if (!body || typeof body['usagePercent'] !== 'number') {
      return {
        ok: false,
        indeterminate: true,
        error: 'GetSandUsageStatus 200 但缺 usagePercent ⇒ 未判定,不猜字段',
      }
    }
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      indeterminate: true,
      error: `健康检查异常: ${e instanceof Error ? e.message : String(e)}`,
    }
  }
}

async function getQuota(
  ctx: AdapterAccountContext,
  opts?: QuotaCallOptions,
): Promise<RelayQuotaResult> {
  try {
    const { status, body, text } = await fetchUsage(ctx, opts)
    if (status === 401 || status === 403)
      return { ok: false, authFailed: true, error: `GetSandUsageStatus HTTP ${status}` }
    if (status !== 200) {
      return { ok: false, error: `GetSandUsageStatus HTTP ${status}: ${text.slice(0, 200)}` }
    }
    const percent = body?.['usagePercent']
    if (typeof percent !== 'number' || !Number.isFinite(percent)) {
      return {
        ok: false,
        error: `GetSandUsageStatus 200 但 usagePercent 非数字(键=[${body ? Object.keys(body).join(',') : '(非对象)'}]) ⇒ 未判定`,
      }
    }
    const planName =
      (typeof body?.['cursorPlanName'] === 'string' && body['cursorPlanName']) ||
      (typeof body?.['grokPlanLabel'] === 'string' && body['grokPlanLabel']) ||
      undefined
    const resetsAt =
      typeof body?.['nextResetTimestampUtc'] === 'string'
        ? body['nextResetTimestampUtc']
        : undefined
    return {
      ok: true,
      quota: {
        ratio: Math.min(1, Math.max(0, percent / 100)),
        unit: '本期额度使用率%(usagePercent)',
        ...(resetsAt ? { resetsAt } : {}),
        ...(planName ? { subscriptionName: String(planName) } : {}),
      },
    }
  } catch (e) {
    return { ok: false, error: `额度点查失败: ${e instanceof Error ? e.message : String(e)}` }
  }
}

/** 模型清单(AvailableModels 一元 JSON;实测 200 → models[].name) */
async function listModels(
  ctx: AdapterAccountContext,
  opts?: AdapterCallOptions,
): Promise<string[]> {
  const { status, body, text } = await postUnaryJson(
    ctx,
    MODELS_PATH,
    { useModelParameters: true },
    opts,
  )
  if (status !== 200) throw new Error(`HTTP ${status}: ${text.slice(0, 160)}`)
  const models = body?.['models']
  if (!Array.isArray(models)) {
    throw new Error(
      `HTTP 200 但清单形状不符(键=[${body ? Object.keys(body).join(',') : '(非对象)'}]) ⇒ 未判定`,
    )
  }
  const out: string[] = []
  for (const m of models) {
    if (!m || typeof m !== 'object') continue
    const name = (m as Record<string, unknown>)['name']
    if (typeof name === 'string' && name.trim()) out.push(name.trim())
  }
  return out
}

// =============================================================================
// 认证失败判定与错误分级
// =============================================================================

const AUTH_BODY_MARKERS = [
  'unauthenticated',
  'permission_denied',
  'unauthorized',
  'authentication failed',
  'token expired',
  'invalid token',
]

function isAuthFailure(statusCode: number, bodyText: string): boolean {
  if (statusCode === 401 || statusCode === 403) return true
  const lower = bodyText.toLowerCase()
  return AUTH_BODY_MARKERS.some((m) => lower.includes(m))
}

function statusOfError(err: unknown): number {
  if (err && typeof err === 'object') {
    const rec = err as Record<string, unknown>
    if (typeof rec['statusCode'] === 'number') return rec['statusCode']
  }
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : ''
  const m = message.match(/HTTP\s+(\d{3})/i)
  return m ? Number(m[1]) : 0
}

function isAuthError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : ''
  return isAuthFailure(statusOfError(err), message)
}

const CREDIT_RE =
  /(usage limit|insufficient (quota|credit|balance)|quota exceeded|out of credit|payment required|upgrade (your )?plan|额度不足|余额不足)/i

function classifyUpstreamFailure(
  statusCode: number,
  bodyText: string,
): {
  kind: 'auth' | 'credit' | 'session_dead' | 'rate' | 'not_found' | 'request' | 'server' | 'client'
} {
  if (statusCode === 429) return { kind: 'rate' }
  if (statusCode === 402 || CREDIT_RE.test(bodyText)) return { kind: 'credit' }
  if (isAuthFailure(statusCode, bodyText)) return { kind: 'auth' }
  if (statusCode === 404) return { kind: 'not_found' }
  if (statusCode >= 500) return { kind: 'server' }
  return { kind: 'client' }
}

// =============================================================================
// 导出
// =============================================================================

const MULTI_PATH_MSG = 'cursor 走 executeChat 多段式路径(HTTP/2 Connect 双向流)'

export const cursorAdapter: RelayUpstreamAdapter = {
  providerCode: 'cursor',
  buildChatRequest(_ctx: AdapterAccountContext, _req: NormalizedChatRequest): UpstreamHttpRequest {
    throw new Error(MULTI_PATH_MSG)
  },
  translateStreamChunk(
    _ctx: AdapterAccountContext,
    _rawFrame: string,
    _state: StreamState,
  ): TranslatedChunk | null {
    return null
  },
  translateNonStream(_ctx: AdapterAccountContext, _responseBody: unknown): Record<string, unknown> {
    throw new Error(MULTI_PATH_MSG)
  },
  async executeChat(ctx, req, opts) {
    if (opts.proxyUrl) {
      throw new Error('cursor 聊天通道为 HTTP/2,暂不支持账号级代理(请清空该账号的 proxyUrl 后重试)')
    }
    const model = bareModel(req.model)
    if (req.stream) {
      async function* toChunks(): AsyncGenerator<Record<string, unknown>> {
        for await (const ev of streamCursorRun(ctx, req, opts.signal)) {
          if (ev.text) yield textChunk(model, { content: ev.text }, null)
          else if (ev.thinking) yield textChunk(model, { reasoning_content: ev.thinking }, null)
          else if (ev.done) {
            yield textChunk(model, {}, 'stop')
            return
          }
        }
        yield textChunk(model, {}, 'stop')
      }
      return { stream: toChunks() }
    }
    let content = ''
    let reasoning = ''
    for await (const ev of streamCursorRun(ctx, req, opts.signal)) {
      if (ev.text) content += ev.text
      else if (ev.thinking) reasoning += ev.thinking
      if (ev.done) break
    }
    return {
      completion: {
        id: `chatcmpl_${randomBytes(12).toString('hex')}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content,
              ...(reasoning ? { reasoning_content: reasoning } : {}),
            },
            finish_reason: 'stop',
          },
        ],
      },
    }
  },
  // 续期端点只有文档、未实测 ⇒ 明确不可续:调度器不得进保活窗口,也不因"刷新失败"摘号
  refreshTokenSupported: false,
  refreshToken(
    _ctx: AdapterAccountContext,
    _opts?: AdapterCallOptions,
  ): Promise<TokenRefreshResult | null> {
    return Promise.resolve(null)
  },
  checkHealth,
  listModels,
  getQuota,
  // GetSandUsageStatus 真弹 200(usagePercent/套餐/重置时刻)⇒ 余额能力为真
  quotaSupported: true,
  isAuthFailure,
  isAuthError,
  classifyUpstreamFailure,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
