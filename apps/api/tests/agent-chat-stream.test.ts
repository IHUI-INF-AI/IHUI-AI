// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * B3 Agent 会话流式回复回归(离线,不连库):`POST /api/agents/:id/messages/stream`。
 *
 * 固定下来的语义(测试即契约):
 *  ① 正常流事件序列 = meta → delta* → done → `[DONE]`;编号帧 id 从 1 连续递增,
 *    `[DONE]` 不编号;心跳只写注释帧,不占 id。
 *  ② Last-Event-ID 重放补齐:原流已收尾时仅重放缺失段(不再调上游),有洞才重新生成。
 *  ③ 客户端中断后生成仍继续到完成 ⇒ 落库**恰好一条** assistant 消息(两件套一次追加)。
 *  ④ 并发第二个请求 = 接管:旧上游 abort、旧流不落库,最终只有接管者写一条。
 *  ⑤ 失败/中断不落半条:没有 done 收尾的流整轮不落库,只发显式 error 帧。
 *
 * Mock 策略:agent-chat-queries 全桩(appendMessages 记录调用面),ai-service 流用可控
 * ReadableStream(测试侧 push/close),与 ai-chat-stream-*.test.ts 同一手法。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import type { AddressInfo } from 'node:net'

const AGENT_ID = '11111111-1111-4111-8111-111111111111'
const URL_AGENT_STREAM = `/api/agents/${AGENT_ID}/messages/stream`

interface UpstreamHandle {
  push: (chunk: string) => void
  close: () => void
  signal?: AbortSignal
}

const harness = vi.hoisted(() => ({
  agentId: '11111111-1111-4111-8111-111111111111',
  appendCalls: [] as Array<{ sessionId: string; messages: Array<Record<string, any>> }>,
  upstreams: [] as UpstreamHandle[],
  llmBodies: [] as Array<Record<string, any>>,
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    EXTENSION_IDS: '',
    DATABASE_URL: 'postgres://localhost:8810/test',
    REDIS_URL: 'redis://127.0.0.1:6399',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
    TBOX_WEBHOOK_SECRET: 'test-secret',
  },
}))

// 鉴权不是被测面:注入固定主体,写路径的归属谓词用的是这个 userId。
vi.mock('../src/plugins/auth.js', () => ({
  checkAuth: async (request: { userId?: string }) => {
    request.userId = 'user-b3'
    return true
  },
}))

// agent 会话写路径全桩:appendMessages 的调用次数/内容就是"落几条"的唯一证据。
vi.mock('../src/db/agent-chat-queries.js', () => ({
  readLatestSession: async () => null,
  findLatestSession: async (agentId: string, userId: string) => ({
    id: 'sess_b3',
    botId: agentId,
    userId,
  }),
  appendMessages: async (sessionId: string, messages: Array<Record<string, any>>) => {
    harness.appendCalls.push({ sessionId, messages })
    return messages.map((m, index) => ({ ...m, seq: index }))
  },
  pageAgentMessages: () => ({
    ok: true,
    page: { items: [], total: 0, hasMoreOlder: false, nextCursor: null },
  }),
}))

// 只供 loadPublishedAgent 的 select 链;其它表在本用例里不碰。
vi.mock('../src/db/index.js', () => {
  const agentRow = {
    agentId: harness.agentId,
    agentPrompt: '你是测试助手',
    agentModel: 'test-model',
    status: 'published',
  }
  const makeChain = () => {
    const chain: Record<string, unknown> = {}
    for (const m of [
      'from',
      'where',
      'orderBy',
      'groupBy',
      'having',
      'limit',
      'offset',
      'leftJoin',
      'innerJoin',
      'returning',
      'values',
      'set',
      'onConflictDoNothing',
      'onConflictDoUpdate',
    ]) {
      chain[m] = () => chain
    }
    chain.then = (resolve: (v: unknown[]) => void) => Promise.resolve([agentRow]).then(resolve)
    return chain
  }
  const api = {
    select: () => makeChain(),
    insert: () => makeChain(),
    update: () => makeChain(),
    delete: () => makeChain(),
    execute: async () => [],
  }
  return { db: api, dbRead: api }
})

// 上游 SSE:每个请求一条可控流;测试侧 push / close 决定帧到达时刻。
// abort 监听让 controller.abort() 像真 fetch 一样让 read() 抛 AbortError。
vi.mock('../src/utils/ai-service-fetch.js', () => ({
  aiServiceSystemFetch: async (_path: string, init: Record<string, unknown>) => {
    harness.llmBodies.push(JSON.parse(String(init.body)) as Record<string, any>)
    const encoder = new TextEncoder()
    let streamCtrl: any
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        streamCtrl = controller
        const signal = init.signal as AbortSignal | undefined
        signal?.addEventListener('abort', () => {
          try {
            controller.error(Object.assign(new Error('aborted'), { name: 'AbortError' }))
          } catch {
            /* 已关闭的流重复 error 无害 */
          }
        })
      },
    })
    harness.upstreams.push({
      push: (chunk: string) => {
        try {
          streamCtrl.enqueue(encoder.encode(chunk))
        } catch {
          /* 已关闭 */
        }
      },
      close: () => {
        try {
          streamCtrl.close()
        } catch {
          /* 已关闭 */
        }
      },
      signal: init.signal as AbortSignal | undefined,
    })
    return { ok: true, body, text: async () => '' }
  },
}))

import { mobileChatRoutes } from '../src/routes/mobile-chat-routes.js'
import { startHeartbeat, type StreamSession } from '../src/utils/sse-stream-registry.js'

/** 一条上游 chunk 帧(ai-service 原形:event + data 两行)。 */
function upstreamChunk(content: string): string {
  return `event: chunk\ndata: ${JSON.stringify({ type: 'chunk', content })}\n\n`
}

const UPSTREAM_DONE = `event: done\ndata: ${JSON.stringify({ type: 'done', finishReason: 'stop' })}\n\n`

interface SseFrame {
  id: number | null
  data: string | null
  comment: boolean
}

function framesOf(body: string): SseFrame[] {
  return body
    .split('\n\n')
    .filter((block) => block.trim() !== '')
    .map((block) => {
      const lines = block.split('\n')
      const idLine = lines.find((l) => l.startsWith('id:'))
      const dataLine = lines.find((l) => l.startsWith('data:'))
      return {
        id: idLine ? Number(idLine.slice(3).trim()) : null,
        data: dataLine ? dataLine.slice(5).trim() : null,
        comment: block.startsWith(':'),
      }
    })
}

function numbered(frames: SseFrame[]): number[] {
  return frames.filter((f) => f.id !== null).map((f) => f.id as number)
}

describe('B3 Agent 会话 SSE 流式回复', () => {
  const server: FastifyInstance = Fastify({ logger: false })
  let base = ''

  beforeAll(async () => {
    await server.register(mobileChatRoutes, { prefix: '/api' })
    await server.ready()
    await server.listen({ port: 0, host: '127.0.0.1' })
    base = `http://127.0.0.1:${(server.server.address() as AddressInfo).port}`
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    harness.appendCalls.length = 0
    harness.upstreams.length = 0
    harness.llmBodies.length = 0
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  async function waitForUpstream(count = 1): Promise<UpstreamHandle> {
    await vi.waitFor(
      () => {
        if (harness.upstreams.length < count) throw new Error('waiting upstream')
      },
      { timeout: 2000 },
    )
    return harness.upstreams[count - 1]!
  }

  async function postStream(content: string, headers: Record<string, string> = {}) {
    return server.inject({
      method: 'POST',
      url: URL_AGENT_STREAM,
      headers,
      payload: { content },
    })
  }

  it('正常流:meta → delta* → done → [DONE],id 连续,落库一次两件套', async () => {
    const pending = postStream('你好')
    const upstream = await waitForUpstream()
    upstream.push(upstreamChunk('你好'))
    upstream.push(upstreamChunk('，'))
    upstream.push(upstreamChunk('世界'))
    upstream.push(UPSTREAM_DONE)
    upstream.push('data: [DONE]\n\n')
    upstream.close()

    const res = await pending
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/event-stream')

    const frames = framesOf(res.body)
    expect(frames.filter((f) => f.comment)).toHaveLength(0)
    const dataFrames = frames.filter((f) => f.data !== null)
    const parsed = dataFrames.map((f) => f.data as string)
    const types = parsed.map((p) =>
      p === '[DONE]' ? 'DONE' : (JSON.parse(p) as { type: string }).type,
    )
    expect(types).toEqual(['meta', 'delta', 'delta', 'delta', 'done', 'DONE'])
    // 编号帧 1..5 连续;[DONE] 是终止符,不占 id
    expect(numbered(frames)).toEqual([1, 2, 3, 4, 5])
    expect(frames[frames.length - 1]!.id).toBeNull()

    // 本轮 user+assistant 一次原子追加(B1 的 appendMessages)
    expect(harness.appendCalls).toHaveLength(1)
    const messages = harness.appendCalls[0]!.messages
    expect(messages.map((m) => m.role)).toEqual(['user', 'assistant'])
    expect(messages[1]!.content).toBe('你好，世界')
    expect(harness.appendCalls[0]!.sessionId).toBe('sess_b3')

    // 喂给上游的上下文:system + 本轮 user
    const body = harness.llmBodies[0]!
    expect(body.messages[0]).toEqual({ role: 'system', content: '你是测试助手' })
    expect(body.messages[body.messages.length - 1]).toEqual({ role: 'user', content: '你好' })
  })

  it('Last-Event-ID 重放:原流已收尾时只补缺失段,不再调上游', async () => {
    const first = postStream('第一轮')
    const upstream = await waitForUpstream()
    upstream.push(upstreamChunk('A'))
    upstream.push(upstreamChunk('B'))
    upstream.push(UPSTREAM_DONE)
    upstream.push('data: [DONE]\n\n')
    upstream.close()
    expect((await first).statusCode).toBe(200)
    expect(harness.appendCalls).toHaveLength(1)

    // 断线重连:已收到 id 2,应补 3..4(delta B / done),不得重复 1..2,也不得换新上游
    const replay = await postStream('第一轮', { 'last-event-id': '2' })
    expect(replay.statusCode).toBe(200)
    expect(numbered(framesOf(replay.body))).toEqual([3, 4])
    expect(replay.body).toContain('data: [DONE]')
    expect(replay.body).not.toContain('id: 1\n')
    expect(replay.body).not.toContain('id: 2\n')
    expect(harness.upstreams).toHaveLength(1)
    expect(harness.appendCalls).toHaveLength(1)
  })

  it('心跳只写注释帧:不进事件序列、不占 id', async () => {
    vi.useFakeTimers()
    const raw = { write: vi.fn() }
    const session = {
      replayKey: 'agent:hb:user',
      upstreamSessionId: null,
      controller: new AbortController(),
      seq: 3,
      raw: raw as unknown as StreamSession['raw'],
      graceTimer: null,
      finished: false,
      replayAbandoned: false,
      replaySaturated: false,
    } as StreamSession
    const stop = startHeartbeat(session, 100)
    vi.advanceTimersByTime(250)
    expect(raw.write.mock.calls.map((c) => c[0])).toEqual([': ping\n\n', ': ping\n\n'])
    // 断线后(session.raw = null)心跳跳过,不向已断连接写
    session.raw = null
    vi.advanceTimersByTime(200)
    expect(raw.write).toHaveBeenCalledTimes(2)
    stop()
    vi.advanceTimersByTime(200)
    expect(raw.write).toHaveBeenCalledTimes(2)
    // 心跳帧不含 data:/id:,解析器不会把它折成业务事件
    for (const call of raw.write.mock.calls) {
      expect(call[0]).not.toContain('data:')
      expect(call[0]).not.toContain('id:')
    }
  })

  it('客户端中断但生成跑完:落库恰好一条 assistant 消息(完整内容)', async () => {
    const clientAbort = new AbortController()
    const res = await fetch(`${base}${URL_AGENT_STREAM}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: '中断测试' }),
      signal: clientAbort.signal,
    })
    const reader = res.body!.getReader()
    const upstream = await waitForUpstream()
    upstream.push(upstreamChunk('前半'))
    // 收到 meta + 首个 delta 后客户端断开
    const decoder = new TextDecoder()
    let seen = ''
    while ((seen.match(/id: /g) ?? []).length < 2) {
      const { done, value } = await reader.read()
      if (done) break
      seen += decoder.decode(value, { stream: true })
    }
    clientAbort.abort()

    upstream.push(upstreamChunk('后半'))
    upstream.push(UPSTREAM_DONE)
    upstream.push('data: [DONE]\n\n')
    upstream.close()

    await vi.waitFor(
      () => {
        if (harness.appendCalls.length === 0) throw new Error('waiting append')
      },
      { timeout: 2000 },
    )
    expect(harness.appendCalls).toHaveLength(1)
    const assistant = harness.appendCalls[0]!.messages.filter((m) => m.role === 'assistant')
    expect(assistant).toHaveLength(1)
    expect(assistant[0]!.content).toBe('前半后半')
  })

  it('断线后在宽限窗内带 Last-Event-ID 重连:接管原上游,不重新生成', async () => {
    const clientAbort = new AbortController()
    const res = await fetch(`${base}${URL_AGENT_STREAM}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: '接管测试' }),
      signal: clientAbort.signal,
    })
    const reader = res.body!.getReader()
    const upstream = await waitForUpstream()
    upstream.push(upstreamChunk('片段1'))
    const decoder = new TextDecoder()
    let seen = ''
    while ((seen.match(/id: /g) ?? []).length < 2) {
      const { done, value } = await reader.read()
      if (done) break
      seen += decoder.decode(value, { stream: true })
    }
    clientAbort.abort()

    // 重连必须立刻拿到响应头:接管分支缺失段为空时无帧可写,头必须由 flushHeaders 送出,
    // 否则 fetch 会一直等到下一拍心跳(15s)才 resolve —— 这是"重连没反应"的根因。
    const resumed = await fetch(`${base}${URL_AGENT_STREAM}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'last-event-id': '2' },
      body: JSON.stringify({ content: '接管测试' }),
    })
    // 接管 = 换绑连接,不新起上游
    expect(harness.upstreams).toHaveLength(1)
    upstream.push(upstreamChunk('片段2'))
    upstream.push(upstreamChunk('片段3'))
    upstream.push(UPSTREAM_DONE)
    upstream.push('data: [DONE]\n\n')
    upstream.close()

    const body = await resumed.text()
    expect(numbered(framesOf(body))).toEqual([3, 4, 5])
    expect(body).toContain('"delta"')
    expect(body).toContain('data: [DONE]')

    await vi.waitFor(
      () => {
        if (harness.appendCalls.length === 0) throw new Error('waiting append')
      },
      { timeout: 2000 },
    )
    expect(harness.appendCalls).toHaveLength(1)
    expect(harness.appendCalls[0]!.messages[0]!.content).toBe('接管测试')
    expect(harness.appendCalls[0]!.messages[1]!.content).toBe('片段1片段2片段3')
  })

  it('并发第二个请求:接管旧流(旧上游 abort、旧流不落库),最终只落一条', async () => {
    const first = fetch(`${base}${URL_AGENT_STREAM}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: '旧请求' }),
    })
    const upstreamA = await waitForUpstream()
    upstreamA.push(upstreamChunk('旧片段'))
    const second = fetch(`${base}${URL_AGENT_STREAM}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: '新请求' }),
    })
    const upstreamB = await waitForUpstream(2)

    // 旧上游被 abort(单上游单消费者)
    expect(upstreamA.signal?.aborted).toBe(true)

    upstreamB.push(upstreamChunk('新片段'))
    upstreamB.push(UPSTREAM_DONE)
    upstreamB.push('data: [DONE]\n\n')
    upstreamB.close()

    const [resA, resB] = await Promise.all([first, second])
    const bodyB = await resB.text()
    expect(numbered(framesOf(bodyB))).toEqual([1, 2, 3])
    await resA.text()

    await vi.waitFor(
      () => {
        if (harness.appendCalls.length === 0) throw new Error('waiting append')
      },
      { timeout: 2000 },
    )
    // 双写禁止:旧流被接管后不再落库,只有接管者的一条 turn
    expect(harness.appendCalls).toHaveLength(1)
    expect(harness.appendCalls[0]!.messages.map((m) => m.content)).toEqual(['新请求', '新片段'])
  })

  it('上游没有 done 收尾:整轮不落库,只发显式 error 帧', async () => {
    const pending = postStream('半截')
    const upstream = await waitForUpstream()
    upstream.push(upstreamChunk('半截内容'))
    upstream.close()

    const res = await pending
    const frames = framesOf(res.body)
    const types = frames
      .filter((f) => f.data !== null)
      .map((f) => f.data as string)
      .map((p) => (p === '[DONE]' ? 'DONE' : (JSON.parse(p) as { type: string }).type))
    expect(types).toEqual(['meta', 'delta', 'error'])
    expect(harness.appendCalls).toHaveLength(0)
    expect(
      framesOf(res.body).some(
        (f) => (f.data ?? '').includes('半截内容') && (f.data ?? '').includes('"delta"'),
      ),
    ).toBe(true)
  })

  it('参数校验在 hijack 之前完成(空 content 回 400 JSON)', async () => {
    const res = await postStream('')
    expect(res.statusCode).toBe(400)
    expect(() => JSON.parse(res.body)).not.toThrow()
    expect(harness.upstreams).toHaveLength(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
