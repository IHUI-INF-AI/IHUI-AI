// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * relay-chat-stream.ts — 号池 WS 长连接对话的浏览器端流式客户端(2026-11-12 立)。
 *
 * 为什么要有它:
 * - 全局统一 AI 对话框(main chat)默认走 agent runtime(/ai/chat/stream);
 *   用户从模型选择器选中「我的号池」模型时,这一轮必须改走号池长连接 /ws/relay/chat。
 * - 该端点在 API 侧用 wsAuth(token) 鉴权,认**登录 access token**(也认 ws-ticket),
 *   所以网页端无需额外 relay API Key,登录态即可用自己号池里的账号流式对话。
 * - 号池选号、熔断、字节记账全部复用服务端 forwardToChannel,本文件只做
 *   "帧 ↔ OpenAI delta" 的翻译,不重写转发语义。
 *
 * 协议(与服务端 apps/api/src/plugins/ws-relay-chat.ts 按行为规格):
 *   客户端 → 服务端:{ type:'chat', id, model, messages, stream:true, conversationId? }
 *   服务端 → 客户端:ready / start / chunk / done / error
 *   chunk.data = 已剥 `data:` 前缀的 OpenAI 兼容 SSE JSON 行
 *
 * 设计取舍:每条消息一轮独立连接(开→chat→done→close)。多轮上下文由调用方
 * 每轮携带完整 messages,conversationId 用于服务端会话级亲和(同号同上游会话),
 * 因此不依赖长连接常驻即可保证语义正确。
 */

import { useAuthStore } from '@/stores/auth'
import { buildWsUrl } from '@/lib/ws-url'

export interface RelayChatMessage {
  role: string
  content: string
}

export interface RelayChatUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

/** 上游 model 请求的工具回调(2026-11-21):号池通道的 tool loop 在调用方跑 */
export interface RelayToolCall {
  /** 上游给的调用 id(缺省时由客户端生成,保证 UI 侧可定位) */
  id: string
  name: string
  /** 原始 JSON 字符串(上游是分片拼出来的,这里已拼完整) */
  arguments: string
}

export interface StreamRelayChatOptions {
  model: string
  messages: RelayChatMessage[]
  signal?: AbortSignal
  /** 会话级亲和键(号池据此把多轮落到同一账号 + 同一上游会话) */
  conversationId?: string
  /**
   * 2026-11-21:推理强度档位(D130 的号池腿)。此前 web 侧就往这里传,但选项类型没声明
   * ⇒ tsc 报"对象字面量只能指定已知属性",线上被类型闸挡住。键名下行按 snake 写成
   * `reasoning_effort`,与 `/api/ai/chat` 那条腿同一字段(§0.6 不另造名字)。
   * `undefined` = 用户没表态,不发该键(后端按默认档)。
   */
  reasoningEffort?: string
  onDelta: (delta: string) => void
  onDone?: () => void
  onError?: (message: string, info?: { errorCode?: string }) => void
  onUsage?: (usage: RelayChatUsage) => void
  /** 空闲超时(毫秒):从发出请求到收到下一次帧的最长等待,默认 180s */
  idleTimeoutMs?: number
  /** OpenAI tools 定义(2026-11-21):带上后上游可回 tool_calls,由调用方执行并续跑 */
  tools?: Array<Record<string, unknown>>
  /** tool_choice(可选,原样透传) */
  toolChoice?: string | Record<string, unknown>
  /** 本轮工具调用回调(流收束时一次性给出已拼完整的调用清单) */
  onToolCalls?: (calls: RelayToolCall[]) => void
}

/** 服务端 → 客户端帧(形状见 ws-relay-chat.ts 头注) */
interface RelayFrame {
  type?: unknown
  id?: unknown
  data?: unknown
  message?: unknown
  status?: unknown
}

/** 一条 tool_calls 分片(OpenAI 规范:index 定位,function.arguments 是增量字符串) */
interface ToolCallDelta {
  index: number
  id?: string
  name?: string
  argumentsChunk?: string
}

/** 从 chunk.data 里抽正文增量/usage/tool_calls 分片;无法解析返回 null(心跳/注释行) */
function parseChunkData(data: string): {
  content: string
  usage?: RelayChatUsage
  toolDeltas?: ToolCallDelta[]
} | null {
  try {
    const json = JSON.parse(data) as {
      choices?: Array<{
        delta?: {
          content?: unknown
          tool_calls?: Array<{
            index?: unknown
            id?: unknown
            function?: { name?: unknown; arguments?: unknown }
          }>
        }
      }>
      usage?: {
        prompt_tokens?: unknown
        completion_tokens?: unknown
        total_tokens?: unknown
      }
    }
    let content = ''
    const delta = json.choices?.[0]?.delta
    if (delta && typeof delta.content === 'string') content = delta.content
    // 工具调用分片:上游按 index 分多条增量下发,name/arguments 都是增量拼装
    const toolDeltas: ToolCallDelta[] = []
    if (delta && Array.isArray(delta.tool_calls)) {
      for (const raw of delta.tool_calls) {
        const index = typeof raw?.index === 'number' && raw.index >= 0 ? raw.index : 0
        const piece: ToolCallDelta = { index }
        if (typeof raw?.id === 'string' && raw.id) piece.id = raw.id
        const fn = raw?.function
        if (fn) {
          if (typeof fn.name === 'string' && fn.name) piece.name = fn.name
          if (typeof fn.arguments === 'string') piece.argumentsChunk = fn.arguments
        }
        toolDeltas.push(piece)
      }
    }
    let usage: RelayChatUsage | undefined
    if (json.usage && typeof json.usage === 'object') {
      const num = (v: unknown): number =>
        typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0
      usage = {
        promptTokens: num(json.usage.prompt_tokens),
        completionTokens: num(json.usage.completion_tokens),
        totalTokens: num(json.usage.total_tokens),
      }
    }
    return { content, usage, ...(toolDeltas.length > 0 ? { toolDeltas } : {}) }
  } catch {
    return null
  }
}

/**
 * 开一条号池 WS,把一轮对话流式喂给 onDelta,收束时 resolve。
 * 永不 reject:所有失败都经 onError 呈现,与 streamChat 的既有调用点姿势一致
 * (宿主在 await 之后的收尾逻辑必须照常执行)。
 */
export function streamRelayChat(opts: StreamRelayChatOptions): Promise<void> {
  return new Promise<void>((resolve) => {
    const token = useAuthStore.getState().token
    if (!token) {
      opts.onError?.('未登录,无法使用个人号池模型')
      resolve()
      return
    }
    const url = buildWsUrl('/ws/relay/chat', token)
    if (!url) {
      opts.onError?.('当前环境不支持 WebSocket,无法使用个人号池模型')
      resolve()
      return
    }

    const id = `pool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    let settled = false
    let completed = false
    /** 本轮 chat 帧是否已发出(只发一次;由 ready 帧触发,见 sendChat 注释) */
    let sentChat = false
    let socket: WebSocket | null = null
    let idleTimer: ReturnType<typeof setTimeout> | null = null
    /** 本轮 tool_calls 分片累积(index → 拼装中的调用;arguments 是增量字符串) */
    const toolAcc = new Map<number, { id?: string; name?: string; args: string }>()

    /** 把累积的分片拼成完整调用清单(无 name 的片段丢弃:上游可能只发 arguments) */
    const collectToolCalls = (): RelayToolCall[] => {
      if (toolAcc.size === 0) return []
      const out: RelayToolCall[] = []
      for (const [index, piece] of [...toolAcc.entries()].sort((a, b) => a[0] - b[0])) {
        const name = piece.name?.trim()
        if (!name) continue
        out.push({
          id: piece.id || `pool-call-${index}-${Math.random().toString(36).slice(2, 8)}`,
          name,
          arguments: piece.args || '{}',
        })
      }
      return out
    }

    const clearIdle = (): void => {
      if (idleTimer !== null) {
        clearTimeout(idleTimer)
        idleTimer = null
      }
    }

    const sendCancel = (): void => {
      try {
        if (socket && socket.readyState === 1) {
          socket.send(JSON.stringify({ type: 'cancel', id }))
        }
      } catch {
        /* 连接已断:忽略 */
      }
    }

    const finish = (notify?: () => void): void => {
      if (settled) return
      settled = true
      clearIdle()
      if (opts.signal) {
        try {
          opts.signal.removeEventListener('abort', onAbort)
        } catch {
          /* 已移除 */
        }
      }
      notify?.()
      try {
        socket?.close()
      } catch {
        /* 已断 */
      }
      socket = null
      resolve()
    }

    const armIdle = (): void => {
      clearIdle()
      const ms = opts.idleTimeoutMs ?? 180_000
      idleTimer = setTimeout(() => {
        sendCancel()
        finish(() => opts.onError?.('号池响应超时,请重试'))
      }, ms)
    }

    function onAbort(): void {
      sendCancel()
      // 用户主动停止:与 streamChat 的 abort 语义一致,静默收束不报错
      finish()
    }

    if (opts.signal?.aborted) {
      resolve()
      return
    }
    opts.signal?.addEventListener('abort', onAbort, { once: true })

    try {
      socket = new WebSocket(url)
    } catch (err) {
      finish(() => opts.onError?.(err instanceof Error ? err.message : 'WebSocket 连接失败'))
      return
    }

    /**
     * 发送本轮 chat 帧。**只能在收到服务端 `ready` 后调用**(2026-11-12 实测定案)。
     *
     * 事故形状:服务端 handler 是 `const userId = await wsAuth(socket, token)` 之后才
     * `socket.on('message', …)`;而 ws 库在没有 message 监听器时**直接丢弃**到达的帧。
     * 若像最初那样在 `onopen` 立刻 send,帧会落在 wsAuth 的 await 窗口里被吞掉 ——
     * 表现是握手成功、收到 ready、然后**永远等不到 start**,直到 120s 空闲超时。
     * 本机 8802 实测:onopen 即发 ⇒ `open → ready` 之后 120s 零帧;改等 ready ⇒
     * `open → ready → start → 21 chunk → done`,首字节 1574ms,真实上游有正文。
     * `ready` 帧的语义就是"鉴权完成、可以发了",客户端必须按此排序。
     */
    const sendChat = (): void => {
      if (sentChat) return
      sentChat = true
      try {
        socket?.send(
          JSON.stringify({
            type: 'chat',
            id,
            model: opts.model,
            // 只保留 OpenAI 三角色 + 字符串正文;agent 帧里的 tool 消息不喂号池
            messages: opts.messages
              .filter(
                (m) =>
                  typeof m.content === 'string' &&
                  (m.role === 'user' || m.role === 'assistant' || m.role === 'system'),
              )
              .map((m) => ({ role: m.role, content: m.content })),
            stream: true,
            ...(opts.conversationId ? { conversationId: opts.conversationId } : {}),
            // 2026-11-21:推理档位只在用户表态时下发(空串/undefined 不发,后端按默认档)。
            ...(opts.reasoningEffort ? { reasoning_effort: opts.reasoningEffort } : {}),
            // 2026-11-21:号池通道带上工具定义 ⇒ 上游可回 tool_calls(由调用方执行并续跑)
            ...(opts.tools && opts.tools.length > 0 ? { tools: opts.tools } : {}),
            ...(opts.toolChoice ? { tool_choice: opts.toolChoice } : {}),
          }),
        )
      } catch (err) {
        finish(() => opts.onError?.(err instanceof Error ? err.message : '号池请求发送失败'))
      }
    }

    socket.onopen = (): void => {
      // 只启动空闲计时,**不发帧**:等 ready(见 sendChat 注释)
      armIdle()
    }

    socket.onmessage = (ev: MessageEvent): void => {
      const text = typeof ev.data === 'string' ? ev.data : ''
      if (!text || text === 'pong') return
      let frame: RelayFrame
      try {
        frame = JSON.parse(text) as RelayFrame
      } catch {
        return
      }
      if (frame.type === 'ready') {
        armIdle()
        // 鉴权完成、服务端已挂好 message 监听 ⇒ 此刻发帧才不会丢
        sendChat()
        return
      }
      // ready 之外的所有业务帧都带 id;不是本轮的帧一律忽略(连接内多路复用)
      if (frame.id !== id) return

      if (frame.type === 'start') {
        armIdle()
        return
      }
      if (frame.type === 'chunk') {
        armIdle()
        if (typeof frame.data !== 'string') return
        const parsed = parseChunkData(frame.data)
        if (!parsed) return
        if (parsed.content) opts.onDelta(parsed.content)
        if (parsed.usage) opts.onUsage?.(parsed.usage)
        if (parsed.toolDeltas) {
          for (const d of parsed.toolDeltas) {
            const cur = toolAcc.get(d.index) ?? { args: '' }
            if (d.id) cur.id = d.id
            if (d.name) cur.name = d.name
            if (d.argumentsChunk) cur.args += d.argumentsChunk
            toolAcc.set(d.index, cur)
          }
        }
        return
      }
      if (frame.type === 'done') {
        completed = true
        // 工具调用先于收尾回调交出:调用方要在本轮流结束后立刻执行并续跑下一轮
        const calls = collectToolCalls()
        finish(() => {
          if (calls.length > 0) opts.onToolCalls?.(calls)
          opts.onDone?.()
        })
        return
      }
      if (frame.type === 'error') {
        const msg =
          typeof frame.message === 'string' && frame.message ? frame.message : '号池转发失败'
        finish(() => opts.onError?.(msg))
      }
    }

    socket.onerror = (): void => {
      finish(() => opts.onError?.('号池连接异常(WebSocket error)'))
    }

    socket.onclose = (): void => {
      // done 已到 = 正常收束;否则是服务端/网络提前断开,必须给用户一个结局
      finish(() => {
        if (!completed) opts.onError?.('号池连接已断开,回答可能不完整')
      })
    }
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
