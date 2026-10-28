// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * relay-account-forwarder 单测(2026-10-22):账号池回落转发核心路径。
 * 零真实网络/数据库:drizzle 链式 mock + fetch 打桩 + 假适配器注册。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── db mock:select 按查询特征供行(join=provider 反查 / orderBy=账号候选),update 记录 set 参数 ──
let providerRows: unknown[] = []
let accountRows: unknown[] = []
const updateCalls: Array<Record<string, unknown>> = []

vi.mock('../src/db/index.js', () => {
  const withSettlers = (step: Record<string, unknown>, resolver: () => unknown[]) => {
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(resolver()).then(resolve, reject)
    // 转发层对落库更新是 fire-and-forget(.catch),链对象必须支持 catch
    step.catch = (reject?: (e: unknown) => void) => Promise.resolve(resolver()).catch(reject)
    step.finally = (fn?: () => void) => Promise.resolve(resolver()).finally(fn)
    return step
  }
  const chainSelect = () => {
    const flags = { join: false }
    const step: Record<string, unknown> = {}
    for (const m of ['from', 'where', 'limit', 'offset', 'orderBy', 'groupBy']) {
      step[m] = vi.fn(() => step)
    }
    step.innerJoin = vi.fn(() => {
      flags.join = true
      return step
    })
    return withSettlers(step, () => (flags.join ? providerRows : accountRows))
  }
  const chainWrite = () => {
    const step: Record<string, unknown> = {}
    for (const m of ['from', 'where', 'returning', 'values']) {
      step[m] = vi.fn(() => step)
    }
    step.set = vi.fn((arg?: unknown) => {
      if (arg && typeof arg === 'object') updateCalls.push(arg as Record<string, unknown>)
      return step
    })
    return withSettlers(step, () => [])
  }
  return {
    db: {
      select: chainSelect,
      update: chainWrite,
      insert: chainWrite,
      delete: chainWrite,
    },
    dbRead: { select: chainSelect },
  }
})

vi.mock('../src/utils/crypto.js', () => ({
  encryptField: (v: string) => `enc:${v}`,
  decryptField: (v: string) => (v.startsWith('enc:') ? v.slice(4) : v),
}))

// shared-state 强制「内存兜底」档(与 auth 测试先例同口径:REDIS_URL 指死端口,
// 命令即刻失败即刻降级,绝不与并行套件共享真实 Redis 的 relay:pool:* 键)
vi.mock('../src/config/index.js', () => ({
  config: { REDIS_URL: 'redis://127.0.0.1:1/0' },
  // 同上:config 出口的守卫开关必须一并打桩,否则整文件收集期失败(静默不跑)。
  isProductionGuard: false,
}))

// 台账/代理池/模型目录三服务打桩:转发主链路整合点(埋点/取代理/别名)的断言面,
// 默认全 no-op(不触 db mock 链,防 updateCalls 被代理池 lastPickedAt 写污染)
const mockRecordAccountUsage = vi.fn(async () => {})
const mockPickProxy = vi.fn(async (_account: unknown) => null as string | null)
const mockReportProxyFailure = vi.fn(async () => {})
const mockReportProxySuccess = vi.fn(async () => {})
const mockResolveAlias = vi.fn(async (_p: string, _m: string) => null)
vi.mock('../src/services/relay-account-usage.js', () => ({
  recordAccountUsage: (...a: unknown[]) => mockRecordAccountUsage(...(a as [never])),
}))
vi.mock('../src/services/relay-proxy-pool.js', () => ({
  pickProxyForAccount: (account: { id: string; proxyUrl: string | null }) => mockPickProxy(account),
  reportProxyFailure: (u: string) => mockReportProxyFailure(u),
  reportProxySuccess: (u: string) => mockReportProxySuccess(u),
  // 2026-10-28:代理 URL 改为加密存储后,换票链路(doRefreshRowInPlace)会在调用
  // adapter.refreshToken **之前**先求值 resolveAccountProxyUrl(row.proxyUrl)。手写全量
  // mock 漏这一个导出 ⇒ 该求值当场抛 "No … export is defined on the mock",异常被
  // 换票的 catch 吞成 null ⇒ 表现为"401 不自愈、refreshToken 一次都没被调用",
  // 与真实的自愈缺陷同形(排查方向会被带偏到自愈逻辑上)。此处按明文透传即可:
  // 本文件夹具里的 proxyUrl 本就是明文/null,不涉及解密。
  resolveAccountProxyUrl: (stored: string | null | undefined) => stored ?? null,
  encryptAccountProxyUrl: (plain: string | null | undefined) => plain ?? null,
  maskAccountProxyUrl: (stored: string | null | undefined) => stored ?? null,
}))
vi.mock('../src/services/relay-model-catalog.js', () => ({
  resolveModelAlias: (p: string, m: string) => mockResolveAlias(p, m),
}))

// undici 打桩：自 2026-10-28 起 poolFetch 两条分支都走 undiciFetch（直连挂连接期守卫的 Agent），
// 而本文件两种桩法并存 —— 有的用例配 mockUndiciFetch（代理路径），有的用 vi.stubGlobal('fetch')
// （早期的直连桩）。这里做委托：本用例配过 undici 桩就用它，否则转交给当时的 global fetch 桩，
// 于是两种写法都不必逐用例重写。生产出口不因桩面妥协（守卫要真装在连接上才有意义）。
const mockUndiciFetch = vi.fn()
vi.mock('undici', () => ({
  ProxyAgent: class {
    close(): void {}
  },
  // 直连出口的 dispatcher（utils/relay-egress-guard.ts）；本文件只测转发语义，桩成空壳。
  Agent: class {
    constructor(_opts?: unknown) {}
    close(): void {}
  },
  fetch: (...args: unknown[]) => {
    if (mockUndiciFetch.getMockImplementation?.()) return mockUndiciFetch(...args)
    return (globalThis.fetch as (...a: unknown[]) => unknown)(...args)
  },
}))

/**
 * 出网复检（utils/relay-egress-guard.ts）会在发请求前问一次 DNS。
 * 本文件的 https://upstream.test 是假域名，桩成公网 IP 才能让用例继续测"转发逻辑"本身；
 * 真实 DNS 失败在生产等价于 fetch 自己失败，语义没有变化。
 */
vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async () => [{ address: '203.0.113.10', family: 4 }]),
}))

import { forwardToAccountPool, __test__ as F } from '../src/services/relay-account-forwarder.js'
import { classifyUpstreamFailure as classifyTraeFailure } from '../src/services/upstream-adapters/trae-adapter.js'
import {
  __test__ as sharedState,
  clearAccountCooldown,
  getAccountsInCooldown,
  getSessionAffinity,
  setAccountCooldown,
  setSessionAffinity,
  tryAcquireGlobalInflight,
} from '../src/services/relay-account-shared-state.js'
import { __test__ as POLICY } from '../src/services/relay-pool-policy.js'
import { registerRelayAdapter } from '../src/services/relay-upstream-adapters.js'
import type {
  AdapterAccountContext,
  RelayUpstreamAdapter,
  TranslatedChunk,
} from '../src/services/relay-upstream-adapters.js'

const FUTURE = new Date(Date.now() + 7 * 24 * 3600_000)

// 每次调用(含 vitest retry 重跑)生成唯一 id:隔离模块级熔断/亲和缓存,防跨轮污染
let rowSeq = 0
function accountRow(label: string, overrides: Record<string, unknown> = {}): unknown {
  const id = `${label}-${++rowSeq}`
  return {
    id,
    providerCode: 'trae',
    uid: `uid-${id}`,
    name: `测试号-${id}`,
    tokenEnc: 'enc:jwt-old',
    refreshTokenEnc: null,
    cookiesEnc: null,
    secretsEnc: null,
    deviceId: null,
    machineId: null,
    tokenExpiresAt: FUTURE,
    refreshExpiresAt: null,
    priority: 0,
    weight: 1,
    isEnabled: true,
    tempUnschedulable: false,
    healthStatus: 'unknown',
    healthCheckedAt: null,
    lastErrorMessage: null,
    lastUsedAt: null,
    lastRefreshAt: null,
    refreshFailureCount: 0,
    consecutiveFailures: 0,
    proxyUrl: null,
    totalCalls: 0,
    extraMetadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function baseReq(model: string) {
  return {
    model,
    messages: [{ role: 'user' as const, content: 'hi' }],
    stream: true,
    userId: 'user-1',
    affinityKey: 'key-1',
  }
}

/** 最小假适配器(必选成员齐全;各测试按需覆盖) */
function fakeAdapter(
  overrides: Partial<RelayUpstreamAdapter> & { providerCode: string },
): RelayUpstreamAdapter {
  const base: RelayUpstreamAdapter = {
    providerCode: overrides.providerCode as RelayUpstreamAdapter['providerCode'],
    buildChatRequest: () => ({
      url: 'https://upstream.test/v',
      method: 'POST',
      headers: {},
      body: {},
    }),
    translateStreamChunk: (_c, raw, _s): TranslatedChunk | null => {
      const payload = raw.trim().slice(5).trim()
      if (!payload || payload === '[DONE]') return null
      return { openaiChunk: JSON.parse(payload) as Record<string, unknown> }
    },
    translateNonStream: (_c, body) => (body ?? {}) as Record<string, unknown>,
    checkHealth: async () => ({ ok: true }),
    isAuthFailure: (status) => status === 401 || status === 403,
  }
  return { ...base, ...overrides }
}

beforeEach(async () => {
  providerRows = []
  accountRows = []
  updateCalls.length = 0
  vi.unstubAllGlobals()
  await sharedState.reset()
  mockRecordAccountUsage.mockReset().mockResolvedValue(undefined)
  mockPickProxy.mockReset().mockResolvedValue(null)
  mockReportProxyFailure.mockReset().mockResolvedValue(undefined)
  mockReportProxySuccess.mockReset().mockResolvedValue(undefined)
  mockResolveAlias.mockReset().mockResolvedValue(null)
  mockUndiciFetch.mockReset()
})

/** 多轮完整上下文(锁定 failover 全量回放不变量的夹具) */
function multiTurnMessages() {
  return [
    { role: 'system', content: '你是 IHUI 助手。' },
    { role: 'user', content: '第一轮提问' },
    { role: 'assistant', content: '第一轮回答' },
    { role: 'user', content: '第二轮提问,这段最长的上下文绝不能被截断' },
  ]
}

describe('forwardToAccountPool', () => {
  it('模型无账号池平台映射 → null(回退 ai-service)', async () => {
    providerRows = []
    accountRows = [accountRow('acct-x')]
    const res = await forwardToAccountPool(baseReq('no-pool-model-1'), 'no-pool-model-1')
    expect(res).toBeNull()
  })

  it('executeChat 路径:chunk 序列合成 SSE Response + [DONE] + 成功计数', async () => {
    providerRows = [{ providerCode: 'trae', configId: 7 }]
    accountRows = [accountRow('acct-exec')]
    registerRelayAdapter(
      fakeAdapter({
        providerCode: 'trae',
        buildChatRequest: () => {
          throw new Error('不应走通用路径')
        },
        async executeChat() {
          async function* gen() {
            yield {
              id: 's1',
              object: 'chat.completion.chunk',
              choices: [{ index: 0, delta: { content: '你好' } }],
            }
            yield {
              id: 's1',
              object: 'chat.completion.chunk',
              choices: [{ index: 0, delta: { content: '世界' }, finish_reason: 'stop' }],
            }
          }
          return { stream: gen() }
        },
      }),
    )
    const res = await forwardToAccountPool(baseReq('exec-model-1'), 'exec-model-1')
    expect(res && res.ok).toBe(true)
    if (!res || !res.ok) return
    expect(res.channel.groupId).toBe('account-pool')
    expect(res.channel.configId).toBe(7)
    const text = await res.response.text()
    expect(text).toContain('data: {"id":"s1"')
    expect(text).toContain('你好')
    expect(text.trimEnd().endsWith('data: [DONE]\n\n'.trimEnd())).toBe(true)
    // recordSuccess 落库:consecutiveFailures 清零 + healthy
    await vi.waitFor(() => expect(updateCalls.length).toBeGreaterThan(0))
    expect(updateCalls.some((s) => s.healthStatus === 'healthy')).toBe(true)
  })

  it('通用流式路径:上游 SSE 逐帧翻译重封装', async () => {
    providerRows = [{ providerCode: 'trae', configId: 7 }]
    accountRows = [accountRow('acct-stream')]
    registerRelayAdapter(fakeAdapter({ providerCode: 'trae' }))
    const upstream = 'data: {"choices":[{"delta":{"content":"AAA"}}]}\n\ndata: [DONE]\n\n'
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(upstream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
      ),
    )
    const res = await forwardToAccountPool(baseReq('stream-model-1'), 'stream-model-1')
    expect(res && res.ok).toBe(true)
    if (!res || !res.ok) return
    const text = await res.response.text()
    expect(text).toContain('"content":"AAA"')
    expect(text).toContain('[DONE]')
  })

  it('401 自愈:isAuthFailure → refreshToken → 重试一次成功', async () => {
    providerRows = [{ providerCode: 'trae', configId: 7 }]
    accountRows = [accountRow('acct-401', { refreshTokenEnc: 'enc:rt-1' })]
    const refreshToken = vi.fn(async () => ({ token: 'jwt-new', expiresAt: FUTURE }))
    registerRelayAdapter(
      fakeAdapter({
        providerCode: 'trae',
        refreshToken,
        buildChatRequest: (ctx: AdapterAccountContext) => ({
          url: 'https://upstream.test/v',
          method: 'POST',
          headers: { Authorization: `Bearer ${ctx.credentials.token}` },
          body: { x: 1 },
        }),
      }),
    )
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('unauthorized', { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'cm-1', object: 'chat.completion', choices: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    vi.stubGlobal('fetch', fetchMock)
    const req = { ...baseReq('auth-model-1'), stream: false }
    const res = await forwardToAccountPool(req, 'auth-model-1')
    expect(res && res.ok).toBe(true)
    expect(refreshToken).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    // 第二次请求带刷新后的 token
    const secondInit = fetchMock.mock.calls[1]?.[1] as { headers: Record<string, string> }
    expect(secondInit.headers.Authorization).toBe('Bearer jwt-new')
  })

  it('credit 分类:失败透传 + 摘除落库(tempUnschedulable)', async () => {
    providerRows = [{ providerCode: 'trae', configId: 7 }]
    accountRows = [accountRow('acct-credit')]
    registerRelayAdapter(
      fakeAdapter({
        providerCode: 'trae',
        classifyUpstreamFailure: (status) =>
          status === 402 ? { kind: 'credit' as const } : { kind: 'client' as const },
      }),
    )
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"error":"insufficient credit"}', { status: 402 })),
    )
    const res = await forwardToAccountPool(baseReq('credit-model-1'), 'credit-model-1')
    expect(res && res.ok).toBe(false)
    if (!res || res.ok) return
    expect(res.lastHttpStatus).toBe(402)
    await vi.waitFor(() => expect(updateCalls.some((s) => s.tempUnschedulable === true)).toBe(true))
  })

  it('非流式请求 + 上游强制流式:网关侧聚合成 chat.completion', async () => {
    providerRows = [{ providerCode: 'trae', configId: 7 }]
    accountRows = [accountRow('acct-agg')]
    registerRelayAdapter(fakeAdapter({ providerCode: 'trae' }))
    const sse =
      'data: {"id":"c9","created":1700000000,"choices":[{"delta":{"content":"Hello "}}]}\n\n' +
      'data: {"id":"c9","choices":[{"delta":{"content":"World"},"finish_reason":"stop"}]}\n\n' +
      'data: {"id":"c9","choices":[],"usage":{"prompt_tokens":3,"completion_tokens":5,"total_tokens":8}}\n\n' +
      'data: [DONE]\n\n'
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(sse, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
      ),
    )
    const req = { ...baseReq('agg-model-1'), stream: false }
    const res = await forwardToAccountPool(req, 'agg-model-1')
    expect(res && res.ok).toBe(true)
    if (!res || !res.ok) return
    const json = (await res.response.json()) as Record<string, unknown>
    expect(json.object).toBe('chat.completion')
    const choices = json.choices as Array<{ message: { content: string } }>
    expect(choices[0]?.message.content).toBe('Hello World')
    expect(json.usage).toMatchObject({ total_tokens: 8 })
  })

  it('多候选 failover:首号网络错 → 次号成功', async () => {
    providerRows = [{ providerCode: 'trae', configId: 7 }]
    accountRows = [accountRow('acct-bad'), accountRow('acct-good')]
    registerRelayAdapter(fakeAdapter({ providerCode: 'trae' }))
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(
        new Response('data: {"choices":[{"delta":{"content":"OK"}}]}\n\ndata: [DONE]\n\n', {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      )
    vi.stubGlobal('fetch', fetchMock)
    const res = await forwardToAccountPool(baseReq('fail-model-1'), 'fail-model-1')
    expect(res && res.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  // ── 多实例共享态 + failover 全量上下文回放(2026-10-22 改造锁定)──

  it('failover 全量回放(非流式):换号后新号收到完整 messages 数组,不截断', async () => {
    providerRows = [{ providerCode: 'trae', configId: 7 }]
    const rowA = accountRow('acct-rp-a') as { id: string }
    const rowB = accountRow('acct-rp-b') as { id: string }
    accountRows = [rowA, rowB]
    const full = multiTurnMessages()
    const seen: Array<{ rowId: string; messages: Array<{ content?: unknown }> }> = []
    registerRelayAdapter(
      fakeAdapter({
        providerCode: 'trae',
        buildChatRequest: (ctx: AdapterAccountContext, norm) => {
          seen.push({ rowId: ctx.row.id, messages: norm.messages })
          return { url: 'https://upstream.test/v', method: 'POST', headers: {}, body: {} }
        },
      }),
    )
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response('unauthorized', { status: 401 }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id: 'cm-rp', object: 'chat.completion', choices: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
    )
    const req = { ...baseReq('replay-model-1'), stream: false, messages: full }
    const res = await forwardToAccountPool(req, 'replay-model-1')
    expect(res && res.ok).toBe(true)
    // 首号 401(无 refreshToken 不自愈)→ 次号成功:两次尝试都拿到全量上下文
    expect(seen.length).toBe(2)
    expect(seen[0]?.rowId).toBe(rowA.id)
    expect(seen[1]?.rowId).toBe(rowB.id)
    for (const s of seen) {
      expect(s.messages.length).toBe(full.length)
      expect(s.messages.map((m) => m.content)).toEqual(full.map((m) => m.content))
    }
  })

  it('401 自愈全量回放:刷新后同号重试仍带完整 messages', async () => {
    providerRows = [{ providerCode: 'trae', configId: 7 }]
    accountRows = [accountRow('acct-rp401', { refreshTokenEnc: 'enc:rt-9' })]
    const full = multiTurnMessages()
    const seen: Array<Array<{ content?: unknown }>> = []
    registerRelayAdapter(
      fakeAdapter({
        providerCode: 'trae',
        refreshToken: vi.fn(async () => ({ token: 'jwt-fresh', expiresAt: FUTURE })),
        buildChatRequest: (_c: AdapterAccountContext, norm) => {
          seen.push(norm.messages)
          return { url: 'https://upstream.test/v', method: 'POST', headers: {}, body: {} }
        },
      }),
    )
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response('unauthorized', { status: 401 }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id: 'cm-rp2', object: 'chat.completion', choices: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
    )
    const req = { ...baseReq('replay401-model-1'), stream: false, messages: full }
    const res = await forwardToAccountPool(req, 'replay401-model-1')
    expect(res && res.ok).toBe(true)
    expect(seen.length).toBe(2)
    for (const msgs of seen) {
      expect(msgs.length).toBe(full.length)
      expect(msgs.map((m) => m.content)).toEqual(full.map((m) => m.content))
    }
  })

  it('failover 全量回放(流式):新号 SSE 从头开始不断流,首号零字节泄漏', async () => {
    providerRows = [{ providerCode: 'trae', configId: 7 }]
    const rowA = accountRow('acct-sse-a') as { id: string }
    const rowB = accountRow('acct-sse-b') as { id: string }
    accountRows = [rowA, rowB]
    const full = multiTurnMessages()
    const seen: Array<{ rowId: string; n: number }> = []
    registerRelayAdapter(
      fakeAdapter({
        providerCode: 'trae',
        buildChatRequest: (ctx: AdapterAccountContext, norm) => {
          seen.push({ rowId: ctx.row.id, n: norm.messages.length })
          return { url: 'https://upstream.test/v', method: 'POST', headers: {}, body: {} }
        },
      }),
    )
    const sse =
      'data: {"choices":[{"delta":{"content":"AAA"}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"BBB"},"finish_reason":"stop"}]}\n\n' +
      'data: [DONE]\n\n'
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValueOnce(
          new Response(sse, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
        ),
    )
    const req = { ...baseReq('sse-replay-model-1'), stream: true, messages: full }
    const res = await forwardToAccountPool(req, 'sse-replay-model-1')
    expect(res && res.ok).toBe(true)
    if (!res || !res.ok) return
    expect(res.response.headers.get('content-type')).toContain('text/event-stream')
    const text = await res.response.text()
    // 重放从头开始:首 chunk 在最前,完整到 [DONE],没有失败号的残留
    expect(text.indexOf('"content":"AAA"')).toBeGreaterThanOrEqual(0)
    expect(text.indexOf('"content":"AAA"')).toBeLessThan(text.indexOf('"content":"BBB"'))
    expect(text.trimEnd().endsWith('data: [DONE]')).toBe(true)
    expect(seen).toEqual([
      { rowId: rowA.id, n: full.length },
      { rowId: rowB.id, n: full.length },
    ])
  })

  it('冷却跨实例共享(内存兜底档):连续 3 败后该号被跳过,单号池直接判空', async () => {
    providerRows = [{ providerCode: 'trae', configId: 7 }]
    const row = accountRow('acct-cool') as { id: string }
    accountRows = [row]
    registerRelayAdapter(fakeAdapter({ providerCode: 'trae' }))
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNRESET')
      }),
    )
    const req = { ...baseReq('cool-model-1'), stream: false }
    for (let i = 0; i < 3; i++) {
      const r = await forwardToAccountPool(req, 'cool-model-1')
      expect(r && r.ok).toBe(false)
    }
    // 第 3 败触发 60s 冷却,写入 shared-state(内存兜底档)
    expect((await getAccountsInCooldown([row.id])).has(row.id)).toBe(true)
    // 唯一候选在冷却 ⇒ 无候选 ⇒ null(调用方回退 ai-service),不再打该号
    expect(await forwardToAccountPool(req, 'cool-model-1')).toBeNull()
    // 解除冷却后恢复可选
    await clearAccountCooldown(row.id)
    const r5 = await forwardToAccountPool(req, 'cool-model-1')
    expect(r5 && r5.ok).toBe(false) // 又打了一次(失败),但确实被选中
  })

  it('风控命中(4015)→ 30 分钟冷却且不重放:单号池第二次直接无候选', async () => {
    providerRows = [{ providerCode: 'trae', configId: 7 }]
    const row = accountRow('acct-risk') as { id: string }
    accountRows = [row]
    registerRelayAdapter(
      fakeAdapter({
        providerCode: 'trae',
        classifyUpstreamFailure: (status, bodyText) => ({
          kind: classifyTraeFailure(status, bodyText),
        }),
      }),
    )
    const fetchMock = vi.fn(
      async () => new Response('{"code":4015,"message":"account risk"}', { status: 400 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const req = { ...baseReq('risk-model-1'), stream: false }
    const res = await forwardToAccountPool(req, 'risk-model-1')
    expect(res && res.ok).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1) // 风控不重放
    expect((await getAccountsInCooldown([row.id])).has(row.id)).toBe(true)
    // 冷却期内的请求不再打上游(无候选 → null 回退 ai-service)
    expect(await forwardToAccountPool(req, 'risk-model-1')).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    // 健康度降级写库,admin 面板可见
    expect(updateCalls.some((s) => s.healthStatus === 'degraded')).toBe(true)
    await clearAccountCooldown(row.id)
  })

  it('executeChat 抛错带 upstreamCode=4015 → 归 risk(不是 network),同样冷却', async () => {
    providerRows = [{ providerCode: 'trae', configId: 7 }]
    const row = accountRow('acct-risk-code') as { id: string }
    accountRows = [row]
    registerRelayAdapter(
      fakeAdapter({
        providerCode: 'trae',
        classifyUpstreamFailure: (status, bodyText) => ({
          kind: classifyTraeFailure(status, bodyText),
        }),
        buildChatRequest: () => {
          throw new Error('不应走通用路径')
        },
        async executeChat() {
          throw Object.assign(new Error('上游风控'), { upstreamCode: 4015 })
        },
      }),
    )
    const res = await forwardToAccountPool(baseReq('risk-code-model-1'), 'risk-code-model-1')
    expect(res && res.ok).toBe(false)
    expect((await getAccountsInCooldown([row.id])).has(row.id)).toBe(true)
    await clearAccountCooldown(row.id)
  })

  it('账号级并发闸:单号在途 ≤3,第 4 个并发请求直接失败且不打上游', async () => {
    providerRows = [{ providerCode: 'trae', configId: 7 }]
    accountRows = [accountRow('acct-conc')]
    registerRelayAdapter(fakeAdapter({ providerCode: 'trae' }))
    const pending: Array<(r: Response) => void> = []
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => pending.push(resolve)))
    vi.stubGlobal('fetch', fetchMock)
    const req = { ...baseReq('conc-model-1'), stream: false }
    const ps = [0, 1, 2, 3].map(() => forwardToAccountPool(req, 'conc-model-1'))
    const settled: unknown[] = []
    for (const p of ps) void p.then((r) => settled.push(r))
    // 3 个拿到额度并卡在 fetch;第 4 个被并发闸挡下立即失败
    await vi.waitFor(() => {
      expect(pending.length).toBe(3)
      expect(settled.length).toBe(1)
    })
    const rejected = settled[0] as { ok: boolean; reason?: string }
    expect(rejected.ok).toBe(false)
    expect(rejected.reason).toMatch(/并发已达上限/)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    for (const resolve of pending) {
      resolve(
        new Response(JSON.stringify({ id: 'cm-conc', object: 'chat.completion', choices: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }
    const results = await Promise.all(ps)
    expect(results.filter((r) => r && r.ok).length).toBe(3)
  })

  it('会话亲和跨实例共享(内存兜底档):命中号置顶覆盖排序,成功后回写', async () => {
    providerRows = [{ providerCode: 'trae', configId: 7 }]
    const rowA = accountRow('acct-aff-a') as { id: string }
    const rowB = accountRow('acct-aff-b') as { id: string }
    accountRows = [rowA, rowB]
    await setSessionAffinity(`key-1|affinity-model-1`, rowB.id, 60_000)
    const usedRows: string[] = []
    registerRelayAdapter(
      fakeAdapter({
        providerCode: 'trae',
        buildChatRequest: (ctx: AdapterAccountContext) => {
          usedRows.push(ctx.row.id)
          return { url: 'https://upstream.test/v', method: 'POST', headers: {}, body: {} }
        },
      }),
    )
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ id: 'cm-aff', object: 'chat.completion', choices: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    )
    const req = { ...baseReq('affinity-model-1'), stream: false }
    const res = await forwardToAccountPool(req, 'affinity-model-1')
    expect(res && res.ok).toBe(true)
    // 亲和命中(B)压过默认排序(A 在前)
    expect(usedRows[0]).toBe(rowB.id)
    // 成功回写:亲和续期仍指向 B
    expect(await getSessionAffinity(`key-1|affinity-model-1`)).toBe(rowB.id)
  })

  // ── 用量台账 / 模型别名 / 代理池 整合面(2026-10-22 主会话接线) ──

  it('SSE 流含 usage 帧 → tap 提取并记台账(ok:true,tokens 取末帧)', async () => {
    providerRows = [{ providerCode: 'trae', configId: 7 }]
    accountRows = [accountRow('acct-usage-sse')]
    registerRelayAdapter(fakeAdapter({ providerCode: 'trae' }))
    const sse =
      'data: {"choices":[{"delta":{"content":"AAA"}}]}\n\n' +
      'data: {"choices":[],"usage":{"prompt_tokens":11,"completion_tokens":7}}\n\n' +
      'data: [DONE]\n\n'
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(sse, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
      ),
    )
    const res = await forwardToAccountPool(baseReq('usage-sse-model-1'), 'usage-sse-model-1')
    expect(res && res.ok).toBe(true)
    if (!res || !res.ok) return
    const text = await res.response.text()
    expect(text).toContain('"content":"AAA"')
    await vi.waitFor(() =>
      expect(mockRecordAccountUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          providerCode: 'trae',
          model: 'usage-sse-model-1',
          promptTokens: 11,
          completionTokens: 7,
          ok: true,
        }),
      ),
    )
  })

  it('非流式 JSON 含 usage → 记台账;无 usage 记 0/0 且响应原样透传', async () => {
    providerRows = [{ providerCode: 'trae', configId: 7 }]
    accountRows = [accountRow('acct-usage-json')]
    registerRelayAdapter(fakeAdapter({ providerCode: 'trae' }))
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              id: 'cm-u1',
              object: 'chat.completion',
              choices: [],
              usage: { prompt_tokens: 3, completion_tokens: 2 },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    )
    const req = { ...baseReq('usage-json-model-1'), stream: false }
    const res = await forwardToAccountPool(req, 'usage-json-model-1')
    expect(res && res.ok).toBe(true)
    if (!res || !res.ok) return
    const body = await res.response.json()
    expect(body.id).toBe('cm-u1') // clone 读取不影响主路径透传
    await vi.waitFor(() =>
      expect(mockRecordAccountUsage).toHaveBeenCalledWith(
        expect.objectContaining({ promptTokens: 3, completionTokens: 2, ok: true }),
      ),
    )
  })

  it('候选全失败 → 每号记一条 ok:false 台账(客户端断开除外)', async () => {
    providerRows = [{ providerCode: 'trae', configId: 7 }]
    const row = accountRow('acct-usage-fail') as { id: string }
    accountRows = [row]
    registerRelayAdapter(fakeAdapter({ providerCode: 'trae' }))
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('boom', { status: 500 })),
    )
    const req = { ...baseReq('usage-fail-model-1'), stream: false }
    const res = await forwardToAccountPool(req, 'usage-fail-model-1')
    expect(res && res.ok).toBe(false)
    expect(mockRecordAccountUsage).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: row.id, ok: false }),
    )
  })

  it('模型别名映射命中 → 上游请求用 upstreamModel(对外语义不变)', async () => {
    providerRows = [{ providerCode: 'trae', configId: 7 }]
    accountRows = [accountRow('acct-alias')]
    mockResolveAlias.mockResolvedValue({ upstreamModel: 'kimi-k2-upstream', displayName: 'K' })
    let seenModel = ''
    registerRelayAdapter(
      fakeAdapter({
        providerCode: 'trae',
        buildChatRequest: (_ctx: AdapterAccountContext, norm) => {
          seenModel = norm.model
          return { url: 'https://upstream.test/v', method: 'POST', headers: {}, body: {} }
        },
      }),
    )
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ id: 'cm-a1', choices: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    )
    const req = { ...baseReq('alias-model-1'), stream: false }
    const res = await forwardToAccountPool(req, 'alias-model-1')
    expect(res && res.ok).toBe(true)
    expect(seenModel).toBe('kimi-k2-upstream')
    expect(mockResolveAlias).toHaveBeenCalledWith('trae', 'alias-model-1')
  })

  it('代理池命中 → undici 带 dispatcher 请求 + 成功上报;网络失败上报 failure', async () => {
    providerRows = [{ providerCode: 'trae', configId: 7 }]
    accountRows = [accountRow('acct-proxy-pool')]
    mockPickProxy.mockResolvedValue('http://proxy.test:8080')
    registerRelayAdapter(fakeAdapter({ providerCode: 'trae' }))
    mockUndiciFetch.mockResolvedValue(
      new Response('data: [DONE]\n\n', {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    )
    const res = await forwardToAccountPool(baseReq('proxy-model-1'), 'proxy-model-1')
    expect(res && res.ok).toBe(true)
    expect(mockPickProxy).toHaveBeenCalledWith({
      id: (accountRows[0] as { id: string }).id,
      proxyUrl: null,
    })
    expect(mockUndiciFetch).toHaveBeenCalled()
    const init = mockUndiciFetch.mock.calls[0][1] as Record<string, unknown>
    expect(init.dispatcher).toBeDefined() // 走代理 dispatcher 而非直连
    await vi.waitFor(() =>
      expect(mockReportProxySuccess).toHaveBeenCalledWith('http://proxy.test:8080'),
    )

    // 网络失败 → reportProxyFailure(代理级),server 类失败同样计代理
    mockUndiciFetch.mockRejectedValue(new Error('proxy down'))
    const row2 = accountRow('acct-proxy-pool-2') as { id: string }
    accountRows = [row2]
    const req2 = { ...baseReq('proxy-model-2'), stream: false }
    const res2 = await forwardToAccountPool(req2, 'proxy-model-2')
    expect(res2 && res2.ok).toBe(false)
    await vi.waitFor(() =>
      expect(mockReportProxyFailure).toHaveBeenCalledWith('http://proxy.test:8080'),
    )
  })

  // ── 审计修复回归(2026-10-22 P0/P1)──

  it('response_format / seed 透传到账号池归一请求(JSON mode 不再丢失)', async () => {
    providerRows = [{ providerCode: 'trae', configId: 7 }]
    accountRows = [accountRow('acct-json-mode')]
    let seen: { responseFormat?: unknown; seed?: number } = {}
    registerRelayAdapter(
      fakeAdapter({
        providerCode: 'trae',
        buildChatRequest: (_ctx: AdapterAccountContext, norm) => {
          seen = { responseFormat: norm.responseFormat, seed: norm.seed }
          return { url: 'https://upstream.test/v', method: 'POST', headers: {}, body: {} }
        },
      }),
    )
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ id: 'cm-jm', choices: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    )
    const req = {
      ...baseReq('json-mode-model-1'),
      stream: false,
      responseFormat: { type: 'json_object' },
      seed: 42,
    }
    const res = await forwardToAccountPool(req, 'json-mode-model-1')
    expect(res && res.ok).toBe(true)
    expect(seen.responseFormat).toEqual({ type: 'json_object' })
    expect(seen.seed).toBe(42)
  })

  it('上游 400 归 request 级:不罚号、不冷却', async () => {
    providerRows = [{ providerCode: 'trae', configId: 7 }]
    const row = accountRow('acct-400') as { id: string }
    accountRows = [row]
    registerRelayAdapter(fakeAdapter({ providerCode: 'trae' }))
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"error":"invalid messages"}', { status: 400 })),
    )
    const req = { ...baseReq('bad-param-model-1'), stream: false }
    const res = await forwardToAccountPool(req, 'bad-param-model-1')
    expect(res && res.ok).toBe(false)
    expect((await getAccountsInCooldown([row.id])).has(row.id)).toBe(false)
    expect(updateCalls.some((s) => 'consecutiveFailures' in s)).toBe(false)
  })

  it('SSE 内容含 "[DONE]" 字样不会截断流', async () => {
    providerRows = [{ providerCode: 'trae', configId: 7 }]
    accountRows = [accountRow('acct-done-word')]
    registerRelayAdapter(fakeAdapter({ providerCode: 'trae' }))
    const sse =
      'data: {"choices":[{"delta":{"content":"a [DONE] b"}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"TAIL"}}]}\n\n' +
      'data: [DONE]\n\n'
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(sse, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
      ),
    )
    const res = await forwardToAccountPool(baseReq('done-word-model-1'), 'done-word-model-1')
    expect(res && res.ok).toBe(true)
    if (!res || !res.ok) return
    const text = await res.response.text()
    expect(text).toContain('a [DONE] b')
    expect(text).toContain('TAIL')
  })

  it('2xx 但响应不可解析 → 按 server 罚号并记失败台账', async () => {
    providerRows = [{ providerCode: 'trae', configId: 7 }]
    accountRows = [accountRow('acct-bad-json')]
    registerRelayAdapter(fakeAdapter({ providerCode: 'trae' }))
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('not-json', {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    )
    const req = { ...baseReq('bad-json-model-1'), stream: false }
    const res = await forwardToAccountPool(req, 'bad-json-model-1')
    expect(res && res.ok).toBe(false)
    await vi.waitFor(() => expect(updateCalls.some((s) => 'consecutiveFailures' in s)).toBe(true))
    expect(mockRecordAccountUsage).toHaveBeenCalledWith(
      expect.objectContaining({ ok: false, promptTokens: 0, completionTokens: 0 }),
    )
  })

  it('并发 401 只触发一次 refresh(single-flight,防 refresh token 互相覆盖)', async () => {
    providerRows = [{ providerCode: 'trae', configId: 7 }]
    const row = accountRow('acct-sf') as { id: string }
    accountRows = [row]
    let resolveRefresh: ((v: { token: string; expiresAt: Date }) => void) | null = null
    const refreshToken = vi.fn(
      () =>
        new Promise<{ token: string; expiresAt: Date }>((resolve) => {
          resolveRefresh = resolve
        }),
    )
    registerRelayAdapter(
      fakeAdapter({
        providerCode: 'trae',
        refreshToken,
        buildChatRequest: () => ({
          url: 'https://upstream.test/v',
          method: 'POST',
          headers: {},
          body: { x: 1 },
        }),
      }),
    )
    // 两道 401 闸门同时放行,确保两个请求同 tick 进入刷新竞争(结果确定,不靠时序运气)
    let gated = true
    const pending: Array<() => void> = []
    const fetchMock = vi.fn(() => {
      if (!gated) return Promise.resolve(new Response('unauthorized', { status: 401 }))
      return new Promise<Response>((resolve) => {
        pending.push(() => resolve(new Response('unauthorized', { status: 401 })))
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    const reqA = { ...baseReq('sf-model-1'), userId: 'user-a', stream: false }
    const reqB = { ...baseReq('sf-model-1'), userId: 'user-b', stream: false }
    const p1 = forwardToAccountPool(reqA, 'sf-model-1')
    const p2 = forwardToAccountPool(reqB, 'sf-model-1')
    await vi.waitFor(() => expect(pending.length).toBe(2))
    gated = false
    for (const release of pending) release()
    await vi.waitFor(() => expect(refreshToken).toHaveBeenCalled())
    expect(resolveRefresh).not.toBeNull()
    resolveRefresh!({ token: 'jwt-new', expiresAt: FUTURE })
    const [r1, r2] = await Promise.all([p1, p2])
    expect(refreshToken).toHaveBeenCalledTimes(1)
    expect(r1 && r1.ok).toBe(false)
    expect(r2 && r2.ok).toBe(false)
  })
})

describe('mergeToolCallDelta', () => {
  it('后续分片的空 id/name 不得覆盖首次非空值;arguments 逐片拼接', () => {
    const slot = { args: '' }
    F.mergeToolCallDelta(slot, {
      index: 0,
      id: 'call_1',
      type: 'function',
      function: { name: 'get_time', arguments: '' },
    })
    F.mergeToolCallDelta(slot, { index: 0, id: '', function: { name: '', arguments: '{}' } })
    expect(slot.name).toBe('get_time')
    expect(slot.id).toBe('call_1')
    expect(slot.args).toBe('{}')
  })
})

// =============================================================================
// O93 号池选号策略接线(六能力 × 正/反成对;判据单源 = relay-pool-policy __test__)
// 夹具策略一律从 DEFAULT_RELAY_POOL_POLICY 展开再改钮,不在测试里抄第二份默认值
// =============================================================================

/** 种子随机源(耗尽后恒 0):weighted_random 复现性靠注入,不碰 Math.random */
function seqRng(values: number[]): () => number {
  let i = 0
  return () => {
    const v = i < values.length ? values[i] : 0
    i += 1
    return v ?? 0
  }
}

describe('O93 选号策略(selectAccountCandidates 接线)', () => {
  it('② 闲置加权:从未用过的低权号压过刚用过的高权号;perHour=0 摘掉即还原 weight desc', async () => {
    const freshHigh = accountRow('sel-fresh-high', { weight: 5, lastUsedAt: new Date() })
    const idleLow = accountRow('sel-idle-low', { weight: 1 })
    accountRows = [freshHigh, idleLow]
    const base = { ...POLICY.DEFAULT_RELAY_POOL_POLICY }
    const on = await F.selectAccountCandidates(baseReq('sel-idle-on'), 'sel-idle-on', ['trae'], {
      policy: base,
    })
    expect((on.rows[0] as { id: string }).id).toBe((idleLow as { id: string }).id)
    const off = await F.selectAccountCandidates(baseReq('sel-idle-off'), 'sel-idle-off', ['trae'], {
      policy: { ...base, idleWeightPerHour: 0 },
    })
    expect((off.rows[0] as { id: string }).id).toBe((freshHigh as { id: string }).id)
  })

  it('③ 临期优先:flag 开 ⇒ 窗口内将到期的低权号排前;flag 关 ⇒ 高权号在前', async () => {
    const soon = accountRow('sel-exp-soon', {
      weight: 1,
      tokenExpiresAt: new Date(Date.now() + 3_600_000),
    })
    const later = accountRow('sel-exp-later', {
      weight: 9,
      tokenExpiresAt: new Date(Date.now() + 720 * 3_600_000),
    })
    accountRows = [later, soon]
    const base = { ...POLICY.DEFAULT_RELAY_POOL_POLICY }
    const on = await F.selectAccountCandidates(baseReq('sel-exp-on'), 'sel-exp-on', ['trae'], {
      policy: { ...base, preferExpiring: true },
    })
    expect((on.rows[0] as { id: string }).id).toBe((soon as { id: string }).id)
    const off = await F.selectAccountCandidates(baseReq('sel-exp-off'), 'sel-exp-off', ['trae'], {
      policy: base,
    })
    expect((off.rows[0] as { id: string }).id).toBe((later as { id: string }).id)
  })

  it('① weighted_random:种子 rng 决定首抽(0.9×总权落在低权区间 ⇒ 低权先);deterministic 档不消费 rng', async () => {
    const heavy = accountRow('sel-w-heavy', { weight: 3 })
    const light = accountRow('sel-w-light', { weight: 1 })
    accountRows = [heavy, light]
    const base = { ...POLICY.DEFAULT_RELAY_POOL_POLICY }
    // 有效权 = 3+5 与 1+5(两号均未用过 ⇒ 同触顶加分);总 14
    const rand = await F.selectAccountCandidates(baseReq('sel-w-rand'), 'sel-w-rand', ['trae'], {
      policy: { ...base, strategy: 'weighted_random' as const },
      rng: seqRng([0.9]),
    })
    expect(rand.rows.map((r: { id: string }) => r.id)).toEqual([
      (light as { id: string }).id,
      (heavy as { id: string }).id,
    ])
    const det = await F.selectAccountCandidates(baseReq('sel-w-det'), 'sel-w-det', ['trae'], {
      policy: base,
      rng: seqRng([0.9]),
    })
    expect(det.rows.map((r: { id: string }) => r.id)).toEqual([
      (heavy as { id: string }).id,
      (light as { id: string }).id,
    ])
  })

  it('④ 积分地板:低分号被滤;全池低于地板 ⇒ 永不排空 ⇒ 回落全池 + credit_floor_fallback 标签', async () => {
    const low = accountRow('sel-cf-low', { extraMetadata: { creditRemaining: 1 } })
    const high = accountRow('sel-cf-high', { extraMetadata: { creditRemaining: 100 } })
    accountRows = [low, high]
    const base = { ...POLICY.DEFAULT_RELAY_POOL_POLICY }
    const filtered = await F.selectAccountCandidates(
      baseReq('sel-cf-part'),
      'sel-cf-part',
      ['trae'],
      { policy: { ...base, creditFloor: 50 } },
    )
    expect(filtered.rows.map((r: { id: string }) => r.id)).toEqual([(high as { id: string }).id])
    expect(filtered.fallbacks).toEqual([])
    accountRows = [low]
    const emptied = await F.selectAccountCandidates(baseReq('sel-cf-all'), 'sel-cf-all', ['trae'], {
      policy: { ...base, creditFloor: 50 },
    })
    expect(emptied.rows.length).toBe(1)
    expect(emptied.fallbacks).toEqual(['credit_floor_fallback'])
    const paired = await F.selectAccountCandidates(baseReq('sel-cf-off'), 'sel-cf-off', ['trae'], {
      policy: base,
    })
    expect(paired.rows.length).toBe(1)
    expect(paired.fallbacks).toEqual([])
  })

  it('⑥ 跨域互兜:亲和号所在域优先;该域候选全被冷却 ⇒ 回落全域 + cross_domain_fallback;flag 关不滤', async () => {
    const wbGlobal = accountRow('sel-xd-global', {
      providerCode: 'workbuddy',
      extraMetadata: { domain: 'workbuddy.ai' },
    })
    const wbCn = accountRow('sel-xd-cn', {
      providerCode: 'workbuddy',
      extraMetadata: { domain: 'workbuddy.cn' },
    })
    accountRows = [wbGlobal, wbCn]
    const base = { ...POLICY.DEFAULT_RELAY_POOL_POLICY }
    const affModel = 'sel-xd-aff'
    await setSessionAffinity(`key-1|${affModel}`, (wbGlobal as { id: string }).id, 60_000)
    const narrowed = await F.selectAccountCandidates(baseReq(affModel), affModel, ['workbuddy'], {
      policy: { ...base, crossDomainFallback: true },
    })
    expect(narrowed.rows.map((r: { id: string }) => r.id)).toEqual([
      (wbGlobal as { id: string }).id,
    ])
    expect(narrowed.fallbacks).toEqual([])
    // 亲和号进冷却 ⇒ 请求域内零候选 ⇒ 回落全域(永不排空)
    await setAccountCooldown((wbGlobal as { id: string }).id, Date.now() + 60_000)
    const fellBack = await F.selectAccountCandidates(baseReq(affModel), affModel, ['workbuddy'], {
      policy: { ...base, crossDomainFallback: true },
    })
    expect(fellBack.rows.map((r: { id: string }) => r.id)).toEqual([(wbCn as { id: string }).id])
    expect(fellBack.fallbacks).toEqual(['cross_domain_fallback'])
    // 反向:flag 关 ⇒ 不做域过滤、也不打标签
    const off = await F.selectAccountCandidates(baseReq(affModel), affModel, ['workbuddy'], {
      policy: base,
    })
    expect(off.rows.map((r: { id: string }) => r.id)).toEqual([(wbCn as { id: string }).id])
    expect(off.fallbacks).toEqual([])
  })
})

describe('O93 全局在途并发闸(maxInFlightGlobal)', () => {
  it('闸本体:占满即回绝、归还即可再占、release 幂等(内存兜底档)', async () => {
    expect(sharedState.backend()).toBe('memory')
    const h = await tryAcquireGlobalInflight(1)
    expect(h && h.backend).toBe('memory')
    expect(sharedState.globalInflightMemory()).toBe(1)
    expect(await tryAcquireGlobalInflight(1)).toBeNull()
    if (h) {
      await h.release()
      await h.release() // 幂等:不得多减(否则会虚假放大额度)
    }
    expect(sharedState.globalInflightMemory()).toBe(0)
    const again = await tryAcquireGlobalInflight(1)
    expect(again).not.toBeNull()
    if (again) await again.release()
    expect(sharedState.globalInflightMemory()).toBe(0)
  })

  it('正向(满坑被跳过)与反向(放坑即成功):env=1 的转发请求在坑位被占时以带标签失败回绝', async () => {
    providerRows = [{ providerCode: 'trae', configId: 7 }]
    accountRows = [accountRow('acct-global-gate')]
    registerRelayAdapter(fakeAdapter({ providerCode: 'trae' }))
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ id: 'cm-g', object: 'chat.completion', choices: [] }, { status: 200 }),
      ),
    )
    vi.stubEnv('IHUI_RELAY_POOL_MAX_IN_FLIGHT_GLOBAL', '1')
    try {
      const held = await tryAcquireGlobalInflight(1)
      expect(held).not.toBeNull()
      const req = { ...baseReq('global-gate-model-1'), stream: false }
      const blocked = await forwardToAccountPool(req, 'global-gate-model-1')
      expect(blocked && !blocked.ok).toBe(true)
      if (blocked && !blocked.ok) expect(blocked.reason).toContain('全局并发已达上限')
      if (held) await held.release()
      const passed = await forwardToAccountPool(req, 'global-gate-model-1')
      expect(passed && passed.ok).toBe(true)
      await vi.waitFor(() => expect(sharedState.globalInflightMemory()).toBe(0))
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
