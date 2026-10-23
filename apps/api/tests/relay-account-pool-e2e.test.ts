// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池「导入 → 选号 → 转发」合成账号端到端验收(2026-10-23 立)。
 *
 * 全程零真实网络/数据库:导入走真实 importAccounts(加密/去重/过期语义),
 * 转发走真实 forwardToAccountPool(选号/刷新/熔断/SSE),只有 DB 与上游适配器是假的。
 * 合成 JWT 只在本测试内生成,不含任何真实凭证。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── 内存版号池:insert 落 store,候选查询按 schedulable 过滤;provider 反查走 join 分支 ──
let providerRows: Array<{ providerCode: string; configId: number }> = []
interface StoredAccount {
  id: string
  providerCode: string
  uid: string
  name: string
  tokenEnc: string
  refreshTokenEnc: string | null
  cookiesEnc: string | null
  secretsEnc: string | null
  deviceId: string | null
  machineId: string | null
  tokenExpiresAt: Date | null
  refreshExpiresAt: Date | null
  priority: number
  weight: number
  isEnabled: boolean
  tempUnschedulable: boolean
  healthStatus: string
  healthCheckedAt: Date | null
  lastErrorMessage: string | null
  lastUsedAt: Date | null
  lastRefreshAt: Date | null
  refreshFailureCount: number
  consecutiveFailures: number
  proxyUrl: string | null
  totalCalls: number
  extraMetadata: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}
let store: StoredAccount[] = []
let updateCalls: Array<Record<string, unknown>> = []
let rowSeq = 0

vi.mock('../src/db/index.js', () => {
  const withSettlers = (step: Record<string, unknown>, resolver: () => unknown[]) => {
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(resolver()).then(resolve, reject)
    step.catch = (reject?: (e: unknown) => void) => Promise.resolve(resolver()).catch(reject)
    step.finally = (fn?: () => void) => Promise.resolve(resolver()).finally(fn)
    return step
  }
  const chainSelect = () => {
    const step: Record<string, unknown> = {}
    let mode: 'plain' | 'join' | 'limit' | 'order' = 'plain'
    for (const m of ['from', 'where', 'groupBy', 'offset']) step[m] = vi.fn(() => step)
    step.innerJoin = vi.fn(() => {
      mode = 'join'
      return step
    })
    step.limit = vi.fn(() => {
      mode = 'limit'
      return step
    })
    step.orderBy = vi.fn(() => {
      mode = 'order'
      return step
    })
    return withSettlers(step, () => {
      if (mode === 'join') return providerRows
      if (mode === 'order') return store.filter((r) => r.isEnabled && !r.tempUnschedulable)
      return []
    })
  }
  const chainWrite = () => {
    const step: Record<string, unknown> = {}
    step.values = vi.fn((values: Record<string, unknown>) => {
      const id = `acct-${++rowSeq}`
      store.push({
        id,
        providerCode: String(values['providerCode']),
        uid: String(values['uid']),
        name: String(values['name']),
        tokenEnc: String(values['tokenEnc']),
        refreshTokenEnc: (values['refreshTokenEnc'] as string | null) ?? null,
        cookiesEnc: (values['cookiesEnc'] as string | null) ?? null,
        secretsEnc: (values['secretsEnc'] as string | null) ?? null,
        deviceId: (values['deviceId'] as string | null) ?? null,
        machineId: (values['machineId'] as string | null) ?? null,
        tokenExpiresAt: (values['tokenExpiresAt'] as Date | null) ?? null,
        refreshExpiresAt: null,
        priority: 0,
        weight: 1,
        isEnabled: values['isEnabled'] !== false,
        tempUnschedulable: values['tempUnschedulable'] === true,
        healthStatus: String(values['healthStatus'] ?? 'unknown'),
        healthCheckedAt: null,
        lastErrorMessage: (values['lastErrorMessage'] as string | null) ?? null,
        lastUsedAt: null,
        lastRefreshAt: null,
        refreshFailureCount: 0,
        consecutiveFailures: 0,
        proxyUrl: (values['proxyUrl'] as string | null) ?? null,
        totalCalls: 0,
        extraMetadata: (values['extraMetadata'] as Record<string, unknown>) ?? {},
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      // importAccounts 走 `.values(...).returning({id, credVersion})`(O64 凭证版本回写);
      // 不返行会被 service 判"未取到回写行"→ 导入恒为 0。这里与真实 insert 同形状回一行。
      return { returning: vi.fn(() => Promise.resolve([{ id, credVersion: 1 }])) }
    })
    step.set = vi.fn((values: Record<string, unknown>) => {
      updateCalls.push(values)
      return step
    })
    step.where = vi.fn(() => Promise.resolve())
    step.returning = vi.fn(() => Promise.resolve([]))
    return step
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

vi.mock('../src/config/index.js', () => ({
  config: { REDIS_URL: 'redis://127.0.0.1:1/0' },
}))

const usageCalls: Array<Record<string, unknown>> = []
vi.mock('../src/services/relay-account-usage.js', () => ({
  recordAccountUsage: async (u: Record<string, unknown>) => {
    usageCalls.push(u)
  },
}))
vi.mock('../src/services/relay-proxy-pool.js', () => ({
  pickProxyForAccount: async () => null,
  reportProxyFailure: async () => {},
  reportProxySuccess: async () => {},
}))
vi.mock('../src/services/relay-model-catalog.js', () => ({
  resolveModelAlias: async () => null,
}))
vi.mock('undici', () => ({
  ProxyAgent: class {
    close(): void {}
  },
  fetch: vi.fn(),
}))

import { importAccounts } from '../src/services/relay-account-pool-service.js'
import { forwardToAccountPool } from '../src/services/relay-account-forwarder.js'
import { registerRelayAdapter } from '../src/services/relay-upstream-adapters.js'
import type {
  AdapterAccountContext,
  NormalizedChatRequest,
  RelayUpstreamAdapter,
  UpstreamChatResult,
} from '../src/services/relay-upstream-adapters.js'
import {
  __test__ as sharedState,
  getAccountsInCooldown,
} from '../src/services/relay-account-shared-state.js'

const NOW = new Date()
const FUTURE = new Date(NOW.getTime() + 7 * 24 * 3600_000)
const JWT_FUTURE = Math.floor(FUTURE.getTime() / 1000)
const JWT_EXPIRED = Math.floor(new Date(NOW.getTime() - 3600_000).getTime() / 1000)

function b64(o: unknown): string {
  return Buffer.from(JSON.stringify(o)).toString('base64url')
}

function jwt(payload: Record<string, unknown>): string {
  return `${b64({ alg: 'RS256' })}.${b64(payload)}.sig`
}

function exportAccount(
  uid: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    name: `合成号${uid}`,
    token: jwt({ data: { id: uid, tenant_id: 'tenant-e2e' }, exp: JWT_FUTURE }),
    refreshToken: `rt-${uid}`,
    enabled: true,
    cookies: [
      { name: 'd_ticket', value: `ticket-${uid}`, expires_utc: 13467354232000000 },
      { name: 'session', value: `s-${uid}`, expires_utc: 0 },
    ],
    ...overrides,
  }
}

// ── 假上游:按场景抛 auth / risk,正常返回两帧 SSE ──
class FakeUpstreamError extends Error {
  readonly statusCode: number
  constructor(statusCode: number, message: string) {
    super(message)
    this.name = 'FakeUpstreamError'
    this.statusCode = statusCode
  }
}

let attempts = 0
let failMode: 'none' | 'auth' | 'risk' = 'none'
let failUid: string | null = null
const executeCalls: Array<{ uid: string; token: string; cookieCount: number }> = []
const refreshCalls: Array<{ uid: string; token: string }> = []

async function* chunkStream(): AsyncIterable<Record<string, unknown>> {
  yield {
    id: 'chatcmpl-e2e',
    object: 'chat.completion.chunk',
    choices: [{ index: 0, delta: { content: '你好' } }],
  }
  yield {
    id: 'chatcmpl-e2e',
    object: 'chat.completion.chunk',
    choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
    usage: { prompt_tokens: 3, completion_tokens: 4 },
  }
}

function e2eAdapter(): RelayUpstreamAdapter {
  return {
    providerCode: 'trae',
    buildChatRequest: () => {
      throw new Error('不应走通用单请求路径')
    },
    translateStreamChunk: () => null,
    translateNonStream: () => ({}),
    async executeChat(
      ctx: AdapterAccountContext,
      _req: NormalizedChatRequest,
    ): Promise<UpstreamChatResult> {
      attempts++
      executeCalls.push({
        uid: ctx.row.uid,
        token: ctx.credentials.token,
        cookieCount: ctx.credentials.cookies.length,
      })
      if (failMode !== 'none' && (failUid === null || failUid === ctx.row.uid)) {
        if (failMode === 'risk') throw new FakeUpstreamError(403, 'risk: 4015 账号或 IP 存在风险')
        if (attempts === 1) throw new FakeUpstreamError(401, 'unauthorized')
      }
      return { stream: chunkStream() }
    },
    async refreshToken(ctx) {
      refreshCalls.push({ uid: ctx.row.uid, token: ctx.credentials.token })
      return { token: 'jwt-refreshed', refreshToken: 'rt-refreshed', expiresAt: FUTURE }
    },
    async checkHealth() {
      return { ok: true }
    },
    isAuthFailure: (status) => status === 401 || status === 403,
    isAuthError: (err) => err instanceof FakeUpstreamError && err.statusCode === 401,
    classifyUpstreamFailure: (status, body) => {
      if (body.includes('risk')) return { kind: 'risk' }
      if (status === 401) return { kind: 'auth' }
      return { kind: 'server' }
    },
  }
}

let modelSeq = 0
function nextModel(): string {
  return `trae-e2e-${++modelSeq}`
}

function req(model: string, userId?: string) {
  return {
    model,
    messages: [{ role: 'user' as const, content: '合成账号端到端' }],
    stream: true,
    ...(userId ? { userId } : {}),
  }
}

async function importBoth(): Promise<{ uidA: string; uidB: string }> {
  const result = await importAccounts('trae', [exportAccount('501'), exportAccount('502')])
  expect(result.imported).toBe(2)
  expect(result.failed).toBe(0)
  return { uidA: '501', uidB: '502' }
}

beforeEach(async () => {
  providerRows = []
  store = []
  updateCalls = []
  usageCalls.length = 0
  executeCalls.length = 0
  refreshCalls.length = 0
  attempts = 0
  failMode = 'none'
  failUid = null
  await sharedState.reset()
  registerRelayAdapter(e2eAdapter())
})

describe('号池导入 → 转发 端到端', () => {
  it('导入两个合成账号(加密/到期/租户/cookie)→ 选号 → 流式转发 → 用量入账', async () => {
    const { uidA } = await importBoth()

    // 导入语义:加密落库、到期时刻、租户与 cookie 统计
    const row = store.find((r) => r.uid === uidA)!
    expect(row.tokenEnc.startsWith('enc:')).toBe(true)
    expect(row.refreshTokenEnc).toBe(`enc:rt-${uidA}`)
    expect(row.cookiesEnc?.startsWith('enc:')).toBe(true)
    // JWT exp 是秒级精度,落库时刻按秒截断
    expect(row.tokenExpiresAt?.toISOString()).toBe(
      new Date(Math.floor(FUTURE.getTime() / 1000) * 1000).toISOString(),
    )
    expect(row.extraMetadata['tenantId']).toBe('tenant-e2e')
    expect(row.extraMetadata['cookieCount']).toBe(2)
    expect(row.healthStatus).toBe('unknown')

    providerRows = [{ providerCode: 'trae', configId: 7 }]
    const model = nextModel()
    const res = await forwardToAccountPool(req(model), model)
    expect(res?.ok).toBe(true)
    if (!res || !res.ok) throw new Error('账号池转发应成功')
    expect(res.channel.providerCode).toBe('trae')
    expect(res.channel.groupId).toBe('account-pool')

    // 选号顺序:501 优先;上游拿到的是解密后的原始 token 与 cookies
    expect(executeCalls[0]?.uid).toBe(uidA)
    expect(executeCalls[0]?.cookieCount).toBe(2)

    const sse = await res.response.text()
    expect(sse).toContain('data: {"id":"chatcmpl-e2e"')
    expect(sse.trimEnd().endsWith('data: [DONE]')).toBe(true)

    // 用量 tap 恰好一次(末帧 usage)
    await new Promise((r) => setImmediate(r))
    expect(usageCalls).toHaveLength(1)
    expect(usageCalls[0]).toMatchObject({
      accountId: row.id,
      providerCode: 'trae',
      model,
      promptTokens: 3,
      completionTokens: 4,
      ok: true,
    })
  })

  it('上游 401 → refreshToken 刷新一次 → 新 token 重试成功', async () => {
    const { uidA } = await importBoth()
    providerRows = [{ providerCode: 'trae', configId: 7 }]
    failMode = 'auth'
    failUid = uidA
    const model = nextModel()

    const res = await forwardToAccountPool(req(model), model)
    expect(res?.ok).toBe(true)
    if (!res || !res.ok) throw new Error('401 刷新后应成功')
    await res.response.text()

    expect(refreshCalls).toEqual([{ uid: uidA, token: expect.stringContaining('.') }])
    expect(executeCalls).toHaveLength(2)
    expect(executeCalls[0]?.token).not.toBe('jwt-refreshed')
    expect(executeCalls[1]).toEqual({
      uid: uidA,
      token: 'jwt-refreshed',
      cookieCount: 2,
    })
    // 刷新结果回写号池(新 token + 新 refreshToken + 到期时间)
    expect(updateCalls.some((c) => c['tokenEnc'] === 'enc:jwt-refreshed')).toBe(true)
    expect(updateCalls.some((c) => c['refreshTokenEnc'] === 'enc:rt-refreshed')).toBe(true)
  })

  it('风控码 4015 → 该号冷却 30 分钟不重放,自动换下一个号', async () => {
    const { uidA, uidB } = await importBoth()
    providerRows = [{ providerCode: 'trae', configId: 7 }]
    failMode = 'risk'
    failUid = uidA
    const model = nextModel()

    const res = await forwardToAccountPool(req(model), model)
    expect(res?.ok).toBe(true)
    if (!res || !res.ok) throw new Error('风控换号后应成功')
    await res.response.text()

    expect(executeCalls.map((c) => c.uid)).toEqual([uidA, uidB])
    // 风控不重放:被命中号只出现一次;冷却已落 shared-state
    const cooling = await getAccountsInCooldown(store.map((r) => r.id))
    const rowA = store.find((r) => r.uid === uidA)!
    expect(cooling.has(rowA.id)).toBe(true)

    // 下一请求跳过冷却号,只打 B
    executeCalls.length = 0
    failMode = 'none'
    const res2 = await forwardToAccountPool(req(model), model)
    expect(res2?.ok).toBe(true)
    if (!res2 || !res2.ok) throw new Error('冷却后第二请求应成功')
    await res2.response.text()
    expect(executeCalls.map((c) => c.uid)).toEqual([uidB])
  })

  it('过期且无 refreshToken → 导入即摘除,不参与调度', async () => {
    const result = await importAccounts('trae', [
      exportAccount('expired-1', {
        token: jwt({ data: { id: 'expired-1' }, exp: JWT_EXPIRED }),
        refreshToken: '',
      }),
    ])
    expect(result.imported).toBe(1)
    const row = store.find((r) => r.uid === 'expired-1')!
    expect(row.healthStatus).toBe('down')
    expect(row.tempUnschedulable).toBe(true)

    providerRows = [{ providerCode: 'trae', configId: 7 }]
    const model = nextModel()
    const res = await forwardToAccountPool(req(model), model)
    expect(res).toBeNull()
    expect(executeCalls).toHaveLength(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
