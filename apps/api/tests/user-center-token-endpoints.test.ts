// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 两个"用户口径统计/余额"端点的离线契约回归(2026-09-27,不连库)。
//
// 立因:`packages/api-client` 的 getTokenBalance() / getUserStatistics() 自写下起分别打
// `/api/user/token-balance` 与 `/api/statistics/user-center`,而这两条路由**从未存在过**
// (实测 404,同前缀兄弟路由回 401)。后果是 mobile-rn 的"智汇值"卡读 `res.data.balance`
// 且失败保持 0 ⇒ 界面恒显 0,而守门 8/73 全绿 —— 因为提交链里没有一道门把"端声明的路径"
// 与"后端注册的路径"对齐(门 127 的 E2 不认 fetchApi 形状,已另计票)。
//
// 本文件钉三件事:① 响应字段与 api-client 的类型逐一对齐(缺一个字段前端就静默 0);
// ② 未登录必须 401(不得 fail-open);③ 统计口径取**令牌主体**,不受请求参数影响。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const USER_ID = '22222222-2222-4222-8222-222222222222'
const OTHER_ID = '33333333-3333-4333-8333-333333333333'

const { authState } = vi.hoisted(() => ({ authState: { userId: undefined as string | undefined } }))

vi.mock('../src/plugins/auth.js', () => ({
  // 返回 true 并把令牌主体挂到 request.userId —— 与真实 authenticate 的对外契约同形
  authenticate: async (request: { userId?: string }) => {
    if (!authState.userId) throw Object.assign(new Error('请先登录'), { statusCode: 401 })
    request.userId = authState.userId
    return { id: authState.userId }
  },
  checkAuth: async (request: { userId?: string }, _reply: unknown) => {
    if (!authState.userId) return false
    request.userId = authState.userId
    return true
  },
}))

// 查询层只覆盖"本测试要注入的那几个函数",其余保持原样:
// Proxy 当模块命名空间会让 vitest 自己在内部取 Symbol 时炸(Cannot create proxy with a non-object),
// 而整体替换又要列全 statistics.ts 从这些模块具名导入的每个函数 —— 列不全就是"测试自己造出来的假失败"。
// 写成 4 条显式 vi.mock(vitest 要求它在顶层才会被提升;包进辅助函数里就不生效)。
vi.mock('../src/db/commission-queries.js', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  getBalance: async () => 1234,
  getTokenFlowTotals: async () => ({ totalEarned: 9000, totalUsed: 7766 }),
}))
vi.mock('../src/db/social-queries.js', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  countFollowing: async (id: string) => (id === USER_ID ? 7 : 0),
  countFollowers: async (id: string) => (id === USER_ID ? 21 : 0),
  countFavorites: async (id: string) => (id === USER_ID ? 3 : 0),
}))
vi.mock('../src/db/gamification-queries.js', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  findUserPoints: async () => ({ points: 55 }),
}))
vi.mock('../src/db/statistics-queries.js', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  getUserCenterStats: async () => ({ courseCount: 12, studyHours: 3.4 }),
}))
vi.mock('../src/db/index.js', () => ({
  db: { select: vi.fn(() => ({})), update: vi.fn(() => ({})), insert: vi.fn(() => ({})) },
  dbRead: { select: vi.fn(() => ({})) },
}))

// 被 mock 的模块在测试里要拿到"同一份桩",vi.mock 提升后只能靠动态 import
async function withRoute(register: (app: FastifyInstance) => Promise<void>): Promise<FastifyInstance> {
  const app = Fastify()
  await register(app)
  await app.ready()
  return app
}

describe('GET /api/user/token-balance 与 /api/statistics/user-center', () => {
  beforeEach(() => {
    authState.userId = undefined
  })

  it('未登录 ⇒ 两条都是 401,不得 fail-open', async () => {
    const { userExtraRoutes } = await import('../src/routes/user-extras.js')
    const { statisticsRoutes } = await import('../src/routes/statistics.js')
    const a = await withRoute(async (app) => {
      void app.register(userExtraRoutes, { prefix: '/api/user' })
    })
    const r1 = await a.inject({ method: 'GET', url: '/api/user/token-balance' })
    expect(r1.statusCode).toBe(401)

    const b = await withRoute(async (app) => {
      void app.register(statisticsRoutes, { prefix: '/api' })
    })
    const r2 = await b.inject({ method: 'GET', url: '/api/statistics/user-center' })
    expect(r2.statusCode).toBe(401)
  })

  it('登录后:token-balance 的字段与 TokenBalance 契约逐一对齐', async () => {
    authState.userId = USER_ID
    const { userExtraRoutes } = await import('../src/routes/user-extras.js')
    const app = await withRoute(async (a) => {
      void a.register(userExtraRoutes, { prefix: '/api/user' })
    })
    const res = await app.inject({ method: 'GET', url: '/api/user/token-balance' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    // 本仓统一信封的"成功"是 code: 0(不是 HTTP 200)—— 见 apps/api/src/utils/response.ts:22
    expect(body.code).toBe(0)
    // 前端读的是 data.balance(AgentScreen 失败保持 0 就是这里缺字段造成的静默失真)
    expect(body.data).toMatchObject({ balance: 1234, totalEarned: 9000, totalUsed: 7766 })
    expect(typeof body.data.balance).toBe('number')
    // VIP 三项是可选字段:不填必须**根本没有**,不能填 0 冒充"已算过"
    expect(Object.keys(body.data).sort()).toEqual(['balance', 'totalEarned', 'totalUsed'])
  })

  it('登录后:user-center 六项齐全,且口径只认令牌主体', async () => {
    authState.userId = USER_ID
    const { statisticsRoutes } = await import('../src/routes/statistics.js')
    const app = await withRoute(async (a) => {
      void a.register(statisticsRoutes, { prefix: '/api' })
    })
    // 请求侧塞一个别人的 id,也不得影响取数(认证 ≠ 授权那一型的复发防护)
    const res = await app.inject({ method: 'GET', url: '/api/statistics/user-center?userId=' + OTHER_ID })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({
      courseCount: 12,
      favoriteCount: 3,
      followingCount: 7,
      fansCount: 21,
      studyHours: 3.4,
      points: 55,
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
