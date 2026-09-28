// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * issue #71 的回归锁:n8n 工作流面 list/create 两侧语义不等价。
 *
 * 本票只收口"无争议的那半件" —— n8n **基址 env 名**在两个面各自为政
 * (n8n-proxy 只认 N8N_DOMAIN、ai-vendors/proxy-tools 只认 N8N_BASE_URL),
 * 于是"运维配了另一个名字"的那一面静默按未配置办事。修法是两个面共用
 * `src/utils/n8n-env.ts` 这一份出口,且**各自主名优先**(⇒ 主名在位时现网指向不变)。
 *
 * 因此本文件的用例分三组,每组都配反向对照(只测"别名生效"而不测"主名不变",
 * 就等于允许一次偷偷的契约迁移):
 *   A 纯函数判据:优先级、空白视为未配置、scheme 归一、空主机不产出坏 URL。
 *   B /ai/n8n 面(n8n-proxy.ts):别名在位 ⇒ 真的朝那个上游发请求;两名字都不在位
 *     ⇒ 503 **且一次 fetch 都没发生**(§5:失败用例必须断言副作用没发生,
 *     只断言状态码会放过"先打了上游再抛 503"那种写法)。
 *   C /api/ai/n8n/workflows 面(proxy-tools.ts 的 GET 列表):同一型,走 fetchWithTimeout 出口。
 *   D 唯一出口的反向锁:两个路由文件里不得再直接读 process.env.N8N_DOMAIN / N8N_BASE_URL
 *     —— 别名清单一旦在调用点被重新发明,B/C 两组就只是在守一份会腐烂的抄本。
 * 全程不连库、不发网络(vi.mock 掉 db/_shared/ssrf;§5 测试隔离铁律)。
 */
import { readFileSync } from 'node:fs'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// vi.mock 的工厂会在被提升的 import 求值期执行,所以工厂引用的东西一律经 vi.hoisted 建
// (顶层 const 在那个时刻还在 TDZ —— 报出来的错与判据无关,只会浪费下一轮)。
const {
  fetchWithTimeoutMock,
  globalFetchMock,
  fromChainMock,
  insertValuesChainMock,
  updateSetChainMock,
} = vi.hoisted(() => {
  const where = vi.fn(async () => [])
  return {
    fetchWithTimeoutMock: vi.fn(),
    globalFetchMock: vi.fn(),
    whereChainMock: where,
    fromChainMock: vi.fn(() => ({ where })),
    insertValuesChainMock: vi.fn(async () => undefined),
    updateSetChainMock: vi.fn(() => ({ where })),
  }
})

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:5432/test',
    DATABASE_READ_REPLICA_URL: '',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-for-vitest-at-least-32-chars',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
  },
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: async (request: { userId?: string }) => {
    request.userId = 'probe-user'
  },
  checkAuth: async () => true,
}))

// n8n-proxy 与 proxy-tools 都过 SSRF 闸;这里放行是为了让"发到哪个 URL"成为可断言的事实,
// 而不是被闸挡在断言之前(SSRF 自身的判据由 ssrf-guard 的测试守,不在本票射程)。
vi.mock('../src/utils/ssrf-guard.js', () => ({
  ensureSafeFetchUrl: async () => undefined,
  assertSafeFetchUrl: async () => ({ safe: true }),
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    execute: vi.fn(async () => []),
    insert: vi.fn(() => ({ values: insertValuesChainMock })),
    update: vi.fn(() => ({ set: updateSetChainMock })),
    select: vi.fn(() => ({ from: fromChainMock })),
  },
}))

vi.mock('../src/db/video-task-queries.js', () => ({
  createVideoTask: vi.fn(async () => undefined),
  findVideoTasksByUser: vi.fn(async () => []),
  findVideoTaskById: vi.fn(async () => null),
  updateVideoTask: vi.fn(async () => undefined),
}))

// 只替掉两个"会出网/要厂商配置"的出口,schema 与其余 helper 用原实现
// (整块替身会把路由注册期用到的 z 对象一起换掉,那时红的是夹具不是判据)。
vi.mock('../src/routes/ai-vendors/_shared.js', async (importOriginal) => {
  // 仓内既有写法(auth-extended.test.ts:27):cast 成 Record 而不是 import() 类型
  // (本仓 eslint 禁 `import()` type annotations)。
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    requireAuth: async () => true,
    requireVendorKey: () => 'test-n8n-vendor-key',
    requireVendorKeys: () => ({ key: 'test-n8n-vendor-key', secret: 'test-secret' }),
    fetchWithTimeout: (...args: unknown[]) => fetchWithTimeoutMock(...args),
  }
})

import { n8nProxyRoutes } from '../src/routes/n8n-proxy.js'
import { toolsVendorRoutes } from '../src/routes/ai-vendors/proxy-tools.js'
import {
  readN8nBaseUrl,
  readN8nCredentials,
  toN8nOrigin,
  n8nBaseHint,
  n8nNotConfiguredHint,
  N8N_BASE_URL_ALIASES,
} from '../src/utils/n8n-env.js'

const NAMES = ['N8N_DOMAIN', 'N8N_BASE_URL', 'N8N_API_KEY'] as const

function clearN8nEnv() {
  for (const n of NAMES) delete process.env[n]
}

/** 上游回一个可读的工作流对象,够 fetch-merge-put 走完两跳。 */
function stubUpstreamOk(payload: Record<string, unknown> = { id: 'wf-1', name: 'old' }) {
  globalFetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => payload })
  fetchWithTimeoutMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ data: [payload] }),
  })
}

const urlsOfGlobalFetch = () =>
  globalFetchMock.mock.calls.map((c) => String((c as unknown[])[0]) as string)
const urlsOfFetchWithTimeout = () => fetchWithTimeoutMock.mock.calls.map((c) => String(c[0]))

describe('A. n8n 基址唯一出口的判据(纯函数)', () => {
  it('别名清单就是这两个名字,且顺序不影响"主名优先"', () => {
    expect([...N8N_BASE_URL_ALIASES].sort()).toEqual(['N8N_BASE_URL', 'N8N_DOMAIN'])
  })

  it('primary 已配 ⇒ 用 primary,别名不得翻盘(两名字同时在位且取值不同)', () => {
    const env = { N8N_DOMAIN: 'primary-host.example', N8N_BASE_URL: 'alias-host.example' }
    expect(readN8nBaseUrl('N8N_DOMAIN', env)).toEqual({
      origin: 'https://primary-host.example',
      source: 'N8N_DOMAIN',
    })
    // 另一面的主名是 N8N_BASE_URL ⇒ 同一份 env 落另一个值 —— 这正是"主名优先"双向锁:
    // 任何一侧被改成固定顺序,其中一条必红。
    expect(readN8nBaseUrl('N8N_BASE_URL', env)).toEqual({
      origin: 'https://alias-host.example',
      source: 'N8N_BASE_URL',
    })
  })

  it('primary 缺失 ⇒ 别名兜底,并报名来源(排障要能说出用的是哪个变量)', () => {
    expect(readN8nBaseUrl('N8N_DOMAIN', { N8N_BASE_URL: 'only-alias.example' })).toEqual({
      origin: 'https://only-alias.example',
      source: 'N8N_BASE_URL',
    })
    expect(readN8nBaseUrl('N8N_BASE_URL', { N8N_DOMAIN: 'only-alias2.example' })).toEqual({
      origin: 'https://only-alias2.example',
      source: 'N8N_DOMAIN',
    })
  })

  it('两个名字都没配 / 只有空白 ⇒ null(未配置档由调用点决定,不产出坏 URL)', () => {
    expect(readN8nBaseUrl('N8N_DOMAIN', {})).toBeNull()
    expect(readN8nBaseUrl('N8N_DOMAIN', { N8N_DOMAIN: '   ', N8N_BASE_URL: '' })).toBeNull()
  })

  it('scheme 归一:裸主机补 https;已带协议照原样(不静默把 http 翻成 https)', () => {
    expect(toN8nOrigin('n8n.example')).toBe('https://n8n.example')
    expect(toN8nOrigin('https://n8n.example')).toBe('https://n8n.example')
    expect(toN8nOrigin('http://127.0.0.1:5678')).toBe('http://127.0.0.1:5678')
    expect(toN8nOrigin('  https://n8n.example  ')).toBe('https://n8n.example')
  })

  it('尾斜杠(含多个)一律剥净 ⇒ 调用点不必再各自 replace', () => {
    expect(toN8nOrigin('https://n8n.example///')).toBe('https://n8n.example')
    expect(toN8nOrigin('n8n.example/')).toBe('https://n8n.example')
  })

  it('只剩协议或全斜杠的值视为未配置(放过去只会产出必失败的 URL)', () => {
    expect(toN8nOrigin('///')).toBeNull()
    expect(toN8nOrigin('http://')).toBeNull()
    expect(readN8nBaseUrl('N8N_DOMAIN', { N8N_DOMAIN: 'http://' })).toBeNull()
  })

  it('credentials:基址与 N8N_API_KEY 必须同时在位才算已配置;key 去首尾空白', () => {
    expect(readN8nCredentials('N8N_DOMAIN', { N8N_DOMAIN: 'a.example' })).toBeNull()
    expect(readN8nCredentials('N8N_DOMAIN', { N8N_API_KEY: 'k' })).toBeNull()
    expect(
      readN8nCredentials('N8N_DOMAIN', { N8N_BASE_URL: 'b.example', N8N_API_KEY: ' k9 ' }),
    ).toEqual({ origin: 'https://b.example', source: 'N8N_BASE_URL', apiKey: 'k9' })
  })

  it('运维文案由同一份清单产出:主名 + 别名都点名,不会一处列全一处列半', () => {
    expect(n8nBaseHint('N8N_BASE_URL')).toBe('N8N_BASE_URL(或别名 N8N_DOMAIN)')
    expect(n8nBaseHint('N8N_DOMAIN')).toBe('N8N_DOMAIN(或别名 N8N_BASE_URL)')
    expect(n8nNotConfiguredHint('N8N_DOMAIN')).toContain('N8N_BASE_URL')
    expect(n8nNotConfiguredHint('N8N_DOMAIN')).toContain('N8N_API_KEY')
  })
})

describe('B. /ai/n8n 面(n8n-proxy.ts,主名 N8N_DOMAIN)', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    clearN8nEnv()
    globalFetchMock.mockReset()
    fetchWithTimeoutMock.mockReset()
    stubUpstreamOk()
    vi.stubGlobal('fetch', globalFetchMock)
    app = Fastify()
    await app.register(n8nProxyRoutes, { prefix: '/api' })
    await app.ready()
  })
  afterEach(async () => {
    await app.close()
    vi.unstubAllGlobals()
    clearN8nEnv()
  })

  it('只配别名 N8N_BASE_URL ⇒ PUT 不再被判未配置,且请求真发到那个上游', async () => {
    process.env.N8N_BASE_URL = 'https://alias-only.example'
    process.env.N8N_API_KEY = 'alias-key'
    const res = await app.inject({
      method: 'PUT',
      url: '/api/ai/n8n/workflows/wf-1',
      payload: { name: 'new-name' },
    })
    expect(res.statusCode).toBe(200)
    // fetch-merge-put:先读现件再 PUT 回,两跳都必须落在别名主机上
    expect(urlsOfGlobalFetch()).toEqual([
      'https://alias-only.example/api/v1/workflows/wf-1',
      'https://alias-only.example/api/v1/workflows/wf-1',
    ])
    expect(String(globalFetchMock.mock.calls[1]?.[1]?.method)).toBe('PUT')
  })

  it('主名 N8N_DOMAIN 在位时取值与改动前同一指向(别名不得翻盘)', async () => {
    process.env.N8N_DOMAIN = 'primary-only.example'
    process.env.N8N_API_KEY = 'primary-key'
    const res = await app.inject({
      method: 'POST',
      url: '/api/ai/n8n/workflows/wf-1/toggle',
      payload: { active: true },
    })
    expect(res.statusCode).toBe(200)
    expect(urlsOfGlobalFetch()[0]).toBe(
      'https://primary-only.example/api/v1/workflows/wf-1/activate',
    )
  })

  it('两名字同时在位 ⇒ 本面仍发往主名 N8N_DOMAIN(别名不得改变现网指向)', async () => {
    process.env.N8N_DOMAIN = 'primary-host.example'
    process.env.N8N_BASE_URL = 'other-host.example'
    process.env.N8N_API_KEY = 'both-key'
    const res = await app.inject({
      method: 'POST',
      url: '/api/ai/n8n/workflows/wf-1/toggle',
      payload: { active: false },
    })
    expect(res.statusCode).toBe(200)
    expect(urlsOfGlobalFetch()[0]).toBe(
      'https://primary-host.example/api/v1/workflows/wf-1/deactivate',
    )
    expect(urlsOfGlobalFetch().join(' ')).not.toContain('other-host.example')
  })

  it('两名字都不在位 ⇒ 503,且一次上游请求都没发(副作用没发生)', async () => {
    process.env.N8N_API_KEY = 'key-without-any-base'
    const res = await app.inject({
      method: 'PUT',
      url: '/api/ai/n8n/workflows/wf-1',
      payload: { name: 'x' },
    })
    expect(res.statusCode).toBe(503)
    expect(globalFetchMock).not.toHaveBeenCalled()
    // 未配置档必须是"可读的失败",而不是空 body —— 客户端只拿 message 显示(API-客户端
    // deriveFailureFromBody 优先取 message),所以这一格是到用户的最后一道可解释性。
    const body = res.json() as { code?: number; message?: string }
    expect(typeof body.message).toBe('string')
    expect((body.message ?? '').length).toBeGreaterThan(0)
    expect(body.message).toContain('N8N_DOMAIN')
    expect(body.message).toContain('N8N_BASE_URL')
  })

  it('只配基址没有 key ⇒ 仍判未配置(与条件不得因别名而被放宽成"任一在位即可")', async () => {
    process.env.N8N_BASE_URL = 'https://alias-only.example'
    const res = await app.inject({
      method: 'POST',
      url: '/api/ai/n8n/workflows/wf-1/toggle',
      payload: { active: false },
    })
    expect(res.statusCode).toBe(503)
    expect(globalFetchMock).not.toHaveBeenCalled()
  })
})

describe('C. /api/ai/n8n/workflows 列表面(ai-vendors/proxy-tools.ts,主名 N8N_BASE_URL)', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    clearN8nEnv()
    globalFetchMock.mockReset()
    fetchWithTimeoutMock.mockReset()
    stubUpstreamOk()
    app = Fastify()
    await app.register(toolsVendorRoutes, { prefix: '/api/ai' })
    await app.ready()
  })
  afterEach(async () => {
    await app.close()
    clearN8nEnv()
  })

  it('只配别名 N8N_DOMAIN ⇒ GET 列表不再 503,且 URL 补好了 scheme(裸主机不会拼成无协议 URL)', async () => {
    process.env.N8N_DOMAIN = 'alias-domain-only.example'
    process.env.N8N_API_KEY = 'alias-key'
    const res = await app.inject({ method: 'GET', url: '/api/ai/n8n/workflows' })
    expect(res.statusCode).toBe(200)
    // 这一条同时是本票"别名必须补 scheme"的锁:少补一次就得到
    // `alias-domain-only.example/api/v1/...` 这种 fetch 必抛的 URL。
    expect(urlsOfFetchWithTimeout()).toEqual([
      'https://alias-domain-only.example/api/v1/workflows?active=true',
    ])
  })

  it('主名 N8N_BASE_URL 在位时 URL 逐字与改动前一致(含其自带协议与尾斜杠归一)', async () => {
    process.env.N8N_BASE_URL = 'https://primary-base.example/'
    process.env.N8N_API_KEY = 'primary-key'
    const res = await app.inject({ method: 'GET', url: '/api/ai/n8n/workflows' })
    expect(res.statusCode).toBe(200)
    expect(urlsOfFetchWithTimeout()).toEqual([
      'https://primary-base.example/api/v1/workflows?active=true',
    ])
  })

  it('两名字同时在位 ⇒ 列表面仍发往主名 N8N_BASE_URL(与 B 面同规则、反向取值)', async () => {
    process.env.N8N_DOMAIN = 'other-host.example'
    process.env.N8N_BASE_URL = 'https://primary-base.example'
    process.env.N8N_API_KEY = 'both-key'
    const res = await app.inject({ method: 'GET', url: '/api/ai/n8n/workflows' })
    expect(res.statusCode).toBe(200)
    expect(urlsOfFetchWithTimeout()).toEqual([
      'https://primary-base.example/api/v1/workflows?active=true',
    ])
    expect(urlsOfFetchWithTimeout().join(' ')).not.toContain('other-host.example')
  })

  it('两名字都不在位 ⇒ 503 且未发起任何上游请求;失败体带可读 message', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/ai/n8n/workflows' })
    expect(res.statusCode).toBe(503)
    expect(fetchWithTimeoutMock).not.toHaveBeenCalled()
    const body = res.json() as { code?: number; message?: string }
    expect(body.code).toBe(503)
    expect(typeof body.message).toBe('string')
    expect((body.message ?? '').length).toBeGreaterThan(0)
  })

  it('POST 同名路由仍是"凭据从请求体传入的查询",本票未改动其对外语义(现状登记,非合格证)', async () => {
    // 客户端 createN8nWorkflow 发的是 {name,description},而这条路由要 n8nDomain+apiKey,
    // 于是必落 400。这里钉的是"本票没有偷偷改变这条行为"——它仍然是 issue #71 的
    // 待裁半件(统一成创建属对外契约决策,归该面持有者),不得被读成已经修好。
    process.env.N8N_DOMAIN = 'alias-domain-only.example'
    process.env.N8N_API_KEY = 'alias-key'
    const res = await app.inject({
      method: 'POST',
      url: '/api/ai/n8n/workflows',
      payload: { name: 'x', description: 'y' },
    })
    expect(res.statusCode).toBe(400)
    expect(fetchWithTimeoutMock).not.toHaveBeenCalled()
  })
})

describe('D. 唯一出口的反向锁:别名清单不得在调用点被重新发明', () => {
  const read = (rel: string) =>
    readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/^(\/\/|\/\*|\*).*$/gm, (m) =>
      m.replace(/[^\n]/g, ' '),
    )

  it('两个路由文件都不再直接读 process.env.N8N_DOMAIN / N8N_BASE_URL', () => {
    for (const rel of [
      '../src/routes/n8n-proxy.ts',
      '../src/routes/ai-vendors/proxy-tools.ts',
    ] as const) {
      const src = read(rel)
      expect({
        file: rel,
        hits: src.match(/process\.env\.N8N_(?:DOMAIN|BASE_URL)/g) ?? [],
      }).toEqual({ file: rel, hits: [] })
    }
  })

  it('两个路由文件都真的 import 了那份出口(引了不用等于没引)', () => {
    for (const rel of [
      '../src/routes/n8n-proxy.ts',
      '../src/routes/ai-vendors/proxy-tools.ts',
    ] as const) {
      expect(read(rel)).toMatch(/from '\.\.?\/(\.\.\/)?utils\/n8n-env\.js'/)
    }
  })

  it('出口自身不读工作树/磁盘以外的事物:基址只从传入的 env 取(纯函数,可注入)', () => {
    const src = readFileSync(new URL('../src/utils/n8n-env.ts', import.meta.url), 'utf8')
    expect(src).not.toMatch(/readFileSync|node:fs/)
    expect(src).toMatch(/env: NodeJS\.ProcessEnv = process\.env/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
