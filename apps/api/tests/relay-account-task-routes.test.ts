// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * O68 WorkBuddy 任务自动化路由测试(GET tasks / POST task-run,2026-10-29 立)。
 *
 * 锁死的行为契约:
 * 1. 转发纪律同 23 立即签到:号池行 → 平台映射(非 workbuddy 400)→ pool-status 解析
 *    ai-service 账号 id(未同步 409 / 签到侧不可达 502)→ 转发 /api/checkin/accounts/{id}/*;
 * 2. 上游 429/404 原样透传,其余非 2xx 归 502;网络错误 ⇒ 502,绝不冒绿;
 * 3. unjudged 三态诚实:引擎自报未判定 / 响应形状读不出 ⇒ unjudged:true,
 *    空数组只在"判过且确实为空"时出现;credit/energy delta 缺失 = null(不是 0);
 * 4. dryRun → 上游 dry_run 映射;kind 白名单外的入参 400。
 *
 * 测试模式:对齐 relay-admin-proxy-pool.test.ts(DB Proxy mock + jwt mock +
 * 全局 fetch 按 URL 分路由),不发真实网络。
 */
import { describe, it, expect, afterAll, beforeAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

/** 注入响应信封(两路由的 data 形状都用键值面读,断言逐键核对) */
interface Envelope {
  code: number
  message: string
  data: Record<string, unknown>
}

vi.mock('jose', () => ({ decodeJwt: () => ({}) }))
vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://ai.test:8803',
    AI_CALLBACK_SECRET: 'test-internal-secret',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
  },
}))

const { mockVerifyAccessToken, mockSelectResult, rearmDbMockDefaults, fetchCalls, fetchRoutes } =
  vi.hoisted(() => {
    const mockVerifyAccessToken = vi.fn()
    const mockSelectResult = vi.fn(async () => [] as unknown[])
    const fetchCalls: Array<{ url: string; method: string; body: string | undefined }> = []
    /** 按 URL 子串路由的响应表(测试内逐例武装);未命中 ⇒ 视为网络错误 */
    const fetchRoutes: { match: string; status: number; json: unknown }[] = []
    return {
      mockVerifyAccessToken,
      mockSelectResult,
      rearmDbMockDefaults: () => {
        mockSelectResult.mockReset()
        mockSelectResult.mockResolvedValue([])
        fetchCalls.length = 0
        fetchRoutes.length = 0
      },
      fetchCalls,
      fetchRoutes,
    }
  })

vi.mock('@ihui/auth', () => ({
  signAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-refresh-token'),
  verifyAccessToken: mockVerifyAccessToken,
  createFamilyId: vi.fn().mockReturnValue('00000000-0000-4000-8000-000000000002'),
}))
vi.mock('../src/db/usercenter-queries.js', () => ({
  getUserStatus: vi.fn().mockResolvedValue(1),
}))
vi.mock('../src/services/relay-account-pool-scheduler.js', () => ({
  sweepAccountPool: vi.fn().mockResolvedValue({}),
  refreshOne: vi.fn().mockResolvedValue(true),
}))
vi.mock('../src/services/relay-upstream-adapters.js', () => ({
  getRelayAdapter: vi.fn(() => null),
}))

vi.mock('../src/db/index.js', () => {
  function selectChain(): unknown {
    return new Proxy({} as Record<string, unknown>, {
      get(_t, prop) {
        if (typeof prop !== 'string') return undefined
        if (prop === 'then')
          return (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
            mockSelectResult().then(resolve, reject)
        return () => selectChain()
      },
    })
  }
  return {
    db: {
      select: () => selectChain(),
      execute: vi.fn(async () => []),
    },
    dbRead: { select: () => selectChain() },
    dbClient: {},
  }
})

import relayAccountPoolRoutes from '../src/routes/admin/relay-account-pool.js'
// §22c:期望值一律由生产端现算(relay-pool-policy 是唯一真相源),测试里不抄第二份档位表
import { __test__ as POLICY } from '../src/services/relay-pool-policy.js'

const ADMIN_TOKEN = 'Bearer admin-token'
const ACCOUNT_ID = '00000000-0000-4000-8000-0000000000a1'
/** ai-service 侧签到账号 id(pool-status 返回的 accountId) */
const CHECKIN_ACCOUNT_ID = 42

let srv: FastifyInstance | undefined

function server(): FastifyInstance {
  if (!srv) throw new Error('测试服务器未就绪')
  return srv
}

async function injectJson(opts: {
  method: string
  url: string
  body?: unknown
  headers?: Record<string, string>
}): Promise<{ statusCode: number; envelope: Envelope }> {
  const res = await server().inject(opts)
  return { statusCode: res.statusCode, envelope: res.json<Envelope>() }
}

function mockAdmin() {
  mockVerifyAccessToken.mockResolvedValue({
    userId: '00000000-0000-4000-8000-000000000001',
    phone: '13800000001',
    familyId: '00000000-0000-4000-8000-000000000002',
    roleId: 1,
  })
}

function poolRow(providerCode = 'workbuddy') {
  return { id: ACCOUNT_ID, providerCode, ownerUserId: null, uid: 'uid-wb-1' }
}

/** pool-status 点查命中(accountId=42) */
function armPoolStatusFound() {
  fetchRoutes.push({
    match: '/internal/checkin/pool-status',
    status: 200,
    json: { found: true, accountId: CHECKIN_ACCOUNT_ID, name: 'wb', enabled: true },
  })
}

function armTasksResponse(json: unknown, status = 200) {
  fetchRoutes.push({
    match: `/api/checkin/accounts/${CHECKIN_ACCOUNT_ID}/tasks`,
    status,
    json,
  })
}

function armTaskRunResponse(json: unknown, status = 200) {
  fetchRoutes.push({
    match: `/api/checkin/accounts/${CHECKIN_ACCOUNT_ID}/task-run`,
    status,
    json,
  })
}

function tasksUrl() {
  return `/api/admin/relay/accounts/${ACCOUNT_ID}/tasks`
}
function taskRunUrl() {
  return `/api/admin/relay/accounts/${ACCOUNT_ID}/task-run`
}

beforeAll(async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      const method = String(init?.method ?? 'GET').toUpperCase()
      const body = typeof init?.body === 'string' ? init.body : undefined
      fetchCalls.push({ url, method, body })
      const hit = fetchRoutes.find((r) => url.includes(r.match))
      if (!hit) {
        // 未武装的 URL = 网络不可达(与真实 fetch 拒绝同语义),路由必须落 502 而不是冒绿
        throw new Error(`ECONNREFUSED ${url}`)
      }
      return new Response(JSON.stringify(hit.json), {
        status: hit.status,
        headers: { 'content-type': 'application/json' },
      })
    }),
  )
  const s = Fastify({ logger: false, pluginTimeout: 60000 })
  await s.register(relayAccountPoolRoutes, { prefix: '/api' })
  await s.ready()
  srv = s
})

afterAll(async () => {
  await srv?.close()
  srv = undefined
  vi.unstubAllGlobals()
})

describe('GET /admin/relay/accounts/:id/tasks(O68 转发面)', () => {
  beforeEach(() => {
    rearmDbMockDefaults()
    mockAdmin()
  })

  it('正常清单:任务字段归一透传,null 字段不被改写成 0', async () => {
    mockSelectResult.mockResolvedValueOnce([poolRow()])
    armPoolStatusFound()
    armTasksResponse({
      ok: true,
      kind: 'list',
      tasks: [
        {
          task_code: 'daily_growth',
          title: '每日成长',
          progress: 3,
          target: 5,
          status: 'running',
          accept_status: 'accepted',
          reward_credit: null,
          reward_energy: 20,
          valid_to: null,
        },
      ],
      reason: null,
      unjudged: false,
    })
    const { statusCode, envelope } = await injectJson({
      method: 'GET',
      url: tasksUrl(),
      headers: { authorization: ADMIN_TOKEN },
    })
    expect(statusCode).toBe(200)
    const d = envelope.data
    expect(d.ok).toBe(true)
    expect(d.unjudged).toBe(false)
    const tasks = d.tasks as Record<string, unknown>[]
    expect(tasks).toHaveLength(1)
    expect(tasks[0].taskCode).toBe('daily_growth')
    expect(tasks[0].rewardCredit).toBeNull() // null ≠ 0:引擎没给奖励数值
    expect(tasks[0].acceptStatus).toBe('accepted')
    // 转发的正是 pool-status 解析出的 ai-service 账号 id
    expect(
      fetchCalls.some((c) => c.url.includes(`/api/checkin/accounts/${CHECKIN_ACCOUNT_ID}/tasks`)),
    ).toBe(true)
  })

  it('引擎自报 unjudged:true ⇒ 原样标注,不冒充"判过"', async () => {
    mockSelectResult.mockResolvedValueOnce([poolRow()])
    armPoolStatusFound()
    armTasksResponse({
      ok: true,
      kind: 'list',
      tasks: [],
      reason: '上游清单接口超时',
      unjudged: true,
    })
    const { statusCode, envelope } = await injectJson({
      method: 'GET',
      url: tasksUrl(),
      headers: { authorization: ADMIN_TOKEN },
    })
    expect(statusCode).toBe(200)
    const d = envelope.data
    expect(d.unjudged).toBe(true)
    expect(d.reason).toBe('上游清单接口超时')
  })

  it('响应形状读不出(无 tasks 数组)⇒ ok:false + unjudged:true(空列表≠判过)', async () => {
    mockSelectResult.mockResolvedValueOnce([poolRow()])
    armPoolStatusFound()
    armTasksResponse({ ok: true, kind: 'list' })
    const { statusCode, envelope } = await injectJson({
      method: 'GET',
      url: tasksUrl(),
      headers: { authorization: ADMIN_TOKEN },
    })
    expect(statusCode).toBe(200)
    const d = envelope.data
    expect(d.ok).toBe(false)
    expect(d.unjudged).toBe(true)
    expect(d.tasks).toEqual([])
  })

  it('上游 429 原样透传(限流不是笼统失败)', async () => {
    mockSelectResult.mockResolvedValueOnce([poolRow()])
    armPoolStatusFound()
    armTasksResponse({ detail: 'rate limited' }, 429)
    const { statusCode, envelope } = await injectJson({
      method: 'GET',
      url: tasksUrl(),
      headers: { authorization: ADMIN_TOKEN },
    })
    expect(statusCode).toBe(429)
    expect(envelope.message).toContain('429')
  })

  it('非 workbuddy 平台(trae)⇒ 400 映射即拦截,不发任务请求', async () => {
    mockSelectResult.mockResolvedValueOnce([poolRow('trae')])
    const { statusCode } = await injectJson({
      method: 'GET',
      url: tasksUrl(),
      headers: { authorization: ADMIN_TOKEN },
    })
    expect(statusCode).toBe(400)
    expect(fetchCalls.filter((c) => c.url.includes('/tasks'))).toHaveLength(0)
  })

  it('未同步到签到侧(pool-status found:false)⇒ 409 点名', async () => {
    mockSelectResult.mockResolvedValueOnce([poolRow()])
    fetchRoutes.push({
      match: '/internal/checkin/pool-status',
      status: 200,
      json: { found: false },
    })
    const { statusCode } = await injectJson({
      method: 'GET',
      url: tasksUrl(),
      headers: { authorization: ADMIN_TOKEN },
    })
    expect(statusCode).toBe(409)
  })

  it('ai-service 不可达(fetch 拒绝)⇒ 502,失败不被渲染成成功', async () => {
    mockSelectResult.mockResolvedValueOnce([poolRow()])
    armPoolStatusFound()
    // tasks URL 故意不武装 ⇒ fetch 桩抛 ECONNREFUSED
    const { statusCode } = await injectJson({
      method: 'GET',
      url: tasksUrl(),
      headers: { authorization: ADMIN_TOKEN },
    })
    expect(statusCode).toBe(502)
  })

  it('号池账号不存在 ⇒ 404(不落到转发腿)', async () => {
    mockSelectResult.mockResolvedValueOnce([])
    const { statusCode } = await injectJson({
      method: 'GET',
      url: tasksUrl(),
      headers: { authorization: ADMIN_TOKEN },
    })
    expect(statusCode).toBe(404)
    expect(fetchCalls).toHaveLength(0)
  })
})

describe('POST /admin/relay/accounts/:id/task-run(O68 触发面)', () => {
  beforeEach(() => {
    rearmDbMockDefaults()
    mockAdmin()
  })

  it('growth 触发:body 映射 dry_run,结果 delta/unjudged 归一透传', async () => {
    mockSelectResult.mockResolvedValueOnce([poolRow()])
    armPoolStatusFound()
    armTaskRunResponse({
      ok: true,
      kind: 'growth',
      accepted: ['task_a'],
      claimed: ['task_b'],
      credit_delta: 120,
      energy_delta: null,
      reason: null,
      unjudged: false,
    })
    const { statusCode, envelope } = await injectJson({
      method: 'POST',
      url: taskRunUrl(),
      body: { kind: 'growth', dryRun: true },
      headers: { authorization: ADMIN_TOKEN },
    })
    expect(statusCode).toBe(200)
    const call = fetchCalls.find((c) => c.url.includes('/task-run'))
    expect(call?.method).toBe('POST')
    expect(JSON.parse(call?.body ?? '{}')).toEqual({ kind: 'growth', dry_run: true })
    const d = envelope.data
    expect(d.ok).toBe(true)
    expect(d.creditDelta).toBe(120)
    expect(d.energyDelta).toBeNull() // 未量到 ≠ 0
    expect(d.claimed).toEqual(['task_b'])
    expect(d.unjudged).toBe(false)
  })

  it('engine ok:false + reason ⇒ 如实透传失败态(data.ok=false),不冒成功', async () => {
    mockSelectResult.mockResolvedValueOnce([poolRow()])
    armPoolStatusFound()
    armTaskRunResponse({
      ok: false,
      kind: 'blackcat',
      accepted: [],
      claimed: [],
      credit_delta: 0,
      energy_delta: 0,
      reason: '今日次数已用完',
      unjudged: false,
    })
    const { statusCode, envelope } = await injectJson({
      method: 'POST',
      url: taskRunUrl(),
      body: { kind: 'blackcat' },
      headers: { authorization: ADMIN_TOKEN },
    })
    expect(statusCode).toBe(200)
    const d = envelope.data
    expect(d.ok).toBe(false)
    expect(d.reason).toBe('今日次数已用完')
    expect(d.unjudged).toBe(false)
  })

  it('上游 404 原样透传(账号在 ai-service 侧已消失)', async () => {
    mockSelectResult.mockResolvedValueOnce([poolRow()])
    armPoolStatusFound()
    armTaskRunResponse({ detail: 'account gone' }, 404)
    const { statusCode } = await injectJson({
      method: 'POST',
      url: taskRunUrl(),
      body: { kind: 'travel' },
      headers: { authorization: ADMIN_TOKEN },
    })
    expect(statusCode).toBe(404)
  })

  it('kind 白名单之外 ⇒ 400,不发起任何上游请求', async () => {
    mockSelectResult.mockResolvedValueOnce([poolRow()])
    const { statusCode } = await injectJson({
      method: 'POST',
      url: taskRunUrl(),
      body: { kind: 'delete_all' },
      headers: { authorization: ADMIN_TOKEN },
    })
    expect(statusCode).toBe(400)
    expect(fetchCalls).toHaveLength(0)
  })

  it('响应形状读不出(ok 缺失)⇒ unjudged:true(未判定不猜成败)', async () => {
    mockSelectResult.mockResolvedValueOnce([poolRow()])
    armPoolStatusFound()
    armTaskRunResponse({ kind: 'growth' })
    const { statusCode, envelope } = await injectJson({
      method: 'POST',
      url: taskRunUrl(),
      body: { kind: 'growth' },
      headers: { authorization: ADMIN_TOKEN },
    })
    expect(statusCode).toBe(200)
    const d = envelope.data
    expect(d.ok).toBe(false)
    expect(d.unjudged).toBe(true)
  })

  it('非管理员 ⇒ 403', async () => {
    mockVerifyAccessToken.mockResolvedValue({
      userId: '00000000-0000-4000-8000-000000000002',
      roleId: 0,
    })
    const { statusCode } = await injectJson({
      method: 'POST',
      url: taskRunUrl(),
      body: { kind: 'growth' },
      headers: { authorization: 'Bearer user-token' },
    })
    expect(statusCode).toBe(403)
  })
})

// =============================================================================
// O93 号池策略档只读面:端点必须真在 HTTP 面上可达(此前只测 view 纯函数,
// "路由注册了但打不通"这种形态抓不到 —— §0.9 判据要在真跑它的那一刻才成立)
// =============================================================================

describe('GET /admin/relay/pool-policy(O93 策略档只读面)', () => {
  beforeEach(() => {
    rearmDbMockDefaults()
    mockAdmin()
  })

  const policyUrl = '/api/admin/relay/pool-policy'

  it('钮名/钮序/env 键与单源登记表逐枚同值,且明写不可写', async () => {
    const oracle = POLICY.relayPoolPolicyView()
    const { statusCode, envelope } = await injectJson({
      method: 'GET',
      url: policyUrl,
      headers: { authorization: 'Bearer admin-token' },
    })
    expect(statusCode).toBe(200)
    const data = envelope.data as {
      knobs: Array<{ name: string; envKey: string; effective: unknown }>
      mutable: boolean
      registryComplete: boolean
    }
    expect(data.knobs.map((k) => k.name)).toEqual(oracle.knobs.map((k) => k.name))
    expect(data.knobs.map((k) => k.envKey)).toEqual(oracle.knobs.map((k) => k.envKey))
    expect(data.knobs.map((k) => k.effective)).toEqual(oracle.knobs.map((k) => k.effective))
    // 档位来自进程 env,面板只能读不能写:这条是"为什么没做写端点"的正面凭据
    expect(data.mutable).toBe(false)
    expect(data.registryComplete).toBe(true)
  })

  it('改 env 后读数必须跟着变(证明不是恒「全默认」的死读数)', async () => {
    const envKey = POLICY.RELAY_POOL_ENV_KEYS.strategy
    const prev = process.env[envKey]
    process.env[envKey] = 'weighted_random'
    try {
      const oracle = POLICY.relayPoolPolicyView()
      const { envelope } = await injectJson({
        method: 'GET',
        url: policyUrl,
        headers: { authorization: 'Bearer admin-token' },
      })
      const data = envelope.data as {
        knobs: Array<{ envKey: string; effective: unknown; differsFromDefault: boolean }>
        allDefault: boolean
        deviatedKnobs: unknown
      }
      const hit = data.knobs.find((k) => k.envKey === envKey)
      expect(hit?.effective).toBe('weighted_random')
      expect(hit?.differsFromDefault).toBe(true)
      expect(data.allDefault).toBe(false)
      expect(data.deviatedKnobs).toEqual(oracle.deviatedKnobs)
    } finally {
      if (prev === undefined) delete process.env[envKey]
      else process.env[envKey] = prev
    }
  })

  it('非法 env 值不得被静默当成合法档:照实标 invalid 并回落默认', async () => {
    const envKey = POLICY.RELAY_POOL_ENV_KEYS.idleWeightMax
    const prev = process.env[envKey]
    process.env[envKey] = 'not-a-number'
    try {
      const { envelope } = await injectJson({
        method: 'GET',
        url: policyUrl,
        headers: { authorization: 'Bearer admin-token' },
      })
      const data = envelope.data as {
        knobs: Array<{ envKey: string; invalidEnv?: boolean; effective: unknown }>
        invalidEnvKnobs: unknown
      }
      const hit = data.knobs.find((k) => k.envKey === envKey)
      expect(hit?.invalidEnv).toBe(true)
      expect(hit?.effective).toBe(POLICY.DEFAULT_RELAY_POOL_POLICY.idleWeightMax)
      // 非法值必须计入"带病运行"的读数并与生产端现读同值(不在此猜它是数组还是计数)
      expect(data.invalidEnvKnobs).toEqual(POLICY.relayPoolPolicyView().invalidEnvKnobs)
    } finally {
      if (prev === undefined) delete process.env[envKey]
      else process.env[envKey] = prev
    }
  })

  it('档位属特权读数:非管理员 ⇒ 403', async () => {
    mockVerifyAccessToken.mockResolvedValue({
      userId: '00000000-0000-4000-8000-000000000002',
      roleId: 0,
    })
    const { statusCode } = await injectJson({
      method: 'GET',
      url: policyUrl,
      headers: { authorization: 'Bearer user-token' },
    })
    expect(statusCode).toBe(403)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
