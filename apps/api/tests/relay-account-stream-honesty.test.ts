// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * relay-account-forwarder 的两处诚实性回归(2026-10-26 立,承只读审计取证):
 *
 * ① 流式断流曾被记成成功 —— 旧口径在「刚拿到响应头」就 recordSuccess(清失败计数 +
 *    healthStatus=healthy),而用量 tap 无论流是否半路中断都回调 ok:true。
 *    本文件把「拿到响应头 ≠ 成功」钉成断言:头到的一刻不得有 healthy 写入、不得有用量台账;
 *    error/半包 ⇒ ledger ok:false + 失败计数累加 + relay_stream_interrupt_total 递增;
 *    正常收尾 ⇒ 才回血。断流还多一条下限:坐实不了「票死了」(文案级 auth/session_dead 降 network)。
 * ② 429 退避曾只认自家常量 —— 本文件既测纯判据(extractUpstreamBackoffMs 的四形态),
 *    也测落账口径(setAccountCooldown 的实际时长 = max(常量, 上游秒数),封顶后不读成 0)。
 *
 * 零真实网络/数据库:与 tests/relay-account-forwarder.test.ts 同范式(drizzle 链式 mock +
 * fetch 打桩 + 假适配器)。shared-state 保留真实现,只在 setAccountCooldown 接一枚观测探针,
 * 因为「冷却了多久」正是这次要判的东西,只测文案等于没测。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type * as RelayAccountSharedState from '../src/services/relay-account-shared-state.js'

// ── db mock:select 按查询特征供行,update 记录 set 参数 ──
let providerRows: unknown[] = []
let accountRows: unknown[] = []
const updateCalls: Array<Record<string, unknown>> = []

vi.mock('../src/db/index.js', () => {
  const withSettlers = (step: Record<string, unknown>, resolver: () => unknown[]) => {
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(resolver()).then(resolve, reject)
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
    db: { select: chainSelect, update: chainWrite, insert: chainWrite, delete: chainWrite },
    dbRead: { select: chainSelect },
  }
})

vi.mock('../src/utils/crypto.js', () => ({
  encryptField: (v: string) => `enc:${v}`,
  decryptField: (v: string) => (v.startsWith('enc:') ? v.slice(4) : v),
}))

// shared-state 强制「内存兜底」档(REDIS_URL 指死端口,绝不碰并行套件的真 Redis)
vi.mock('../src/config/index.js', () => ({
  config: { REDIS_URL: 'redis://127.0.0.1:1/0' },
}))

const mockRecordAccountUsage = vi.fn(async (_input: unknown) => {})
vi.mock('../src/services/relay-account-usage.js', () => ({
  recordAccountUsage: (input: unknown) => mockRecordAccountUsage(input),
}))
vi.mock('../src/services/relay-proxy-pool.js', () => ({
  pickProxyForAccount: async () => null,
  reportProxyFailure: async () => {},
  reportProxySuccess: async () => {},
}))
vi.mock('../src/services/relay-model-catalog.js', () => ({
  resolveModelAlias: async () => null,
}))

/** 冷却落账探针:记「谁、冷却到几毫秒、写入时刻」,据此量真实退避时长 */
const cooldownWrites: Array<{ id: string; untilMs: number; atMs: number }> = []
vi.mock('../src/services/relay-account-shared-state.js', async (importOriginal) => {
  const actual = await importOriginal<typeof RelayAccountSharedState>()
  return {
    ...actual,
    setAccountCooldown: async (id: string, untilMs: number) => {
      cooldownWrites.push({ id, untilMs, atMs: Date.now() })
      await actual.setAccountCooldown(id, untilMs)
    },
  }
})

import {
  forwardToAccountPool,
  getStreamInterruptCounts,
  __test__ as F,
} from '../src/services/relay-account-forwarder.js'
import { registerRelayAdapter } from '../src/services/relay-upstream-adapters.js'
import type { RelayUpstreamAdapter } from '../src/services/relay-upstream-adapters.js'
import {
  __test__ as sharedState,
  clearAccountCooldown,
} from '../src/services/relay-account-shared-state.js'

const FUTURE = new Date(Date.now() + 7 * 24 * 3600_000)
const PROVIDER = 'trae'

// 每次调用生成唯一 id:隔离进程级熔断计数与亲和缓存(与既有套件同法)
let rowSeq = 0
function accountRow(
  label: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const id = `${label}-${++rowSeq}`
  return {
    id,
    providerCode: PROVIDER,
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

/** 最小假适配器:上游 SSE 帧原样解成 openaiChunk(与既有套件同法) */
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
    translateStreamChunk: (_c, raw) => {
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

/**
 * 可控上游流:测试自己决定「推几帧 / 半路炸 / 关流」,
 * 于是「响应头已到但流未收尾」这一格能被单独断言(不靠时序运气)。
 */
function sseFixture() {
  const encoder = new TextEncoder()
  let ctrl: ReadableStreamDefaultController<Uint8Array> | null = null
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      ctrl = c
    },
  })
  return {
    body,
    push(text: string): void {
      ctrl?.enqueue(encoder.encode(text))
    },
    fail(err: Error): void {
      ctrl?.error(err)
    },
    end(): void {
      ctrl?.close()
    },
  }
}

function sseResponse(
  body: ReadableStream<Uint8Array>,
  headers: Record<string, string> = {},
): Response {
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream', ...headers },
  })
}

const CHUNK_A = 'data: {"choices":[{"delta":{"content":"AAA"}}]}\n\n'
const CHUNK_FINAL = 'data: {"choices":[{"delta":{"content":"BBB"},"finish_reason":"stop"}]}\n\n'
const DONE = 'data: [DONE]\n\n'

function healthWritten(): boolean {
  return updateCalls.some((s) => s.healthStatus === 'healthy')
}
/**
 * 失败落账的判别子:必须用 lastErrorMessage(失败写字符串、成功写 null)。
 * 不要用 `'consecutiveFailures' in s` —— recordSuccess 也写这一列(清零),
 * 那个形态会把「成功回血」读成「失败累加」,正反两侧就分不出来了。
 */
function failureWritten(): boolean {
  return updateCalls.some((s) => typeof s['lastErrorMessage'] === 'string')
}
function interruptTotal(): number {
  return getStreamInterruptCounts()[PROVIDER] ?? 0
}

beforeEach(async () => {
  providerRows = [{ providerCode: PROVIDER, configId: 7 }]
  accountRows = []
  updateCalls.length = 0
  cooldownWrites.length = 0
  vi.unstubAllGlobals()
  await sharedState.reset()
  mockRecordAccountUsage.mockReset().mockResolvedValue(undefined)
})

describe('流式记账诚实性:拿到响应头 ≠ 成功', () => {
  it('头已到而流未收尾:当场不得记 healthy、不得记用量', async () => {
    const row = accountRow('acct-hdr-only') as { id: string }
    accountRows = [row]
    registerRelayAdapter(fakeAdapter({ providerCode: PROVIDER }))
    const fx = sseFixture()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => sseResponse(fx.body)),
    )

    const model = 'hdr-only-model-1'
    const res = await forwardToAccountPool(baseReq(model), model)
    expect(res && res.ok).toBe(true) // 对客户端仍是成功交付(线行为不变)
    fx.push(CHUNK_A)
    await new Promise((r) => setImmediate(r))

    // 审计缺陷 1 的正身:改造前这一格已经写了 healthy + ok:true 台账
    expect(healthWritten()).toBe(false)
    expect(failureWritten()).toBe(false)
    expect(mockRecordAccountUsage).not.toHaveBeenCalled()
    expect(interruptTotal()).toBe(0)

    // 同一格补正向对照:收尾帧一到,成功账才落(判据翻转的凭据)
    fx.push(CHUNK_FINAL)
    fx.push(DONE)
    fx.end()
    await vi.waitFor(() => expect(healthWritten()).toBe(true))
    await vi.waitFor(() =>
      expect(mockRecordAccountUsage).toHaveBeenCalledWith(
        expect.objectContaining({ accountId: row.id, ok: true }),
      ),
    )
  })

  it('流中途抛错 ⇒ ledger ok:false + 失败计数累加 + 不写 healthy + 断流计数递增', async () => {
    const row = accountRow('acct-miderr') as { id: string }
    accountRows = [row]
    registerRelayAdapter(fakeAdapter({ providerCode: PROVIDER }))
    const fx = sseFixture()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => sseResponse(fx.body)),
    )
    const before = interruptTotal()

    const model = 'miderr-model-1'
    const res = await forwardToAccountPool(baseReq(model), model)
    expect(res && res.ok).toBe(true)
    fx.push(CHUNK_A)
    await new Promise((r) => setImmediate(r))
    fx.fail(new Error('upstream socket hang up'))

    await vi.waitFor(() =>
      expect(mockRecordAccountUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: row.id,
          providerCode: PROVIDER,
          model,
          ok: false,
          promptTokens: 0,
          completionTokens: 0,
        }),
      ),
    )
    expect(failureWritten()).toBe(true)
    expect(healthWritten()).toBe(false)
    expect(interruptTotal() - before).toBe(1)
    // lastErrorMessage 必须能归因(不是静默吞掉的「没判」)
    const failure = updateCalls.find((s) => typeof s['lastErrorMessage'] === 'string')
    expect(String(failure?.['lastErrorMessage'] ?? '')).toContain('上游流中断')
  })

  it('半包(上游没给 [DONE]/finish_reason 就关流)⇒ 判失败;客户端仍见完整 [DONE](线行为不变)', async () => {
    const row = accountRow('acct-halfpack') as { id: string }
    accountRows = [row]
    registerRelayAdapter(fakeAdapter({ providerCode: PROVIDER }))
    const fx = sseFixture()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => sseResponse(fx.body)),
    )
    const before = interruptTotal()

    const model = 'halfpack-model-1'
    const res = await forwardToAccountPool(baseReq(model), model)
    expect(res && res.ok).toBe(true)
    fx.push(CHUNK_A) // 只有正文帧,没有收尾帧
    fx.end()

    await vi.waitFor(() =>
      expect(mockRecordAccountUsage).toHaveBeenCalledWith(
        expect.objectContaining({ accountId: row.id, ok: false }),
      ),
    )
    expect(healthWritten()).toBe(false)
    expect(failureWritten()).toBe(true)
    expect(interruptTotal() - before).toBe(1)
    if (!res || !res.ok) throw new Error('前置:转发应交付')
    const text = await res.response.text()
    expect(text).toContain('"content":"AAA"')
    // 本任务只改记账口径,不改协议输出:截断仍补 [DONE](端上不得收到半截 SSE)
    expect(text.trimEnd().endsWith('data: [DONE]')).toBe(true)
  })

  it('正常收尾(finish_reason + [DONE])⇒ 才记成功:healthy + ok:true 台账,断流计数不涨', async () => {
    const row = accountRow('acct-clean') as { id: string }
    accountRows = [row]
    registerRelayAdapter(fakeAdapter({ providerCode: PROVIDER }))
    const fx = sseFixture()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => sseResponse(fx.body)),
    )
    const before = interruptTotal()

    const model = 'clean-model-1'
    const res = await forwardToAccountPool(baseReq(model), model)
    expect(res && res.ok).toBe(true)
    // 改造点:成功判定落在收尾那一格,所以此刻仍不该有 healthy
    expect(healthWritten()).toBe(false)
    fx.push(CHUNK_A)
    fx.push(CHUNK_FINAL)
    fx.push(DONE)
    fx.end()

    await vi.waitFor(() => expect(healthWritten()).toBe(true))
    await vi.waitFor(() =>
      expect(mockRecordAccountUsage).toHaveBeenCalledWith(
        expect.objectContaining({ accountId: row.id, ok: true }),
      ),
    )
    expect(failureWritten()).toBe(false)
    expect(interruptTotal() - before).toBe(0)
  })

  it('executeChat 生成器正常结束 ⇒ 记成功;半路抛错 ⇒ 记失败(两型同一判据)', async () => {
    const cleanRow = accountRow('acct-exec-clean') as { id: string }
    accountRows = [cleanRow]
    registerRelayAdapter(
      fakeAdapter({
        providerCode: PROVIDER,
        buildChatRequest: () => {
          throw new Error('不应走通用路径')
        },
        async executeChat() {
          async function* gen() {
            yield {
              id: 'e1',
              object: 'chat.completion.chunk',
              choices: [{ index: 0, delta: { content: '你好' } }],
            }
            yield {
              id: 'e1',
              object: 'chat.completion.chunk',
              choices: [{ index: 0, delta: { content: '世界' }, finish_reason: 'stop' }],
            }
          }
          return { stream: gen() }
        },
      }),
    )
    const okModel = 'exec-clean-model-1'
    const okRes = await forwardToAccountPool(baseReq(okModel), okModel)
    expect(okRes && okRes.ok).toBe(true)
    if (!okRes || !okRes.ok) throw new Error('前置:生成器正常结束应交付')
    await okRes.response.text()
    await vi.waitFor(() => expect(healthWritten()).toBe(true))
    expect(failureWritten()).toBe(false)

    // 同一条判据的另一侧:生成器半路炸
    updateCalls.length = 0
    mockRecordAccountUsage.mockClear()
    const badRow = accountRow('acct-exec-broken') as { id: string }
    accountRows = [badRow]
    registerRelayAdapter(
      fakeAdapter({
        providerCode: PROVIDER,
        buildChatRequest: () => {
          throw new Error('不应走通用路径')
        },
        async executeChat() {
          async function* gen() {
            yield {
              id: 'e2',
              object: 'chat.completion.chunk',
              choices: [{ index: 0, delta: { content: '半句' } }],
            }
            throw new Error('会话段二请求失败:socket closed')
          }
          return { stream: gen() }
        },
      }),
    )
    const badModel = 'exec-broken-model-1'
    const badRes = await forwardToAccountPool(baseReq(badModel), badModel)
    expect(badRes && badRes.ok).toBe(true)
    await vi.waitFor(() =>
      expect(mockRecordAccountUsage).toHaveBeenCalledWith(
        expect.objectContaining({ accountId: badRow.id, ok: false }),
      ),
    )
    expect(healthWritten()).toBe(false)
    expect(failureWritten()).toBe(true)
  })

  it('断流坐实不了「票死了」:文案级 session_dead 降 network,不摘号不写 down', async () => {
    const row = accountRow('acct-clamp') as { id: string }
    accountRows = [row]
    // 富分类按真实适配器形态写:HTTP 状态优先,状态 0 时才看文案
    // (Trae 系就是这么分 auth/session_dead 的 —— 本用例要的是「文案级结论」被降级,不是把适配器编歪)
    const adapter = fakeAdapter({
      providerCode: PROVIDER,
      buildChatRequest: () => {
        throw new Error('不应走通用路径')
      },
      classifyUpstreamFailure: (status, bodyText) => {
        if (status === 401 || status === 403) return { kind: 'auth' as const }
        if (/re-login|重新登录/.test(bodyText)) return { kind: 'session_dead' as const }
        return { kind: 'client' as const }
      },
      async executeChat() {
        async function* gen() {
          yield {
            id: 'c1',
            object: 'chat.completion.chunk',
            choices: [{ index: 0, delta: { content: '半句' } }],
          }
          throw new Error('上游连接断开,可能需 re-login')
        }
        return { stream: gen() }
      },
    })
    registerRelayAdapter(adapter)
    const model = 'clamp-model-1'
    const res = await forwardToAccountPool(baseReq(model), model)
    expect(res && res.ok).toBe(true)

    await vi.waitFor(() => expect(failureWritten()).toBe(true))
    // 摘号/降级/到期收敛一条都不许出现:断流只是「该号本轮失败」
    expect(updateCalls.some((s) => s.tempUnschedulable === true)).toBe(false)
    expect(updateCalls.some((s) => s.healthStatus === 'down')).toBe(false)
    expect(updateCalls.some((s) => 'tokenExpiresAt' in s)).toBe(false)
    expect(healthWritten()).toBe(false)

    // 同一把尺子的两侧(判据单源 = 生产实现,测试不复制第二份)
    const bare = new Error('上游连接断开,可能需 re-login')
    expect(F.kindForStreamInterrupt(adapter, bare)).toBe('network')
    // 正向对照:带上游真 HTTP 状态 = 真凭据证据,允许坐实 auth
    const withStatus = Object.assign(new Error('Trae 上游鉴权失败(HTTP 401)'), { statusCode: 401 })
    expect(F.kindForStreamInterrupt(adapter, withStatus)).toBe('auth')
    // 纯截断(没有异常)也只能是 network
    expect(F.kindForStreamInterrupt(adapter, undefined)).toBe('network')
  })

  it('客户端主动断开 ⇒ 不记失败账、不进断流计数(与主循环 AbortError 同口径)', async () => {
    const row = accountRow('acct-abort') as { id: string }
    accountRows = [row]
    registerRelayAdapter(fakeAdapter({ providerCode: PROVIDER }))
    const fx = sseFixture()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => sseResponse(fx.body)),
    )
    const before = interruptTotal()

    const ac = new AbortController()
    const model = 'abort-model-1'
    const res = await forwardToAccountPool({ ...baseReq(model), signal: ac.signal }, model)
    expect(res && res.ok).toBe(true)
    fx.push(CHUNK_A)
    await new Promise((r) => setImmediate(r))
    ac.abort()
    fx.fail(new Error('The user aborted a request.'))
    // 断流支路的 settle 是异步的:多排几拍,确保「不记账」是排完之后的结论而不是没跑到
    for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r))
    expect(interruptTotal()).toBe(before)
    expect(mockRecordAccountUsage).not.toHaveBeenCalled()
    expect(failureWritten()).toBe(false)
    expect(healthWritten()).toBe(false)
  })

  it('断流仍归还并发额度:三连断流后第四轮照旧打得到上游(否则号被自己的坏流转死)', async () => {
    const row = accountRow('acct-release') as { id: string }
    accountRows = [row]
    registerRelayAdapter(fakeAdapter({ providerCode: PROVIDER }))
    const fetchMock = vi.fn(async () => {
      const fx = sseFixture()
      const resp = sseResponse(fx.body)
      fx.push(CHUNK_A)
      // 断流发生在响应头之后(真实形态):先把头交出去,再炸正文
      setTimeout(() => fx.fail(new Error('ECONNRESET mid-stream')), 0)
      return resp
    })
    vi.stubGlobal('fetch', fetchMock)
    const model = 'release-model-1'
    for (let i = 0; i < 3; i++) {
      const r = await forwardToAccountPool(baseReq(model), model)
      expect(r && r.ok).toBe(true)
      await vi.waitFor(() => expect(mockRecordAccountUsage).toHaveBeenCalledTimes(i + 1))
    }
    // 三连败已触发进程熔断冷却 ⇒ 先解冷却,只留「额度有没有归还」这一问
    await clearAccountCooldown(row.id)
    mockRecordAccountUsage.mockClear()
    const fourth = await forwardToAccountPool(baseReq(model), model)
    expect(fourth && fourth.ok).toBe(true)
    if (!fourth || !fourth.ok) throw new Error('第四轮应重新拿到该号')
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(String(fourth.channel.groupName)).toContain('测试号')
  })
})

describe('429 退避:上游说几秒就退避几秒', () => {
  const at = (nowMs: number, secondsFromNow: number): string =>
    new Date(nowMs + secondsFromNow * 1000).toUTCString()

  it('纯判据:秒数 / HTTP-date / epoch 秒 / 两张头取长 / 非法形态与已过期 ⇒ null', () => {
    const now = 1_700_000_000_000
    const H = (init: Record<string, string>) => new Response(null, { headers: init }).headers
    expect(F.extractUpstreamBackoffMs(H({ 'retry-after': '120' }), now)).toBe(120_000)
    expect(F.extractUpstreamBackoffMs(H({ 'retry-after': '0.5' }), now)).toBe(500)
    expect(F.extractUpstreamBackoffMs(H({ 'retry-after': at(now, 90) }), now)).toBe(90_000)
    // 已过期(HTTP-date 在过去)= 未判定,不得读成 0
    expect(F.extractUpstreamBackoffMs(H({ 'retry-after': at(now, -90) }), now)).toBeNull()
    // epoch 秒形(GitHub 系 x-ratelimit-reset)按距今换算
    expect(
      F.extractUpstreamBackoffMs(
        H({ 'x-ratelimit-reset': String(Math.floor(now / 1000) + 30) }),
        now,
      ),
    ).toBe(30_000)
    // delta 秒形(OpenAI 系)照收
    expect(F.extractUpstreamBackoffMs(H({ 'x-ratelimit-reset': '45' }), now)).toBe(45_000)
    // 两张都给 ⇒ 取更长的那枚
    expect(
      F.extractUpstreamBackoffMs(H({ 'retry-after': '20', 'x-ratelimit-reset': '75' }), now),
    ).toBe(75_000)
    // 非法形态 / 缺头 ⇒ null(未判定)
    expect(F.extractUpstreamBackoffMs(H({ 'retry-after': 'soon' }), now)).toBeNull()
    expect(F.extractUpstreamBackoffMs(H({ 'retry-after': '-5' }), now)).toBeNull()
    expect(F.extractUpstreamBackoffMs(H({}), now)).toBeNull()
    expect(F.extractUpstreamBackoffMs(undefined, now)).toBeNull()
    // 纯对象头形态(适配器把原始头挂在错误上时也能读)
    expect(F.extractUpstreamBackoffMs({ 'Retry-After': '15' }, now)).toBe(15_000)
  })

  /** 单号池 + 指定上游状态码与响应头,返回该号的冷却时长与透传给调用方的原因 */
  async function runUpstream(
    label: string,
    status: number,
    headers: Record<string, string>,
  ): Promise<{ cooldownMs: number; reason: string }> {
    const row = accountRow(label) as { id: string }
    accountRows = [row]
    registerRelayAdapter(fakeAdapter({ providerCode: PROVIDER }))
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"error":"upstream said no"}', { status, headers })),
    )
    const model = `${label}-model-1`
    const res = await forwardToAccountPool({ ...baseReq(model), stream: false }, model)
    expect(res && res.ok).toBe(false)
    if (!res || res.ok) throw new Error(`前置:${status} 应透传失败(${label})`)
    return { cooldownMs: cooldownDelta(row.id), reason: res.reason ?? '' }
  }

  /** 该号本轮实际被冷却了多久;一枚都没写 ⇒ 直接判死(不回落 0 冒充「没冷却」) */
  function cooldownDelta(id: string): number {
    const write = cooldownWrites.find((w) => w.id === id)
    if (!write) throw new Error(`429 必须落一枚冷却(${id}):一条都没写就是恒 0 放行`)
    return write.untilMs - write.atMs
  }

  it('Retry-After: 120 ⇒ 冷却 120s(不是自家常量),采用的秒数写进归因', async () => {
    const { cooldownMs, reason } = await runUpstream('acct-rate120', 429, { 'Retry-After': '120' })
    expect(Math.abs(cooldownMs - 120_000)).toBeLessThan(2_000)
    expect(reason).toContain('退避=120s')
    expect(reason).toContain('上游声明 120s')
  })

  it('取不到头 ⇒ 保持 RATE_COOLDOWN_MS(绝不读成 0,也不读成上游没说过的数)', async () => {
    const { cooldownMs, reason } = await runUpstream('acct-rate-none', 429, {})
    expect(Math.abs(cooldownMs - F.RATE_COOLDOWN_MS)).toBeLessThan(2_000)
    expect(reason).toContain('上游未给可用 Retry-After')
  })

  it('头形如「soon」这类不可用值 ⇒ 同样回落常量,并点名头不可用', async () => {
    const { cooldownMs } = await runUpstream('acct-ratejunk', 429, { 'Retry-After': 'soon' })
    expect(Math.abs(cooldownMs - F.RATE_COOLDOWN_MS)).toBeLessThan(2_000)
  })

  it('上游给的比常量还短 ⇒ max 口径回落常量(退避不会被上游一句话调成零)', async () => {
    const { cooldownMs } = await runUpstream('acct-rate5', 429, { 'Retry-After': '5' })
    expect(Math.abs(cooldownMs - F.RATE_COOLDOWN_MS)).toBeLessThan(2_000)
  })

  it('上游给得天文数字 ⇒ 封顶 RATE_COOLDOWN_MAX_MS,并在归因里写明是截断', async () => {
    const { cooldownMs, reason } = await runUpstream('acct-ratehuge', 429, {
      'Retry-After': '999999',
    })
    expect(Math.abs(cooldownMs - F.RATE_COOLDOWN_MAX_MS)).toBeLessThan(2_000)
    expect(reason).toContain('按上限')
  })

  it('HTTP-date 形同样生效(x-ratelimit-reset 的 epoch 形亦同)', async () => {
    const future = new Date(Date.now() + 240_000).toUTCString()
    const { cooldownMs } = await runUpstream('acct-ratedate', 429, { 'Retry-After': future })
    expect(Math.abs(cooldownMs - 240_000)).toBeLessThan(3_000)

    const epoch = String(Math.floor((Date.now() + 300_000) / 1000))
    const viaReset = await runUpstream('acct-rateepoch', 429, { 'x-ratelimit-reset': epoch })
    expect(Math.abs(viaReset.cooldownMs - 300_000)).toBeLessThan(3_000)
  })

  it('反向对照:非限流类(500)不编造退避依据,冷却仍走熔断口径', async () => {
    const row = accountRow('acct-500') as { id: string }
    accountRows = [row]
    registerRelayAdapter(fakeAdapter({ providerCode: PROVIDER }))
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('boom', { status: 500, headers: { 'Retry-After': '120' } })),
    )
    const model = 'acct-500-model-1'
    const res = await forwardToAccountPool({ ...baseReq(model), stream: false }, model)
    expect(res && res.ok).toBe(false)
    if (!res || res.ok) throw new Error('前置:500 应透传失败')
    expect(res.reason ?? '').not.toContain('退避=')
    expect(res.reason ?? '').toContain('上游 500')
    // 首轮 server 失败不冷却(BREAKER 未满 3 败):冷却只由限流/风控/积分触发
    expect(cooldownWrites.filter((w) => w.id === row.id)).toHaveLength(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
