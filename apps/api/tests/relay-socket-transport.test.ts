// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池上游长连接传输层单测(2026-11-10 立)。
 *
 * 覆盖:
 * - 运输模式推断(scheme / 显式声明)与"代理 × ws"互斥判据
 * - sse 模式:按行产帧、4xx 抛 UpstreamSocketOpenError(status/bodyText 原样上交)、
 *   上游关流后迭代自然结束
 * - ws 模式:起真 WebSocket 服务端做双向收发(这是"WS 通道真的能跑"的证据,
 *   不是桩对桩的自证)
 * - 桥 socketToSseResponse:无翻译器原样透传 / 有翻译器翻成 OpenAI chunk /
 *   上游异常必须让流失效(否则半包会被记成成功调用)
 * - isSocketCapableAdapter 三态判据
 */
import { describe, it, expect, vi } from 'vitest'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { WebSocketServer } from 'ws'

// 出口守卫在测试里必须放开:它按真实 DNS/回环判定,而本文件的 ws 用例要把服务端
// 起在 127.0.0.1:随机端口上。守卫本身另有独立用例,这里不重复验证它。
vi.mock('../src/utils/relay-egress-guard.js', () => ({
  assertRelayEgressSafe: async () => {},
  directEgressDispatcher: () => undefined,
}))

import {
  canUseSocketTransport,
  createRelaySocketFactory,
  resolveSocketTransport,
  socketToSseResponse,
  UpstreamSocketOpenError,
} from '../src/services/relay-socket-transport.js'
import { isSupportedProxyUrl } from '../src/services/relay-connect-agent.js'
import {
  isSocketCapableAdapter,
  type AdapterAccountContext,
  type RelayUpstreamAdapter,
  type UpstreamSocket,
  type UpstreamSocketFrame,
} from '../src/services/relay-upstream-adapters.js'
import { doubaoAdapter } from '../src/services/upstream-adapters/doubao-adapter.js'

function sseResponse(lines: string[]): Response {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) controller.enqueue(encoder.encode(`${line}\n`))
      controller.close()
    },
  })
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  })
}

async function collectFrames(socket: UpstreamSocket): Promise<UpstreamSocketFrame[]> {
  const out: UpstreamSocketFrame[] = []
  for await (const f of socket.frames()) out.push(f)
  return out
}

function fakeCtx(): AdapterAccountContext {
  return {
    row: { id: 'row-1', name: 'test', proxyUrl: null },
    credentials: { cookies: [{ name: 'sessionid', value: 's' }], secrets: {}, token: null },
  } as unknown as AdapterAccountContext
}

describe('运输模式推断', () => {
  it('wss/ws 推断为 ws,https/http 推断为 sse', () => {
    expect(resolveSocketTransport({ url: 'wss://a/b', headers: {} })).toBe('ws')
    expect(resolveSocketTransport({ url: 'ws://a/b', headers: {} })).toBe('ws')
    expect(resolveSocketTransport({ url: 'https://a/b', headers: {} })).toBe('sse')
    expect(resolveSocketTransport({ url: 'http://a/b', headers: {} })).toBe('sse')
  })

  it('显式 transport 优先于 scheme', () => {
    expect(resolveSocketTransport({ url: 'wss://a/b', headers: {}, transport: 'sse' })).toBe('sse')
    expect(resolveSocketTransport({ url: 'https://a/b', headers: {}, transport: 'ws' })).toBe('ws')
  })

  it('ws + http/https 代理 = 可用(CONNECT 隧道 agent 接管);ws + SOCKS = 不可用', () => {
    // http/https 代理:隧道 agent 支持 ⇒ 可用(代理越全的号越该用长连接,不能反着来)
    expect(canUseSocketTransport({ url: 'wss://a/b', headers: {} }, 'http://proxy:8080')).toBe(true)
    expect(canUseSocketTransport({ url: 'wss://a/b', headers: {} }, 'https://proxy:8080')).toBe(true)
    // SOCKS 隧道 agent 不支持 ⇒ 不可用(否则建连阶段才炸,白付一次握手)
    expect(canUseSocketTransport({ url: 'wss://a/b', headers: {} }, 'socks5://proxy:1080')).toBe(false)
    expect(canUseSocketTransport({ url: 'wss://a/b', headers: {} }, null)).toBe(true)
    // sse 走的是注入的 fetch(账号代理本来就挂在它上面),不受这条限制
    expect(canUseSocketTransport({ url: 'https://a/b', headers: {} }, 'http://proxy:8080')).toBe(true)
  })

  it('isSupportedProxyUrl:仅 http/https 代理被支持,SOCKS/非法 URL 一律 false', () => {
    expect(isSupportedProxyUrl('http://proxy:8080')).toBe(true)
    expect(isSupportedProxyUrl('https://u:p@proxy:3128')).toBe(true)
    expect(isSupportedProxyUrl('socks5://proxy:1080')).toBe(false)
    expect(isSupportedProxyUrl('socks4://proxy:1080')).toBe(false)
    expect(isSupportedProxyUrl('not-a-url')).toBe(false)
  })
})

describe('sse 模式', () => {
  it('按行产帧,上游关流后迭代结束', async () => {
    const fetchImpl = (async () => sseResponse(['data: {"a":1}', '', 'data: {"b":2}'])) as unknown as
      typeof fetch
    const factory = createRelaySocketFactory({ fetchImpl })
    const socket = await factory.open({ url: 'https://up.example/sse', headers: {} })
    const frames = await collectFrames(socket)
    expect(frames.map((f) => f.text)).toEqual(['data: {"a":1}', '', 'data: {"b":2}'])
    expect(socket.lastError()).toBeNull()
  })

  it('4xx 抛 OpenError,status 与 bodyText 原样上交(供转发层分类/401 自愈)', async () => {
    const fetchImpl = (async () =>
      new Response('{"code":401,"msg":"bad cookie"}', { status: 401 })) as unknown as typeof fetch
    const factory = createRelaySocketFactory({ fetchImpl })
    await expect(
      factory.open({ url: 'https://up.example/sse', headers: {} }),
    ).rejects.toMatchObject({ name: 'UpstreamSocketOpenError', status: 401 })
    try {
      await factory.open({ url: 'https://up.example/sse', headers: {} })
    } catch (err) {
      expect(err).toBeInstanceOf(UpstreamSocketOpenError)
      expect((err as UpstreamSocketOpenError).bodyText).toContain('bad cookie')
    }
  })

  it('sse 是单向流:向已建立连接 send 会显式失败而不是静默吞掉', async () => {
    // 用手控流:保持连接"活着",否则读流在 microtask 里就跑完、send 会走 ended 短路。
    // 用 holder 对象而不是裸变量:TS 的控制流分析会把裸变量窄化成 null(赋值发生在
    // ReadableStream.start 回调里,它看不见)。
    const holder: { push: ((chunk: Uint8Array) => void) | null } = { push: null }
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        holder.push = (chunk) => controller.enqueue(chunk)
      },
    })
    const fetchImpl = (async () =>
      new Response(body, {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      })) as unknown as typeof fetch
    const factory = createRelaySocketFactory({ fetchImpl })
    const socket = await factory.open({ url: 'https://up.example/sse', headers: {} })
    socket.send('ping')
    expect(socket.lastError()?.message).toContain('sse 模式不支持')
    holder.push?.(new TextEncoder().encode('data: x\n'))
    socket.close()
  })
})

describe('ws 模式(真服务端)', () => {
  it('双向收发:能收到服务端帧,也能把帧发回服务端', async () => {
    const http: Server = createServer()
    const wss = new WebSocketServer({ server: http })
    const received: string[] = []
    wss.on('connection', (ws) => {
      ws.send('hello-from-upstream')
      ws.on('message', (data: Buffer) => {
        received.push(data.toString())
        ws.send(`echo:${data.toString()}`)
      })
    })
    await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve))
    const port = (http.address() as AddressInfo).port

    const factory = createRelaySocketFactory()
    const socket = await factory.open(
      { url: `ws://127.0.0.1:${port}/`, headers: {}, handshake: { type: 'session.update' } },
      { connectTimeoutMs: 5000 },
    )

    const frames: string[] = []
    const iter = socket.frames()[Symbol.asyncIterator]()
    // 首帧:服务端连上即推
    const first = await iter.next()
    frames.push(first.value?.text ?? '')

    socket.send('client-frame')
    // handshake 也在 open 时发出,它的 echo 可能排在 client-frame 的 echo 前面 ⇒ 读到匹配为止
    for (let i = 0; i < 5; i++) {
      const next = await iter.next()
      const text = next.value?.text ?? ''
      if (text === 'echo:client-frame') {
        frames.push(text)
        break
      }
    }

    expect(frames[0]).toBe('hello-from-upstream')
    expect(frames[1]).toBe('echo:client-frame')
    // handshake 必须作为首帧送达服务端
    expect(received).toContain(JSON.stringify({ type: 'session.update' }))

    socket.close()
    wss.close()
    await new Promise<void>((resolve) => http.close(() => resolve()))
  })
})

describe('socketToSseResponse 桥', () => {
  function mockSocket(
    frames: UpstreamSocketFrame[],
    err?: Error,
  ): UpstreamSocket {
    return {
      send: () => {},
      close: () => {},
      lastError: () => err ?? null,
      frames: () => ({
        [Symbol.asyncIterator]: () => {
          let i = 0
          return {
            next: async () => {
              if (i < frames.length) return { value: frames[i++]!, done: false }
              return { value: undefined, done: true }
            },
          }
        },
      }),
    }
  }

  it('无翻译器:上游 SSE 行原样透传(保留 data: 前缀,不重复加)', async () => {
    const socket = mockSocket([{ text: 'data: {"choices":[]}' }, { text: '{"bare":true}' }])
    const resp = socketToSseResponse(socket, {}, fakeCtx(), {})
    const text = await resp.text()
    expect(text).toContain('data: {"choices":[]}')
    expect(text).toContain('data: {"bare":true}')
    expect(resp.headers.get('content-type')).toBe('text/event-stream')
  })

  it('无翻译器:上游 [DONE] 折叠成单个终止帧并停止消费', async () => {
    const socket = mockSocket([{ text: 'data: [DONE]' }, { text: 'data: {"after":1}' }])
    const resp = socketToSseResponse(socket, {}, fakeCtx(), {})
    const text = await resp.text()
    expect(text).toContain('data: [DONE]')
    expect(text).not.toContain('after')
  })

  it('有翻译器:帧翻成 OpenAI chunk 后写成 SSE data 帧', async () => {
    const adapter = {
      translateSocketFrame: (_ctx: unknown, frame: UpstreamSocketFrame) =>
        frame.text === 'ping'
          ? null
          : { openaiChunk: { id: 'x', choices: [{ delta: { content: frame.text } }] }, done: false },
    } as unknown as RelayUpstreamAdapter
    const socket = mockSocket([{ text: 'ping' }, { text: '你' }, { text: '好' }])
    const resp = socketToSseResponse(socket, adapter, fakeCtx(), {})
    const text = await resp.text()
    expect(text).not.toContain('ping')
    expect(text).toContain('"content":"你"')
    expect(text).toContain('"content":"好"')
  })

  it('上游异常中断:流必须报错,不得静默收尾(否则半包被记成成功)', async () => {
    const socket = mockSocket([{ text: 'data: {"choices":[]}' }], new Error('upstream reset'))
    const resp = socketToSseResponse(socket, {}, fakeCtx(), {})
    await expect(resp.text()).rejects.toThrow('upstream reset')
  })
})

describe('isSocketCapableAdapter 判据', () => {
  const base = {} as RelayUpstreamAdapter

  it('未声明 socketSupported ⇒ false(长连接需显式声明,缺省不猜)', () => {
    expect(isSocketCapableAdapter({ ...base })).toBe(false)
  })

  it('声明 true 但缺 buildSocketRequest ⇒ false(声明与方法必须同时成立)', () => {
    expect(isSocketCapableAdapter({ ...base, socketSupported: true })).toBe(false)
  })

  it('声明 true 且实现方法 ⇒ true', () => {
    const a = { ...base, socketSupported: true, buildSocketRequest: () => ({ url: 'wss://x', headers: {} }) }
    expect(isSocketCapableAdapter(a as RelayUpstreamAdapter)).toBe(true)
  })

  it('豆包已接入:声明 true,sse 运输,且与 HTTP 路径同端点同头', () => {
    expect(isSocketCapableAdapter(doubaoAdapter)).toBe(true)
    const ctx = fakeCtx()
    const req = { model: 'doubao', messages: [{ role: 'user', content: 'hi' }], stream: true }
    const http = doubaoAdapter.buildChatRequest(ctx, req)
    const sock = doubaoAdapter.buildSocketRequest!(ctx, req)
    expect(sock.transport).toBe('sse')
    expect(sock.url).toBe(http.url)
    expect(sock.headers).toEqual(http.headers)
    // body 内含每次生成的 local_conversation_id / block_id / unique_key,
    // 逐字比对必然不等 —— 比"信封结构与用户内容一致"才是真正要守的不变量。
    const a = JSON.parse(sock.rawBody ?? '{}') as Record<string, never>
    const b = JSON.parse(http.rawBody ?? '{}') as Record<string, never>
    expect(Object.keys(a)).toEqual(Object.keys(b))
    // option 内含 create_time_ms / unique_key 等每次生成的字段 ⇒ 剔除后比对信封其余部分
    const stableOption = (body: Record<string, never>): string => {
      const opt = { ...(body['option'] as unknown as Record<string, unknown>) }
      delete opt['create_time_ms']
      delete opt['unique_key']
      return JSON.stringify(opt)
    }
    expect(stableOption(a)).toBe(stableOption(b))
    const textOf = (body: Record<string, never>): string =>
      (body['messages'] as unknown as Array<{ content_block: Array<{ content: { text_block: { text: string } } }> }>)[0]!
        .content_block[0]!.content.text_block.text
    expect(textOf(a)).toBe('hi')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
