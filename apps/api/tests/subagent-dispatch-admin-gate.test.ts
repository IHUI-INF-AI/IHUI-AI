// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 存续锁:subagent 派单面按 merge 后的 user-scoped 语义收口(origin 890d38bb6bd)——
// 创建端点必须落 ownerUserId;全部读/控制端点必须捕获 request.userId 并按归属过滤;
// 按 id 端点的归属闸必须落在**该端点任何 service 调用之前**(先改状态再判归属 =
// 返回 404 却暗地里取消了别人的派单)。
//
// 2026-11-02 重写(P0-2 统一到 ownsDispatchById 之后):不再断言"源码里出现某个字符串",
// 而是三条结构性判据 + 运行时行为:
//  (a) 每个按 id 端点里 `ownsDispatchById(...)` 的首次出现位置 < 该端点任何
//      `subagentDispatchService.*` 调用(结构上证明闸在 service 前);
//  (b) `ownsDispatchById`/`isDispatchVisibleTo` 由 utils/dispatch-ownership.ts 唯一导出,
//      路由目录内不得出现本地定义或 `ownerUserId === userId` 式另写;
//  (c) 跨租户用例真实建 Fastify 实例跑:非本人请求 404 且 service 零调用,本人请求放行
//      ——删掉闸会同时打红 (a) 与 (c),不是"换掉字符串还能绿"。
// 任一项回退,本锁必须红。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import Fastify, { type FastifyInstance } from 'fastify'

const SRC = readFileSync(new URL('../src/routes/subagent-dispatch.ts', import.meta.url), 'utf8')
const OWNERSHIP_SRC = readFileSync(
  new URL('../src/utils/dispatch-ownership.ts', import.meta.url),
  'utf8',
)
const ROUTES_DIR = new URL('../src/routes/', import.meta.url)

vi.hoisted(() => {
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// 两个租户靠请求头切换:authenticate 把 request.userId 写成 x-probe-user(缺省 tenant-a)
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: async (request: { userId?: string; headers: Record<string, unknown> }) => {
    const raw = request.headers['x-probe-user']
    request.userId = typeof raw === 'string' && raw.length > 0 ? raw : 'tenant-a'
  },
  checkAuth: async () => true,
}))

const mocks = vi.hoisted(() => ({
  store: new Map<string, Record<string, unknown>>(),
  cancelMock: vi.fn(),
  resumeMock: vi.fn(),
  attentionMock: vi.fn(),
  artifactMock: vi.fn(),
  statsMock: vi.fn(),
}))

vi.mock('../src/services/subagent-dispatch-service.js', () => ({
  subagentDispatchService: {
    setRedisClient: async () => undefined,
    findById: (id: string) => mocks.store.get(id) ?? null,
    cancel: mocks.cancelMock,
    resume: mocks.resumeMock,
    setAttention: mocks.attentionMock,
    getArtifact: mocks.artifactMock,
    getDispatchStats: mocks.statsMock,
    getDag: () => null,
    getQuotas: () => null,
    getMessages: () => [],
    listActive: () => [],
    listAll: () => [],
    getTopology: () => ({ nodes: [], edges: [] }),
    getStats: () => ({}),
    getQueue: async () => [],
  },
}))

vi.mock('../src/db/agent-queries.js', () => ({
  findAgentById: async () => null,
  findAgentTasksByAgentId: async () => [],
}))

import { subagentDispatchRoutes } from '../src/routes/subagent-dispatch.js'

/** 按路由声明行截取该端点函数体(到下一个路由声明或文件尾)。 */
function routeBody(src: string, route: string): string | null {
  const anchor = `('${route}'`
  const start = src.indexOf(anchor)
  if (start === -1) return null
  const next = src.slice(start + anchor.length).search(/server\.(get|post|put|delete)\(/)
  return next === -1 ? src.slice(start) : src.slice(start, start + anchor.length + next)
}

/**
 * (a) 结构判据:该端点必须调用 readsFromOwnershipGate,且**每一次** service 调用的
 * 位置都排在闸之后。没有 service 调用也算不满足(端点没接上真实动作)。
 */
function gateBeforeEveryServiceCall(body: string): boolean {
  const guardAt = body.indexOf('ownsDispatchById(')
  if (guardAt === -1) return false
  const serviceCalls = [...body.matchAll(/subagentDispatchService\.\w+/g)]
  return serviceCalls.length > 0 && serviceCalls.every((m) => (m.index ?? -1) > guardAt)
}

/**
 * (b) 结构判据:本地另写归属判据(函数/常量定义)。
 * 只认归属谓词的两个名字 —— 其它领域(如自定义角色)的 `role.ownerUserId === userId`
 * 是各自业务的主权判据,不属于派单归属,不能一并误杀。
 */
function hasLocalOwnershipPredicate(src: string): boolean {
  return /(?:function|const|let)\s+(?:ownsDispatchById|isDispatchVisibleTo)\s*[=(]/.test(src)
}

/**
 * 从 import 语句取具名导入集合(对换行/缩进稳健)。
 *
 * 2026-11-03 立:本文件的 `import { isAdminViewer, isDispatchVisibleTo, ownsDispatchById }
 * from '../utils/dispatch-ownership.js'` 是多行写法,旧判据按**单行** find 只会命中
 * 收尾行 `} from ...`,自然取不到成员名 —— 判据形同虚设。这里按整条 import 语句
 * (跨行匹配花括号内成员)解析,模块路径仍按字面量精确匹配;语句缺失返回 null。
 */
function namedImportsFrom(src: string, modulePath: string): string[] | null {
  const escaped = modulePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(String.raw`import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*(['"])${escaped}\2`)
  const m = re.exec(src)
  if (!m) return null
  return m[1]!
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => s.split(/\s+as\s+/)[0]!.trim())
}

const BY_ID_ROUTES = [
  '/subagents/:id/cancel',
  '/subagents/:id/resume',
  '/subagents/:id/attention',
  '/subagents/:id/stats',
  '/subagents/:id/artifacts/:stepId',
  '/subagents/:id/dag',
  '/subagents/:id/quotas',
  '/subagents/:id/messages',
]

const USER_SCOPED_ROUTES = [
  '/subagents/active',
  '/subagents/all',
  '/subagents/:id/cancel',
  '/subagents/:id/resume',
  '/subagents/:id/attention',
  '/subagents/topology',
  '/subagents/stats',
  '/subagents/queue',
  '/subagents/by-agent/:agentId/summary',
  '/subagents/:id/stats',
  '/subagents/:id/artifacts/:stepId',
  '/subagents/:id/dag',
  '/subagents/:id/quotas',
  '/subagents/:id/messages',
]

describe('subagent 派单面 user-scoped 归属存续锁(结构层)', () => {
  it('创建端点 POST /subagents/dispatch 必须落 ownerUserId(归属的写入源头)', () => {
    const body = routeBody(SRC, '/subagents/dispatch')
    expect(body).not.toBeNull()
    expect(body!).toContain('requireAuth')
    expect(body!).toContain('ownerUserId: request.userId')
  })

  it('14 个读/控制端点全部捕获 request.userId 并判空(归属过滤的前提)', () => {
    for (const route of USER_SCOPED_ROUTES) {
      const body = routeBody(SRC, route)
      expect(body, `路由 ${route} 应存在于源文件`).not.toBeNull()
      expect(body, `${route} 应捕获 request.userId`).toContain('request.userId')
    }
  })

  it('(a) 8 个按 id 端点的归属闸必须先于该端点任何 service 调用', () => {
    for (const route of BY_ID_ROUTES) {
      const body = routeBody(SRC, route)
      expect(body, `路由 ${route} 应存在于源文件`).not.toBeNull()
      expect(
        gateBeforeEveryServiceCall(body!),
        `${route} 的 ownsDispatchById 必须排在所有 subagentDispatchService 调用之前`,
      ).toBe(true)
    }
  })

  it('(b) 判据来自 dispatch-ownership 的唯一导出,路由目录内不得另写', () => {
    const imported = namedImportsFrom(SRC, '../utils/dispatch-ownership.js')
    expect(imported, '路由必须从唯一出口导入判据').not.toBeNull()
    expect(imported!, '路由必须从唯一出口导入 ownsDispatchById').toContain('ownsDispatchById')
    expect(imported!, '路由必须从唯一出口导入 isDispatchVisibleTo').toContain('isDispatchVisibleTo')

    // 变异自证:把 ownsDispatchById 从具名导入里摘掉 ⇒ 同一判据必须判否
    // (防止解析器退化成"只要存在 import 语句就算过")
    const withoutOwns = SRC.replace(
      /import\s*\{[^}]*\}\s*from\s*'\.\.\/utils\/dispatch-ownership\.js'/,
      (stmt) => stmt.replace(/,\s*ownsDispatchById/, ''),
    )
    expect(withoutOwns, '摘导入没摘到东西 ⇒ 这一格不成对照').not.toBe(SRC)
    const mutatedImports = namedImportsFrom(withoutOwns, '../utils/dispatch-ownership.js')
    expect(mutatedImports, '变异体仍应有该 import 语句').not.toBeNull()
    expect(mutatedImports!).not.toContain('ownsDispatchById')
    expect(mutatedImports!).toContain('isDispatchVisibleTo')

    // 主路由内也不许用 `dispatch.ownerUserId === userId` 另写一份归属表达
    expect(SRC).not.toMatch(/\.ownerUserId\s*[!=]==\s*userId/)

    // 唯一出口自身必须仍然是导出实现
    expect(OWNERSHIP_SRC).toMatch(/export function ownsDispatchById\(/)
    expect(OWNERSHIP_SRC).toMatch(/export function isDispatchVisibleTo\(/)

    // 路由目录下任何文件都不得再定义一份(或直接比较 ownerUserId 另写表达)
    const routeFiles = readdirSync(ROUTES_DIR).filter((f) => f.endsWith('.ts'))
    expect(routeFiles.length).toBeGreaterThan(0)
    for (const file of routeFiles) {
      const src = readFileSync(new URL(file, ROUTES_DIR), 'utf8')
      expect(hasLocalOwnershipPredicate(src), `${file} 不得另写归属判据`).toBe(false)
    }
  })

  it('全局聚合端点必须按 isDispatchVisibleTo 过滤(否则跨租户读全站派单)', () => {
    for (const route of [
      '/subagents/active',
      '/subagents/all',
      '/subagents/topology',
      '/subagents/queue',
    ]) {
      const body = routeBody(SRC, route)
      expect(body, `路由 ${route} 应存在于源文件`).not.toBeNull()
      expect(body!, `${route} 应含 isDispatchVisibleTo 归属过滤`).toContain('isDispatchVisibleTo')
    }
  })
})

describe('subagent 派单面 user-scoped 归属存续锁(跨租户行为层)', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    mocks.store.clear()
    mocks.cancelMock.mockReset()
    mocks.resumeMock.mockReset()
    mocks.attentionMock.mockReset()
    mocks.artifactMock.mockReset()
    mocks.statsMock.mockReset()
    mocks.store.set('b-1', { id: 'b-1', status: 'running', ownerUserId: 'tenant-b' })
    app = Fastify()
    await app.register(subagentDispatchRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
  })

  it('(c) 非本人请求 4 个按 id 端点一律 404,且 service 零调用(闸在 service 之前)', async () => {
    const asTenantA = { 'x-probe-user': 'tenant-a' }

    const cases: Array<{ method: 'GET' | 'POST'; url: string; payload?: object }> = [
      { method: 'POST', url: '/api/subagents/b-1/cancel' },
      { method: 'POST', url: '/api/subagents/b-1/resume' },
      {
        method: 'POST',
        url: '/api/subagents/b-1/attention',
        payload: { attention: 'awaiting_answer' },
      },
      { method: 'GET', url: '/api/subagents/b-1/artifacts/a' },
      { method: 'GET', url: '/api/subagents/b-1/stats' },
    ]

    for (const item of cases) {
      const res = await app.inject({
        method: item.method,
        url: item.url,
        headers: asTenantA,
        ...(item.payload === undefined ? {} : { payload: item.payload }),
      })
      expect(res.statusCode, `${item.method} ${item.url} 跨租户必须 404`).toBe(404)
    }

    expect(mocks.cancelMock).not.toHaveBeenCalled()
    expect(mocks.resumeMock).not.toHaveBeenCalled()
    expect(mocks.attentionMock).not.toHaveBeenCalled()
    expect(mocks.artifactMock).not.toHaveBeenCalled()
    expect(mocks.statsMock).not.toHaveBeenCalled()
  })

  it('(c) 本人请求闸放行(不是一刀切拒绝),且 service 收到正确参数', async () => {
    const asTenantB = { 'x-probe-user': 'tenant-b' }

    mocks.cancelMock.mockReturnValue(true)
    const cancelRes = await app.inject({
      method: 'POST',
      url: '/api/subagents/b-1/cancel',
      headers: asTenantB,
    })
    expect(cancelRes.statusCode).toBe(200)
    expect(mocks.cancelMock).toHaveBeenCalledTimes(1)
    expect(mocks.cancelMock).toHaveBeenCalledWith('b-1')

    mocks.attentionMock.mockResolvedValue({
      ok: true,
      dispatch: { id: 'b-1', status: 'running', attention: 'awaiting_answer' },
    })
    const attentionRes = await app.inject({
      method: 'POST',
      url: '/api/subagents/b-1/attention',
      headers: asTenantB,
      payload: { attention: 'awaiting_answer' },
    })
    expect(attentionRes.statusCode).toBe(200)
    expect(mocks.attentionMock).toHaveBeenCalledWith('b-1', 'awaiting_answer')

    mocks.artifactMock.mockResolvedValue({
      id: 'b-1:a',
      dispatchId: 'b-1',
      stepId: 'a',
      content: '全文',
      truncated: false,
      createdAt: '2026-11-02T00:00:00Z',
    })
    const artifactRes = await app.inject({
      method: 'GET',
      url: '/api/subagents/b-1/artifacts/a',
      headers: asTenantB,
    })
    expect(artifactRes.statusCode).toBe(200)
    expect(
      (artifactRes.json() as { data: { artifact: { content: string } } }).data.artifact.content,
    ).toBe('全文')
    expect(mocks.artifactMock).toHaveBeenCalledWith('b-1', 'a')
  })
})

describe('判据变异自证(同一函数跑变异体必须失败)', () => {
  it('删掉 cancel 的闸 ⇒ (a) 判据为 false', () => {
    // 闸的第三参是管理员档(isAdminViewer),正则容忍该可选参数 —— 否则 D1 收紧后
    // 变异体静默替换失败,这个反向例就变成永远绿的摆设。
    const GATE_BLOCK =
      /\n\s*if \(!ownsDispatchById\(id, userId(?:, [^\n]*)?\)\) \{\n\s*return reply\.status\(404\)\.send\(error\(404, [^\n]*\)\)\n\s*\}/
    const withoutGate = SRC.replace(GATE_BLOCK, '\n')
    expect(withoutGate).not.toBe(SRC)
    const body = routeBody(withoutGate, '/subagents/:id/cancel')
    expect(body).not.toBeNull()
    expect(gateBeforeEveryServiceCall(body!)).toBe(false)
  })

  it('本地另写一份输出恒真的 ownsDispatchById ⇒ (b) 判据为 true', () => {
    const localStub = SRC.replace(
      /import \{[^}]*\} from '\.\.\/utils\/dispatch-ownership\.js'/,
      "import { isDispatchVisibleTo } from '../utils/dispatch-ownership.js'\nconst ownsDispatchById = (_id: string, _userId: string) => true",
    )
    expect(localStub).not.toBe(SRC)
    expect(hasLocalOwnershipPredicate(localStub)).toBe(true)
  })
})

describe('跨租户专用回归用例仍在', () => {
  it('归属 / attention / artifacts 三个跨租户用例文件未被删除', () => {
    for (const file of [
      'subagents-id-ownership.test.ts',
      'subagents-attention-route-scope.test.ts',
      'subagents-artifact-route-scope.test.ts',
    ]) {
      const src = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8')
      expect(src, `${file} 应保留跨租户切换手法`).toContain('x-probe-user')
      expect(src, `${file} 应至少有一个用例`).toMatch(/it\(/)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
