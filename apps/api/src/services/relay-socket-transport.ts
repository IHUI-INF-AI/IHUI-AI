// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * relay-socket-transport.ts — 号池上游长连接传输层(2026-11-10 立)。
 *
 * 解决的问题:号池 12 家适配器此前只有 `buildChatRequest → fetch → SSE` 一条运输方式,
 * 而 chat-models 侧的 /v1/realtime、/ws/qwen-omni、/ws/doubao、/ws/zhipu 早已是双向
 * WS 透传。同一项目两条链路能力不对等。本文件把"活着的帧通道"抽出来,契约在
 * relay-upstream-adapters.ts 的 UpstreamSocket*,适配器按平台实际情况声明。
 *
 * 两种运输模式,统一成同一个 UpstreamSocket 语义:
 * - 'ws'  :真 WebSocket(`ws://` `wss://`)。上游主动推、我们主动发的双向通道。
 * - 'sse' :HTTP 长流(`http://` `https://`)。上游只有 SSE 时的长连接形态,
 *           连接从请求头到达一直活到上游关流,期间可连续出帧(不再是一问一答的
 *           "新建连接 → 读一半 → 断开")。
 *
 * 三条硬约束(改这个文件前先读):
 * 1. **出口守卫不得绕**:建连前必须过 assertRelayEgressSafe(SSRF/内网重定向防线),
 *    SSE 模式还必须走注入的 fetchImpl(账号代理 + 连接期 DNS 守卫都挂在它上面)。
 * 2. **WS 模式不支持账号代理**:`ws` 要的是 Node http.Agent,而号池代理池是 undici
 *    ProxyAgent,两者不通用。带 proxyUrl 的账号走 WS 会静默降级 —— 由调用方判断,
 *    本层不假装支持(见 canUseSocketTransport 的 proxyUrl 分支)。
 * 3. **错误即数据**:建连失败统一抛 UpstreamSocketOpenError(带上游 status/bodyText),
 *    好让转发层沿用既有的 classifyFailure + 401 自愈,而不是另起一套错误判定。
 */
import WebSocket from 'ws'
import { fetch as undiciFetch } from 'undici'
import { assertRelayEgressSafe, directEgressDispatcher } from '../utils/relay-egress-guard.js'
import type {
  AdapterAccountContext,
  RelayUpstreamAdapter,
  StreamState,
  UpstreamSocket,
  UpstreamSocketFactory,
  UpstreamSocketFrame,
  UpstreamSocketOpenOptions,
  UpstreamSocketRequest,
} from './relay-upstream-adapters.js'

/** 建连超时缺省值(与转发层 UPSTREAM_TIMEOUT_MS 区别:这是"连上"的时限,不是"说完"的时限) */
export const DEFAULT_SOCKET_CONNECT_TIMEOUT_MS = 15_000

/**
 * 建连失败(含 sse 模式上游直接回 4xx/5xx)。
 * status/bodyText 原样上交,转发层据此走 classifyFailure —— 本层不做语义分类,
 * 避免同一个错误在两处被解释成两种后果(§check-error-code-not-text-matching)。
 */
export class UpstreamSocketOpenError extends Error {
  readonly status?: number
  readonly bodyText?: string

  constructor(message: string, opts?: { status?: number; bodyText?: string }) {
    super(message)
    this.name = 'UpstreamSocketOpenError'
    this.status = opts?.status
    this.bodyText = opts?.bodyText
  }
}

/** 按 url scheme 推断运输模式(适配器显式声明优先) */
export function resolveSocketTransport(req: UpstreamSocketRequest): 'ws' | 'sse' {
  if (req.transport) return req.transport
  return /^wss?:\/\//i.test(req.url) ? 'ws' : 'sse'
}

/**
 * 帧通道:把"回调式推帧"和"异步迭代消费"接起来。
 * 单消费者设计 —— frames() 只允许调用一次(转发层每个请求一个通道,用完即弃);
 * 重复调用直接抛错,不静默返回空序列(那会让上层误以为"上游没说话")。
 */
class FrameChannel implements UpstreamSocket {
  private queue: UpstreamSocketFrame[] = []
  private waiters: Array<(v: UpstreamSocketFrame | null) => void> = []
  private ended = false
  private error: Error | null = null
  private consumed = false
  private sendImpl: ((data: string | Uint8Array) => void) | null = null
  private closeImpl: ((code?: number, reason?: string) => void) | null = null

  attachSender(fn: (data: string | Uint8Array) => void): void {
    this.sendImpl = fn
  }

  attachCloser(fn: (code?: number, reason?: string) => void): void {
    this.closeImpl = fn
  }

  push(frame: UpstreamSocketFrame): void {
    if (this.ended) return
    const waiter = this.waiters.shift()
    if (waiter) {
      waiter(frame)
      return
    }
    this.queue.push(frame)
  }

  /** 结束通道;err 非空表示异常终止(仍会把队列排空后结束迭代) */
  end(err?: Error): void {
    if (this.ended) return
    this.ended = true
    if (err) this.error = err
    while (this.waiters.length > 0) {
      const waiter = this.waiters.shift()
      waiter?.(null)
    }
  }

  lastError(): Error | null {
    return this.error
  }

  send(data: string | Uint8Array): void {
    if (this.ended) return
    this.sendImpl?.(data)
  }

  close(code?: number, reason?: string): void {
    if (this.ended) return
    try {
      this.closeImpl?.(code, reason)
    } catch {
      /* 关闭竞态:上游已断,忽略 */
    }
    this.end()
  }

  frames(): AsyncIterable<UpstreamSocketFrame> {
    if (this.consumed) {
      throw new Error('UpstreamSocket.frames() 只允许消费一次')
    }
    this.consumed = true
    return {
      [Symbol.asyncIterator]: () => ({
        next: (): Promise<IteratorResult<UpstreamSocketFrame>> => this.nextFrame(),
      }),
    }
  }

  private nextFrame(): Promise<IteratorResult<UpstreamSocketFrame>> {
    const head = this.queue.shift()
    if (head) return Promise.resolve({ value: head, done: false })
    if (this.ended) return Promise.resolve({ value: undefined, done: true })
    return new Promise((resolve) => {
      this.waiters.push((v) => {
        if (v === null) resolve({ value: undefined, done: true })
        else resolve({ value: v, done: false })
      })
    })
  }
}

function withConnectTimeout<T>(
  task: (signal: AbortSignal) => Promise<T>,
  parent: AbortSignal | undefined,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error('socket connect timeout')), timeoutMs)
  const onParentAbort = (): void => controller.abort(parent?.reason)
  if (parent) {
    if (parent.aborted) controller.abort(parent.reason)
    else parent.addEventListener('abort', onParentAbort, { once: true })
  }
  return task(controller.signal).finally(() => {
    clearTimeout(timer)
    parent?.removeEventListener('abort', onParentAbort)
  })
}

// =============================================================================
// 模式 A:真 WebSocket
// =============================================================================

async function openWsSocket(
  req: UpstreamSocketRequest,
  opts: UpstreamSocketOpenOptions,
  channel: FrameChannel,
): Promise<void> {
  // 与 sse 模式同一条守卫:WS 也是出网,且 `ws` 不走 undici dispatcher ⇒
  // 连接期钩子对它无效,首跳复检是它唯一能拿到的防线,漏了就是一条 SSRF 旁路。
  await assertRelayEgressSafe(req.url)
  return withConnectTimeout(
    (signal) =>
      new Promise<void>((resolve, reject) => {
        const handshakeTimeout = opts.connectTimeoutMs ?? DEFAULT_SOCKET_CONNECT_TIMEOUT_MS
        let settled = false

        const ws = new WebSocket(req.url, {
          headers: req.headers,
          handshakeTimeout,
          // 关闭 permessage-deflate:号池上游多为 JSON 文本帧,压缩收益低,
          // 但会引入一块额外的解压缓冲与内存泄漏面(上游不发 close 时尤其明显)。
          perMessageDeflate: false,
        })
        ws.binaryType = 'arraybuffer'

        const onAbort = (): void => {
          try {
            ws.terminate()
          } catch {
            /* 已断 */
          }
          if (!settled) {
            settled = true
            reject(new UpstreamSocketOpenError('socket aborted before open'))
          }
        }
        if (signal.aborted) onAbort()
        else signal.addEventListener('abort', onAbort, { once: true })

        const cleanup = (): void => {
          signal.removeEventListener('abort', onAbort)
        }

        ws.on('open', () => {
          cleanup()
          channel.attachSender((data) => {
            try {
              ws.send(data)
            } catch {
              /* 发送竞态:上游已关 */
            }
          })
          channel.attachCloser(() => ws.close(1000, 'client done'))
          if (req.handshake !== undefined) {
            try {
              ws.send(JSON.stringify(req.handshake))
            } catch (err) {
              channel.end(err instanceof Error ? err : new Error(String(err)))
            }
          }
          if (!settled) {
            settled = true
            resolve()
          }
        })

        ws.on('message', (data: WebSocket.RawData, isBinary: boolean) => {
          if (isBinary) {
            const buf = Array.isArray(data) ? Buffer.concat(data) : Buffer.from(data as ArrayBuffer)
            channel.push({ binary: new Uint8Array(buf) })
            return
          }
          channel.push({ text: data.toString() })
        })

        ws.on('close', (code: number, reason: Buffer) => {
          cleanup()
          channel.end()
          if (!settled) {
            settled = true
            reject(
              new UpstreamSocketOpenError(
                `socket closed before open (code=${code}${reason.length ? `, ${reason.toString()}` : ''})`,
              ),
            )
          }
        })

        ws.on('error', (err: Error) => {
          cleanup()
          channel.end(err)
          if (!settled) {
            settled = true
            reject(new UpstreamSocketOpenError(`socket error: ${err.message}`))
          }
        })
      }),
    opts.signal,
    opts.connectTimeoutMs ?? DEFAULT_SOCKET_CONNECT_TIMEOUT_MS,
  )
}

// =============================================================================
// 模式 B:HTTP 长流(上游只有 SSE)
// =============================================================================

async function openSseSocket(
  req: UpstreamSocketRequest,
  opts: UpstreamSocketOpenOptions,
  channel: FrameChannel,
): Promise<void> {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis)
  await assertRelayEgressSafe(req.url)

  const body = req.rawBody ?? (req.body !== undefined ? JSON.stringify(req.body) : undefined)

  let resp: Response
  try {
    resp = await fetchImpl(req.url, {
      method: req.method ?? 'POST',
      headers: req.headers,
      body,
      signal: opts.signal,
    })
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') {
      throw new UpstreamSocketOpenError('sse aborted before response')
    }
    throw new UpstreamSocketOpenError(
      `sse network error: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  if (!resp.ok || !resp.body) {
    const bodyText = await resp.text().catch(() => '')
    throw new UpstreamSocketOpenError(`上游 ${resp.status}`, {
      status: resp.status,
      bodyText,
    })
  }

  // SSE 是单向流:客户端不能再往上游写帧。send 显式报错比静默吞掉更好排查,
  // 但也不能抛到调用方(那会把"适配器误用"变成"请求失败"),故只记录 lastError。
  channel.attachSender(() => {
    channel.end(new Error('sse 模式不支持向已建立的上游连接发送帧'))
  })
  channel.attachCloser(() => {
    void resp.body?.cancel().catch(() => {})
  })

  // 后台读流:响应头已到 ⇒ 建连成功,立即 resolve;帧从 channel 持续流出。
  void (async () => {
    const reader = resp.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let nl = buffer.indexOf('\n')
        while (nl >= 0) {
          const line = buffer.slice(0, nl).replace(/\r$/, '')
          buffer = buffer.slice(nl + 1)
          channel.push({ text: line })
          nl = buffer.indexOf('\n')
        }
      }
      if (buffer.length > 0) channel.push({ text: buffer.replace(/\r$/, '') })
      channel.end()
    } catch (err) {
      channel.end(err instanceof Error ? err : new Error(String(err)))
    } finally {
      reader.releaseLock()
    }
  })()
}

// =============================================================================
// 工厂
// =============================================================================

export interface RelaySocketFactoryDeps {
  /** fetch 注入点(sse 模式用;转发层传自己的 poolFetch 以复用账号代理与出口守卫) */
  fetchImpl?: typeof fetch
}

/**
 * 造一个长连接工厂。
 * 转发层持有一个实例复用;测试可直接传入 fetchImpl 打桩,无需起真服务。
 */
export function createRelaySocketFactory(deps?: RelaySocketFactoryDeps): UpstreamSocketFactory {
  return {
    async open(
      req: UpstreamSocketRequest,
      opts: UpstreamSocketOpenOptions = {},
    ): Promise<UpstreamSocket> {
      const transport = resolveSocketTransport(req)
      const channel = new FrameChannel()
      const merged: UpstreamSocketOpenOptions = {
        ...opts,
        fetchImpl: opts.fetchImpl ?? deps?.fetchImpl,
      }
      if (transport === 'ws') {
        await openWsSocket(req, merged, channel)
      } else {
        await openSseSocket(req, merged, channel)
      }
      return channel
    },
  }
}

/**
 * 该账号这次请求能否走长连接(转发层在选路前调用)。
 *
 * 为什么 ws + proxyUrl 要挡掉:见文件头约束 2。挡在这里而不是工厂里,
 * 是为了让转发层"提前知道走不通"而不是"建连失败再回落" —— 后者每次请求
 * 都要白付一次失败握手的时间。
 */
export function canUseSocketTransport(
  req: UpstreamSocketRequest,
  proxyUrl: string | null | undefined,
): boolean {
  const transport = resolveSocketTransport(req)
  if (transport === 'ws' && proxyUrl) return false
  return true
}

// =============================================================================
// 长连接 → 既有 SSE 消费路径的桥
// =============================================================================

/**
 * 把活着的长连接包装成标准 SSE Response,交给 relay-account-forwarder 的
 * consumeUpstreamResponse 原样消费。
 *
 * 这样做的理由:翻译(translateStreamChunk)、usage 记账、成功判定、流中断罚号
 * 已经在 SSE 消费路径上校准过一轮(StreamTerminal / judgeStreamOutcome),长连接
 * 若另起一条消费链,等于把那些边界重写一遍并再错一遍。换运输方式,不换消费语义。
 *
 * 两种帧来源:
 * - 适配器声明了 translateSocketFrame ⇒ 帧先翻成 OpenAI chunk 再写成 SSE data 帧
 *   (二进制/私有事件帧必须走这条)。
 * - 未声明 ⇒ 文本帧按上游 SSE 行原样透传(行内已含 `data:` 前缀,或裸 JSON 时补前缀),
 *   由下游 translateStreamChunk 完成翻译 —— sse 模式下的默认路径。
 */
export function socketToSseResponse(
  socket: UpstreamSocket,
  adapter: Pick<RelayUpstreamAdapter, 'translateSocketFrame'>,
  ctx: AdapterAccountContext,
  state: StreamState,
): Response {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let finished = false
      try {
        for await (const frame of socket.frames()) {
          if (adapter.translateSocketFrame) {
            const translated = adapter.translateSocketFrame(ctx, frame, state)
            if (!translated) continue
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(translated.openaiChunk)}\n\n`),
            )
            if (translated.done) {
              finished = true
              break
            }
            continue
          }

          // 无翻译器:二进制帧无从解释,显式丢弃(不猜语义)
          if (frame.binary) continue
          const text = frame.text ?? ''
          if (text === '') {
            controller.enqueue(encoder.encode('\n'))
            continue
          }
          if (isTerminalSseLine(text)) {
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            finished = true
            break
          }
          const line = text.startsWith('data:') ? text : `data: ${text}`
          controller.enqueue(encoder.encode(`${line}\n\n`))
        }
      } catch (err) {
        controller.error(err)
        return
      }

      const upstreamError = socket.lastError()
      if (!finished && upstreamError) {
        // 上游异常中断:把错误交给消费侧,由 judgeStreamOutcome 判成流中断
        // (否则"读到一半就没了"会被误记成一次成功调用,号被白刷)
        controller.error(upstreamError)
        return
      }
      controller.close()
    },
    cancel() {
      socket.close()
    },
  })
  return new Response(body, { status: 200, headers: sseResponseHeaders() })
}

function isTerminalSseLine(line: string): boolean {
  const idx = line.indexOf(':')
  if (idx < 0) return false
  return line.slice(idx + 1).trim() === '[DONE]'
}

function sseResponseHeaders(): Record<string, string> {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  }
}

/** 默认工厂(sse 模式走直连守卫 dispatcher;ws 模式不需要 dispatcher) */
export const relaySocketFactory: UpstreamSocketFactory = createRelaySocketFactory({
  fetchImpl: async (input, init) => {
    await assertRelayEgressSafe(input)
    return undiciFetch(input as string, {
      ...(init ?? {}),
      dispatcher: directEgressDispatcher(),
    }) as unknown as Response
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
