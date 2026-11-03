// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 第九轮 B2 · 编排 emit 联动结论三键的「网关接线」回归(2026-09-26 立)。
 *
 * 钉的是这一格:ai-service 的 `POST /orchestration/events/emit` 已在响应 `data`
 * 里追加 `outcome` / `degraded` / `non_ok_pillars`,而 api 侧 `emitEvent()` 的返回
 * 类型仍写着 `{ event_id: string }` —— 运行时 `callOrchestration` 是整体 JSON 透传
 * (不剥未知键),事实早就到了 api,只是被类型层擦掉,调用方结构上看不见。
 * 本测试用**假上游回包驱动真转发链**(route → service → aiServiceFetch → fetch),
 * 只桩网络边界,不桩被测函数。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'
import { orchestrationRoutes } from '../src/routes/orchestration.js'

/**
 * 鉴权打桩:扮演真实 authenticate —— 无身份 401、有身份才摆 userId。
 * 这样"三键是在受保护端点上被读出来的"才是跑出来的结论。
 */
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: async (request: FastifyRequest): Promise<void> => {
    const raw = request.headers['x-test-user']
    if (typeof raw !== 'string' || raw === '') {
      const err = new Error('未登录') as Error & { statusCode: number }
      err.statusCode = 401
      throw err
    }
    ;(request as unknown as { userId?: number }).userId = Number(raw)
  },
}))

interface EmitResponseEnvelope {
  code: number
  message: string
  data: {
    event_id: string
    outcome?: string | null
    degraded?: boolean | null
    non_ok_pillars?: string[] | null
  }
}

const AI_SERVICE_EMIT_PATH = '/api/orchestration/events/emit'
const REQUEST_HEADERS = { 'x-test-user': '42', authorization: 'Bearer test-access-token' }
const REQUEST_PAYLOAD = {
  event_type: 'rules.violated',
  source_pillar: 'rules',
  payload: { rule_id: 'r-1' },
  severity: 'warning',
}

/** 每次出站 fetch 的落点与请求体,用来证明真的走了转发链而不是桩掉了 emitEvent */
const upstreamCalls: Array<{ url: string; body?: string }> = []

/** 装一个假 ai-service:返回 { code:0, message, data } 信封 */
function stubUpstreamData(data: unknown): void {
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    upstreamCalls.push({
      url: String(input),
      body: typeof init?.body === 'string' ? init.body : undefined,
    })
    return new Response(JSON.stringify({ code: 0, message: 'success', data }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fetchMock)
}

async function emitOnce(app: FastifyInstance): Promise<EmitResponseEnvelope> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/orchestration/events/emit',
    headers: REQUEST_HEADERS,
    payload: REQUEST_PAYLOAD,
  })
  expect(res.statusCode).toBe(200)
  return JSON.parse(res.payload) as EmitResponseEnvelope
}

describe('POST /api/orchestration/events/emit — 联动结论三键接线', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    upstreamCalls.length = 0
    app = Fastify()
    app.register(orchestrationRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterEach(async () => {
    vi.unstubAllGlobals()
    await app.close()
  })

  it('转发链真实落到 ai-service 的 emit 端点且请求体原样送出', async () => {
    stubUpstreamData({ event_id: 'evt-1', outcome: 'settled', degraded: false, non_ok_pillars: [] })

    await emitOnce(app)

    expect(upstreamCalls).toHaveLength(1)
    expect(upstreamCalls[0]?.url.endsWith(AI_SERVICE_EMIT_PATH)).toBe(true)
    const sent = JSON.parse(upstreamCalls[0]?.body ?? '{}') as Record<string, unknown>
    expect(sent.event_type).toBe('rules.violated')
    expect(sent.source_pillar).toBe('rules')
    expect(sent.severity).toBe('warning')
  })

  it('settled 档:三键齐备且既有 event_id 不回退', async () => {
    stubUpstreamData({
      event_id: 'evt-settled',
      outcome: 'settled',
      degraded: true,
      non_ok_pillars: ['hook', 'budget'],
    })

    const body = await emitOnce(app)

    expect(body.code).toBe(0)
    expect(body.data.event_id).toBe('evt-settled')
    expect(body.data.outcome).toBe('settled')
    expect(body.data.degraded).toBe(true)
    expect(body.data.non_ok_pillars).toEqual(['hook', 'budget'])
  })

  it('settled 未降级档:degraded 必须是 false(不是 null、不是缺键)', async () => {
    stubUpstreamData({
      event_id: 'evt-ok',
      outcome: 'settled',
      degraded: false,
      non_ok_pillars: [],
    })

    const body = await emitOnce(app)

    expect(body.data.degraded).toBe(false)
    expect(body.data.non_ok_pillars).toEqual([])
  })

  /**
   * 反向锁:投影必须"先透传再归一"。若这里改成只白名单四键,上游将来新增的键就会
   * 在这一格被静默吞掉 —— 那等于在本票修掉的那一格旁边再挖一格,而且完全不报错。
   */
  it('上游将来新增的第五键不得被投影吞掉', async () => {
    stubUpstreamData({
      event_id: 'evt-future',
      outcome: 'settled',
      degraded: false,
      non_ok_pillars: [],
      next_dispatch_id: 'nd-9',
    })

    const res = await app.inject({
      method: 'POST',
      url: '/api/orchestration/events/emit',
      headers: REQUEST_HEADERS,
      payload: REQUEST_PAYLOAD,
    })
    const body = JSON.parse(res.payload) as { data: Record<string, unknown> }

    expect(body.data.next_dispatch_id).toBe('nd-9')
    expect(body.data.event_id).toBe('evt-future')
  })

  /**
   * 判据有牙的一格:未知档一律 null。
   * 若投影写成 `data.degraded ?? false`,本用例必红 —— 那正是"把没判写成判过了"。
   */
  it('accepted 档:degraded / non_ok_pillars 必须是 null 而绝不是 false', async () => {
    stubUpstreamData({
      event_id: 'evt-accepted',
      outcome: 'accepted',
      degraded: null,
      non_ok_pillars: null,
    })

    const body = await emitOnce(app)

    expect(body.data.outcome).toBe('accepted')
    expect(body.data.degraded).toBeNull()
    expect(body.data.degraded).not.toBe(false)
    expect(body.data.non_ok_pillars).toBeNull()
    expect('degraded' in body.data).toBe(true)
    expect('non_ok_pillars' in body.data).toBe(true)
  })

  it('unsettled 档:同样是 null(它是真实现,不得被洗成"未降级")', async () => {
    stubUpstreamData({
      event_id: 'evt-unsettled',
      outcome: 'unsettled',
      degraded: null,
      non_ok_pillars: null,
    })

    const body = await emitOnce(app)

    expect(body.data.outcome).toBe('unsettled')
    expect(body.data.degraded).toBeNull()
    expect(body.data.non_ok_pillars).toBeNull()
  })

  it('上游旧版不带三键:键仍出现在响应面且取 null,event_id 不受影响', async () => {
    stubUpstreamData({ event_id: 'evt-legacy' })

    const body = await emitOnce(app)

    expect(body.data.event_id).toBe('evt-legacy')
    expect(body.data.outcome).toBeNull()
    expect(body.data.degraded).toBeNull()
    expect(body.data.non_ok_pillars).toBeNull()
  })

  it('上游业务错误信封仍按既有语义降级成 503,不因新契约改变', async () => {
    const fetchMock = vi.fn(async () => {
      upstreamCalls.push({ url: `http://ai-service.invalid${AI_SERVICE_EMIT_PATH}` })
      return new Response(JSON.stringify({ code: 500, message: 'boom', data: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const res = await app.inject({
      method: 'POST',
      url: '/api/orchestration/events/emit',
      headers: REQUEST_HEADERS,
      payload: REQUEST_PAYLOAD,
    })

    expect(res.statusCode).toBe(503)
    expect(JSON.parse(res.payload) as { code: number }).toEqual({ code: 503, message: '事件发射失败' })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
