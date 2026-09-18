// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Agent Engine 编程编排层 — createAgent()(P2-④,2026-09-18 立)。
 *
 * 定位:把 apps/ai-service 的 JSON-RPC 编排引擎(P2-③)封装成**应用内可编程的
 * 通用 agent 编排层** —— 对标 Codex SDK(TS/Python 编程编排),但模型无关:
 * 同一套 API 背后可路由到任意 provider(MCP 超级工具池 / 19 家模型路由 / 成本账本)。
 *
 * 与 SDK 其余模块的区别:其他模块是"调我们云 API 的 client",本模块是"在你应用里跑
 * agent"——宿主自带工具(hostTools)由本进程执行后回传,审批(onApproval)由本进程裁决,
 * 事件(thread/event)在编排循环里逐帧可见。
 *
 * 协议对接(与 services/agent_engine.py 的 handler 表一一对应):
 *   POST {baseUrl}/api/engine/rpc  单发 JSON-RPC 2.0;流式方法返回 text/event-stream
 * 通知(server → client):
 *   thread/event       {threadId, event, payload}
 *   tool/execute       {requestId, threadId, name, arguments, timeoutMs}
 *   approval/request   {requestId, threadId, toolName, argsPreview, timeoutMs}
 *
 * 用法:
 * ```ts
 * const agent = createAgent({ token, model: 'gpt-5' })
 * agent.registerTool('read_file', async ({ arguments: a }) => readFile(a.path))
 * const result = await agent.run('把 README 里的错别字改掉', {
 *   onEvent: (e) => console.log(e.name, e.payload),
 * })
 * await agent.close()
 * ```
 */

/** 引擎协议方法名(与 agent_engine.py 的 handler 表对齐;parity 守门脚本比对)。 */
export const ENGINE_METHODS = [
  'engine.initialize',
  'engine.ping',
  'thread.start',
  'thread.prompt',
  'thread.interrupt',
  'thread.resume',
  'thread.state',
  'thread.close',
  'tools.list',
  'tools.register',
  'tools.result',
  'approval.respond',
  'cost.report',
  'models.list',
] as const

/** 引擎通知方法名(server → client)。 */
export const ENGINE_NOTIFICATIONS = ['thread/event', 'tool/execute', 'approval/request'] as const

/** 自动升级为 SSE 的流式方法。 */
export const ENGINE_STREAMING_METHODS = ['thread.prompt', 'thread.resume'] as const

/** 引擎应用错误码(与 agent_engine.py 常量一致)。 */
export const ENGINE_ERROR_CODES = {
  parseError: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internalError: -32603,
  threadNotFound: -32001,
  threadBusy: -32002,
  waitTimeout: -32003,
  toolNotFound: -32004,
  hostToolFailed: -32005,
  threadClosed: -32006,
} as const

/** JSON-RPC 2.0 响应报文。 */
interface JsonRpcResponse {
  jsonrpc?: string
  id?: number | string | null
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
  method?: string
  params?: Record<string, unknown>
}

/** 引擎侧错误(JSON-RPC 错误对象或传输层失败)。 */
export class AgentEngineError extends Error {
  /** JSON-RPC 错误码;传输层失败时为 HTTP 状态码的负数形式(-status)。 */
  readonly code: number
  readonly data?: unknown

  constructor(code: number, message: string, data?: unknown) {
    super(message)
    this.name = 'AgentEngineError'
    this.code = code
    this.data = data
  }
}

/** 一帧 agent 循环事件(thread/event 通知)。 */
export interface AgentEngineEvent {
  type: 'agent-event'
  /** 事件名(tool.before / thinking.delta / message.receive / self_heal …)。 */
  name: string
  /** 事件载荷(含 sessionId / tool / args / result 等)。 */
  payload: Record<string, unknown>
  threadId: string
}

/** 宿主工具执行上下文(tool/execute 通知的载荷)。 */
export interface AgentToolContext {
  requestId: string
  threadId: string
  /** 工具名。 */
  name: string
  /** 模型给出的参数(已解析为对象)。 */
  arguments: Record<string, unknown>
  /** 引擎侧等待上限(毫秒);超时后引擎按 waitTimeout 降级。 */
  timeoutMs: number
}

/** 宿主工具处理器:返回值经 tools.result 回传引擎;抛错则回传 error。 */
export type AgentToolHandler = (ctx: AgentToolContext) => unknown | Promise<unknown>

/** 审批请求(approval/request 通知的载荷)。 */
export interface AgentApprovalRequest {
  requestId: string
  threadId: string
  toolName?: string
  toolCallId?: string
  dangerLevel?: string
  argsPreview?: unknown
  timeoutMs?: number
}

export type AgentApprovalDecision = 'approve' | 'reject'

export type AgentApprovalHandler = (
  request: AgentApprovalRequest,
) => AgentApprovalDecision | Promise<AgentApprovalDecision>

/** 一轮执行结果(引擎归一化后的结构化载荷)。 */
export interface AgentRunResult {
  threadId: string
  success: boolean
  stopReason: string
  finalResponse: string
  iterations: number
  totalDurationMs: number
  totalTokensUsed: number
  checkpointId: string | null
  error: string | null
  budget: unknown
  compactionEvents: unknown[]
}

/** 线程状态自省结果。 */
export interface AgentThreadState {
  threadId: string
  sessionId: string
  status: 'idle' | 'running' | 'closed'
  model: string | null
  permissionMode: string
  maxIterations: number
  messages: number
  prompts: number
  checkpointId: string | null
  hostTools: string[]
  lastResult: AgentRunResult | null
  cost: Record<string, unknown>
}

/** createAgent 配置。 */
export interface CreateAgentOptions {
  /** 访问令牌(JWT);引擎 HTTP 承载由 JWTAuthMiddleware 统一保护。 */
  token: string
  /** ai-service 基础 URL,默认 http://localhost:8803。 */
  baseUrl?: string
  /** 模型名(任意受支持 provider;不传则用引擎默认)。 */
  model?: string
  /** 线程 system prompt。 */
  systemPrompt?: string
  /** 内置工具名子集(不传则用全部内置 + MCP 超级工具池)。 */
  toolNames?: string[]
  /** 宿主工具处理器:名字 → 执行函数(首个 run 前自动 tools.register)。 */
  hostTools?: Record<string, AgentToolHandler>
  /** 宿主工具描述与入参 schema(注册时附带给模型)。 */
  hostToolSpecs?: Record<string, { description?: string; parameters?: Record<string, unknown> }>
  /** 最大迭代数,默认 8。 */
  maxIterations?: number
  /** 权限模式(default / acceptEdits / plan / bypassPermissions 等)。 */
  permissionMode?: string
  /** 会话标识(不传则用 threadId)。 */
  sessionId?: string
  userId?: string
  conversationId?: string
  workspace?: string
  /** 全局事件回调(可被 run 的 options.onEvent 覆盖)。 */
  onEvent?: (event: AgentEngineEvent) => void
  /** 审批回调;不提供时一律 reject(默认拒绝,安全兜底)。 */
  onApproval?: AgentApprovalHandler
  /** 自定义 fetch(测试/拦截用)。 */
  fetch?: typeof fetch
  /** 非流式 RPC 超时(毫秒),默认 30000。流式不受此限制。 */
  timeout?: number
}

/** run/stream 的单轮选项。 */
export interface AgentRunOptions {
  onEvent?: (event: AgentEngineEvent) => void
  /** 单轮超时(毫秒);流式路径下到点即中止读取。 */
  timeout?: number
}

/** 可编程 agent 句柄。 */
export interface Agent {
  /** 线程 id;start()/首个 run() 之前为 null。 */
  readonly threadId: string | null
  /** 是否已启动线程。 */
  readonly started: boolean
  /** 最近一轮结果。 */
  readonly lastResult: AgentRunResult | null
  /** 显式启动线程(首个 run 会自动调用)。 */
  start(): Promise<{ threadId: string; sessionId: string; status: string }>
  /** 跑一轮(自动确保线程已启动)。 */
  run(input: unknown, options?: AgentRunOptions): Promise<AgentRunResult>
  /** 跑一轮并以异步生成器逐帧产出事件(生成器结束后 lastResult 可读)。 */
  stream(input: unknown, options?: AgentRunOptions): AsyncGenerator<AgentEngineEvent>
  /** 中断当前轮次:cancel=取消 / pause=暂停并落 checkpoint。 */
  interrupt(mode?: 'cancel' | 'pause'): Promise<Record<string, unknown>>
  /** 从 checkpoint 续跑。 */
  resume(checkpointId?: string, options?: AgentRunOptions): Promise<AgentRunResult>
  /** 线程状态(迭代数 / checkpoint / 成本)。 */
  state(): Promise<AgentThreadState>
  /** 关闭线程(释放引擎侧订阅与状态)。 */
  close(): Promise<void>
  /** 注入宿主工具(立即注册,下一轮生效)。 */
  registerTool(
    name: string,
    handler: AgentToolHandler,
    spec?: { description?: string; parameters?: Record<string, unknown>; timeoutMs?: number },
  ): Promise<void>
  /** 合并工具清单(MCP 超级工具池 + 宿主工具)。 */
  listTools(): Promise<Record<string, unknown>>
  /** 成本账本汇总(含 prompt 缓存三段计价)。 */
  cost(filter?: Record<string, unknown>): Promise<Record<string, unknown>>
  /** 模型路由 + 单价 + 缓存乘数。 */
  models(): Promise<Record<string, unknown>>
  /** 回填审批决策(宿主自行裁决时用)。 */
  respondApproval(
    requestId: string,
    decision: AgentApprovalDecision,
  ): Promise<Record<string, unknown>>
  /** 能力握手。 */
  initialize(): Promise<Record<string, unknown>>
}

const DEFAULT_BASE_URL = 'http://localhost:8803'
const DEFAULT_TIMEOUT = 30000
const RPC_PATH = '/api/engine/rpc'

/** 从 SSE 文本行解析出的帧(空帧/心跳帧返回 null)。 */
function parseSseLine(line: string): JsonRpcResponse | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith(':')) return null // 注释帧(心跳)
  if (!trimmed.startsWith('data:')) return null
  const payload = trimmed.slice(5).trim()
  if (!payload || payload === '[DONE]') return null
  try {
    return JSON.parse(payload) as JsonRpcResponse
  } catch {
    return null
  }
}

/** 把任意入参归一为引擎可接受的 prompt 形态(string 直传,其余原样)。 */
function normalizeInput(input: unknown): unknown {
  return input
}

class AgentEngineClient implements Agent {
  private readonly baseUrl: string
  private readonly token: string
  private readonly fetchFn: typeof fetch
  private readonly timeout: number
  private readonly onEvent?: (event: AgentEngineEvent) => void
  private readonly onApproval?: AgentApprovalHandler
  private readonly hostTools = new Map<
    string,
    {
      handler: AgentToolHandler
      spec: { description?: string; parameters?: Record<string, unknown>; timeoutMs?: number }
    }
  >()
  private readonly options: CreateAgentOptions

  private threadIdValue: string | null = null
  private sessionIdValue: string | null = null
  private lastResultValue: AgentRunResult | null = null
  private rpcId = 0

  constructor(options: CreateAgentOptions) {
    if (!options.token) {
      throw new AgentEngineError(ENGINE_ERROR_CODES.invalidRequest, 'token is required')
    }
    this.options = options
    this.token = options.token
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '')
    this.fetchFn = options.fetch ?? fetch
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT
    this.onEvent = options.onEvent
    this.onApproval = options.onApproval
    for (const [name, handler] of Object.entries(options.hostTools ?? {})) {
      this.hostTools.set(name, { handler, spec: options.hostToolSpecs?.[name] ?? {} })
    }
  }

  get threadId(): string | null {
    return this.threadIdValue
  }

  get started(): boolean {
    return this.threadIdValue !== null
  }

  get lastResult(): AgentRunResult | null {
    return this.lastResultValue
  }

  private nextId(): number {
    this.rpcId += 1
    return this.rpcId
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    }
  }

  private async post(body: unknown, signal?: AbortSignal): Promise<Response> {
    return this.fetchFn(`${this.baseUrl}${RPC_PATH}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
      signal,
    })
  }

  /** 单发(非流式)JSON-RPC 调用:返回 result,错误抛 AgentEngineError。 */
  private async call<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeout)
    let response: JsonRpcResponse
    try {
      const resp = await this.post(
        { jsonrpc: '2.0', id: this.nextId(), method, params },
        controller.signal,
      )
      response = await this.readEnvelope(resp)
    } catch (e) {
      if (e instanceof AgentEngineError) throw e
      throw new AgentEngineError(
        -0,
        `引擎请求失败(${method}): ${(e as Error).message ?? 'unknown'}`,
      )
    } finally {
      clearTimeout(timer)
    }
    if (response.error) {
      throw new AgentEngineError(response.error.code, response.error.message, response.error.data)
    }
    return response.result as T
  }

  /** 读取响应体并归一为 JSON-RPC 信封(SSE 单发方法取末帧)。 */
  private async readEnvelope(resp: Response): Promise<JsonRpcResponse> {
    if (!resp.ok) {
      throw new AgentEngineError(-resp.status, `引擎返回 HTTP ${resp.status}`)
    }
    const contentType = resp.headers.get('content-type') ?? ''
    const text = await resp.text()
    if (!contentType.includes('text/event-stream')) {
      return JSON.parse(text) as JsonRpcResponse
    }
    let last: JsonRpcResponse | null = null
    for (const line of text.split('\n')) {
      const frame = parseSseLine(line)
      if (frame && frame.id !== undefined && frame.id !== null) last = frame
    }
    if (!last) {
      throw new AgentEngineError(ENGINE_ERROR_CODES.internalError, '流式响应未包含方法响应帧')
    }
    return last
  }

  async initialize(): Promise<Record<string, unknown>> {
    return this.call<Record<string, unknown>>('engine.initialize')
  }

  async start(): Promise<{ threadId: string; sessionId: string; status: string }> {
    if (this.threadIdValue) {
      return { threadId: this.threadIdValue, sessionId: this.sessionIdValue ?? '', status: 'idle' }
    }
    const params: Record<string, unknown> = {}
    if (this.options.systemPrompt) params.systemPrompt = this.options.systemPrompt
    if (this.options.model) params.model = this.options.model
    if (this.options.toolNames) params.tools = this.options.toolNames
    if (this.options.maxIterations) params.maxIterations = this.options.maxIterations
    if (this.options.permissionMode) params.permissionMode = this.options.permissionMode
    if (this.options.sessionId) params.sessionId = this.options.sessionId
    if (this.options.userId) params.userId = this.options.userId
    if (this.options.conversationId) params.conversationId = this.options.conversationId
    if (this.options.workspace) params.workspace = this.options.workspace

    const started = await this.call<{ threadId: string; sessionId: string; status: string }>(
      'thread.start',
      params,
    )
    this.threadIdValue = started.threadId
    this.sessionIdValue = started.sessionId
    // 宿主工具在首轮前注册,模型第一轮即可见
    for (const [name, entry] of this.hostTools) {
      await this.registerTool(name, entry.handler, entry.spec)
    }
    return started
  }

  async registerTool(
    name: string,
    handler: AgentToolHandler,
    spec?: { description?: string; parameters?: Record<string, unknown>; timeoutMs?: number },
  ): Promise<void> {
    this.hostTools.set(name, { handler, spec: spec ?? {} })
    if (!this.threadIdValue) return // 线程未启动:start() 时统一注册
    const params: Record<string, unknown> = { threadId: this.threadIdValue, name }
    if (spec?.description) params.description = spec.description
    if (spec?.parameters) params.parameters = spec.parameters
    if (spec?.timeoutMs) params.timeoutMs = spec.timeoutMs
    await this.call<Record<string, unknown>>('tools.register', params)
  }

  async run(input: unknown, options?: AgentRunOptions): Promise<AgentRunResult> {
    await this.start()
    return this.runMethod('thread.prompt', normalizeInput(input), options)
  }

  async resume(checkpointId?: string, options?: AgentRunOptions): Promise<AgentRunResult> {
    await this.start()
    const params: Record<string, unknown> = { threadId: this.threadIdValue }
    if (checkpointId) params.checkpointId = checkpointId
    return this.runMethod('thread.resume', params, options, true)
  }

  async *stream(input: unknown, options?: AgentRunOptions): AsyncGenerator<AgentEngineEvent> {
    const queue: AgentEngineEvent[] = []
    let wake: (() => void) | null = null
    let done = false
    let failure: unknown = null

    const push = (event: AgentEngineEvent): void => {
      queue.push(event)
      wake?.()
    }

    const running = this.run(input, {
      ...options,
      onEvent: (event) => {
        options?.onEvent?.(event)
        push(event)
      },
    })
      .catch((e: unknown) => {
        failure = e
      })
      .finally(() => {
        done = true
        wake?.()
      })

    while (true) {
      if (queue.length > 0) {
        yield queue.shift() as AgentEngineEvent
        continue
      }
      if (done) break
      await new Promise<void>((resolve) => {
        wake = resolve
      })
      wake = null
    }
    await running
    if (failure) throw failure
  }

  /** 流式方法核心:逐帧消费 SSE,处理宿主工具与审批,返回末帧结果。 */
  private async runMethod(
    method: string,
    params: unknown,
    options?: AgentRunOptions,
    paramsIsObject = false,
  ): Promise<AgentRunResult> {
    const payload: Record<string, unknown> = paramsIsObject
      ? (params as Record<string, unknown>)
      : { threadId: this.threadIdValue, input: params }
    const id = this.nextId()
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    if (options?.timeout) {
      timer = setTimeout(() => controller.abort(), options.timeout)
    }
    const emit = options?.onEvent ?? this.onEvent
    const sideTasks: Promise<unknown>[] = []

    try {
      const resp = await this.post(
        { jsonrpc: '2.0', id, method, params: payload },
        controller.signal,
      )
      if (!resp.ok) {
        throw new AgentEngineError(-resp.status, `引擎返回 HTTP ${resp.status}`)
      }
      if (!resp.body) {
        throw new AgentEngineError(ENGINE_ERROR_CODES.internalError, '响应体为空')
      }

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let final: JsonRpcResponse | null = null

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            const frame = parseSseLine(line)
            if (!frame) continue
            if (frame.method === 'thread/event') {
              emit?.(this.toAgentEvent(frame))
              continue
            }
            if (frame.method === 'tool/execute') {
              // 宿主工具在本进程执行,结果经独立调用回传(不阻塞事件流读取)
              sideTasks.push(this.handleHostTool(frame.params ?? {}))
              continue
            }
            if (frame.method === 'approval/request') {
              sideTasks.push(this.handleApproval(frame.params ?? {}))
              continue
            }
            if (frame.id === id) {
              final = frame
            }
          }
        }
      } finally {
        reader.releaseLock()
      }

      // 宿主工具/审批回传必须先结算,再返回本轮结果(避免结果与工具轨迹竞态)
      if (sideTasks.length > 0) await Promise.all(sideTasks)
      if (!final) {
        throw new AgentEngineError(ENGINE_ERROR_CODES.internalError, '流式响应未包含方法响应帧')
      }
      if (final.error) {
        throw new AgentEngineError(final.error.code, final.error.message, final.error.data)
      }
      const result = final.result as AgentRunResult
      this.lastResultValue = result
      this.threadIdValue = result.threadId ?? this.threadIdValue
      return result
    } finally {
      if (timer) clearTimeout(timer)
    }
  }

  private toAgentEvent(frame: JsonRpcResponse): AgentEngineEvent {
    const params = frame.params ?? {}
    return {
      type: 'agent-event',
      name: String(params.event ?? ''),
      payload: (params.payload ?? {}) as Record<string, unknown>,
      threadId: String(params.threadId ?? this.threadIdValue ?? ''),
    }
  }

  /** tool/execute → 本进程执行 handler → tools.result 回传。 */
  private async handleHostTool(params: Record<string, unknown>): Promise<void> {
    const requestId = String(params.requestId ?? '')
    const name = String(params.name ?? '')
    const entry = this.hostTools.get(name)
    const rawArgs = params.arguments
    const args: Record<string, unknown> =
      typeof rawArgs === 'string'
        ? (safeJson(rawArgs) as Record<string, unknown>)
        : ((rawArgs ?? {}) as Record<string, unknown>)

    let body: Record<string, unknown>
    if (!entry) {
      body = { requestId, error: `未注册的宿主工具: ${name}` }
    } else {
      try {
        const result = await entry.handler({
          requestId,
          threadId: String(params.threadId ?? this.threadIdValue ?? ''),
          name,
          arguments: args,
          timeoutMs: Number(params.timeoutMs ?? 0),
        })
        body = { requestId, result: result ?? null }
      } catch (e) {
        body = { requestId, error: (e as Error).message ?? String(e) }
      }
    }
    await this.call<Record<string, unknown>>('tools.result', body).catch(() => undefined)
  }

  /** approval/request → 宿主裁决 → approval.respond 回填。 */
  private async handleApproval(params: Record<string, unknown>): Promise<void> {
    const request: AgentApprovalRequest = {
      requestId: String(params.requestId ?? ''),
      threadId: String(params.threadId ?? this.threadIdValue ?? ''),
      toolName: params.toolName === undefined ? undefined : String(params.toolName),
      toolCallId: params.toolCallId === undefined ? undefined : String(params.toolCallId),
      dangerLevel: params.dangerLevel === undefined ? undefined : String(params.dangerLevel),
      argsPreview: params.argsPreview,
      timeoutMs: params.timeoutMs === undefined ? undefined : Number(params.timeoutMs),
    }
    let decision: AgentApprovalDecision = 'reject' // 未配置回调 → 默认拒绝
    if (this.onApproval && request.requestId) {
      try {
        decision = await this.onApproval(request)
      } catch {
        decision = 'reject'
      }
    }
    if (!request.requestId) return
    await this.call<Record<string, unknown>>('approval.respond', {
      approvalId: request.requestId,
      decision,
    }).catch(() => undefined)
  }

  async interrupt(mode: 'cancel' | 'pause' = 'cancel'): Promise<Record<string, unknown>> {
    return this.call<Record<string, unknown>>('thread.interrupt', {
      threadId: this.threadIdValue,
      mode,
    })
  }

  async state(): Promise<AgentThreadState> {
    return this.call<AgentThreadState>('thread.state', { threadId: this.threadIdValue })
  }

  async close(): Promise<void> {
    if (!this.threadIdValue) return
    const threadId = this.threadIdValue
    this.threadIdValue = null
    this.sessionIdValue = null
    await this.call<Record<string, unknown>>('thread.close', { threadId }).catch(() => undefined)
  }

  async listTools(): Promise<Record<string, unknown>> {
    return this.call<Record<string, unknown>>('tools.list', { threadId: this.threadIdValue })
  }

  async cost(filter?: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.call<Record<string, unknown>>('cost.report', filter ? { filter } : {})
  }

  async models(): Promise<Record<string, unknown>> {
    return this.call<Record<string, unknown>>('models.list')
  }

  async respondApproval(
    requestId: string,
    decision: AgentApprovalDecision,
  ): Promise<Record<string, unknown>> {
    return this.call<Record<string, unknown>>('approval.respond', {
      approvalId: requestId,
      decision,
    })
  }
}

function safeJson(text: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(text) as unknown
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : { value: parsed }
  } catch {
    return { raw: text }
  }
}

/**
 * 创建一个模型无关的可编程 agent(编程编排层入口)。
 *
 * 与 `createClient()` 的区别:client 调云 API,agent 在**你的进程内**编排循环 ——
 * 宿主工具与审批决策都不过服务端,只有模型调用与编排状态在引擎侧。
 */
export function createAgent(options: CreateAgentOptions): Agent {
  return new AgentEngineClient(options)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
