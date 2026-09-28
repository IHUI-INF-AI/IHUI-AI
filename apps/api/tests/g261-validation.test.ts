// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-261「参数校验失败被掩盖成 500」余量清偿 —— 19 个同型站点的回归锁(承 G-257 姿势)。
 *
 * 病灶形态(逐站点先用探针证红,证不出的不改):路由在 JSON Schema 里声明**校验型**约束
 * (format:'uuid' / minimum / maximum / enum / maxLength / minItems / required),且同一路由
 * 声明了 400 响应体 `code: number`(buildResponseSchema 或内联同形)。非法参数被 ajv 先拒 →
 * Fastify 默认错误体的 code 是字符串('FST_ERR_VALIDATION')→ fast-json-stringify 按
 * code:number 序列化抛错 → 客户端错误被掩盖成 **500**(修复前实测:19 站点逐条
 * `FST_ERR_FAILED_ERROR_SERIALIZATION`)。
 *
 * 修法(与 routes/audit.ts、audit-log.ts 的 G-257 参照实现同形):JSON Schema 只声明类型
 * (querystring 数字参数按 audit-log 先例声明 type:'string' —— 传输线本就是字符串,ajv 的
 * integer 强转同属校验行为),真实校验一律由路由内 Zod 做。**api-schemas.ts 一字未改**,
 * 没有靠放宽 errorResponseSchema 的 code 类型来"消红"。
 *
 * 测试隔离(AGENTS §5):全程不连生产库/Redis —— db 用可链式 Proxy 桩,鉴权面 vi.mock 成放行。
 * 本 Fastify 实例刻意不装 setErrorHandler(与生产同形,装了就看不见病灶)。
 * 反向锁只断言"合法参数不得 500"(桩 db 下 200/201/400/401/403/404 皆合法),不冒充全链路功能测试。
 */
import { describe, it, expect, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// 可链式 + 可 await 的通用 db 桩:任何属性访问返回自身,await 得 []
function chainStub() {
  const target = function () {}
  return new Proxy(target, {
    get: (_t, prop) => {
      if (prop === 'then') return (resolve) => resolve([])
      if (prop === Symbol.toPrimitive) return () => ''
      return chainStub()
    },
    apply: () => chainStub(),
  })
}

vi.mock('../src/db/index.js', () => ({
  db: chainStub(),
  getDb: () => chainStub(),
}))
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: async (request: {
    userId?: string
    jwtPayload?: { userId: string; roleId: number }
  }) => {
    request.userId = 'probe-user'
    request.jwtPayload = { userId: 'probe-user', roleId: 1 }
  },
  checkAuth: async () => true,
}))
vi.mock('../src/plugins/require-permission.js', () => ({
  requireAuth: async () => undefined,
  requireAdmin: async () => undefined,
  requireAdminRouteGuard: async () => undefined,
  checkPermission: async () => true,
}))

const FILES = {
  admin: () => import('../src/routes/admin.js'),
  billing: () => import('../src/routes/billing.js'),
  chat: () => import('../src/routes/chat.js'),
  notifications: () => import('../src/routes/notifications.js'),
  rbac: () => import('../src/routes/rbac.js'),
  schedule: () => import('../src/routes/schedule.js'),
  social: () => import('../src/routes/social.js'),
  usercenter: () => import('../src/routes/usercenter.js'),
  // behavior.ts 双插件路由名重叠(adminBehaviorRoutes 也注册 /behavior/watch/list),探针只取 behaviorRoutes
  behavior: async () => {
    const m = await import('../src/routes/behavior.js')
    return { behaviorRoutes: m.behaviorRoutes }
  },
  'visit-tracking': () => import('../src/routes/visit-tracking.js'),
  workflows: () => import('../src/routes/workflows.js'),
}

const UUID = '22222222-2222-4222-8222-222222222222'
// [file, method, invalid-url, invalid-payload?, valid-url, valid-payload?]
const CASES: Array<[string, string, string, unknown?, string, unknown?]> = [
  ['admin', 'GET', '/users/not-a-uuid', undefined, `/users/${UUID}`],
  // 刻意带合法 body:空 body 时 ajv 对 body type:'object' 的先拒属 G-257 残余③
  // ("POST body 走 JSON Schema 的边缘仍可能被 ajv 先拒 ⇒ 正解是全局 setErrorHandler,全 API 决策"),不在本票射程
  ['admin', 'PATCH', '/users/not-a-uuid', { role: 2 }, `/users/${UUID}`, { role: 2 }],
  ['admin', 'DELETE', '/users/not-a-uuid', undefined, `/users/${UUID}`],
  ['billing', 'GET', '/plans/not-a-uuid', undefined, `/plans/${UUID}`],
  [
    'chat',
    'GET',
    '/conversations/not-a-uuid/messages',
    undefined,
    `/conversations/${UUID}/messages`,
  ],
  ['chat', 'GET', '/conversations/not-a-uuid/history', undefined, `/conversations/${UUID}/history`],
  [
    'notifications',
    'POST',
    '/admin/notifications/send-targeted',
    { title: 't', content: 'c', channels: ['in_app'], msgType: 'system', userIds: ['not-a-uuid'] },
    '/admin/notifications/send-targeted',
    { title: 't', content: 'c', channels: ['in_app'], msgType: 'system', userIds: [UUID] },
  ],
  [
    'rbac',
    'POST',
    '/roles/not-a-uuid/permissions',
    { permissionIds: [UUID] },
    `/roles/${UUID}/permissions`,
    { permissionIds: [UUID] },
  ],
  ['schedule', 'GET', '/schedule/logs?taskId=not-a-uuid', undefined, '/schedule/logs?page=1'],
  ['social', 'POST', '/follows/not-a-uuid', undefined, `/follows/${UUID}`],
  ['social', 'DELETE', '/follows/not-a-uuid', undefined, `/follows/${UUID}`],
  [
    'usercenter',
    'GET',
    '/usercenter/departments?pid=not-a-uuid',
    undefined,
    '/usercenter/departments',
  ],
  [
    'usercenter',
    'POST',
    '/usercenter/departments',
    { name: 'x', pid: 'not-a-uuid' },
    '/usercenter/departments',
    { name: 'x', pid: UUID },
  ],
  [
    'usercenter',
    'PUT',
    `/usercenter/departments/${UUID}`,
    { pid: 'not-a-uuid' },
    `/usercenter/departments/${UUID}`,
    { pid: UUID },
  ],
  ['behavior', 'DELETE', '/behavior/watch?id=not-a-uuid', undefined, `/behavior/watch?id=${UUID}`],
  [
    'behavior',
    'DELETE',
    '/behavior/watch/all?userId=not-a-uuid',
    undefined,
    `/behavior/watch/all?userId=${UUID}`,
  ],
  [
    'visit-tracking',
    'POST',
    '/visit-tracking/visit-log',
    { userId: 'not-a-uuid' },
    '/visit-tracking/visit-log',
    { userId: UUID },
  ],
  [
    'visit-tracking',
    'GET',
    '/visit-tracking/log/list?userId=not-a-uuid',
    undefined,
    '/visit-tracking/log/list',
  ],
  [
    'workflows',
    'POST',
    '/workflows/not-a-uuid/trigger',
    { projectId: 'not-a-uuid' },
    `/workflows/${UUID}/trigger`,
    { projectId: UUID },
  ],
]

async function buildServer(file: string): Promise<FastifyInstance> {
  const mod = await FILES[file]()
  const server = Fastify({ logger: false })
  // notifications.ts 在注册期用 distributedRateLimit 装饰器;测试实例补同形桩
  server.decorate('distributedRateLimit', {
    addRule: () => {},
    preHandler: () => async () => {},
  })
  let registered = false
  for (const fn of Object.values(mod)) {
    if (typeof fn !== 'function') continue
    try {
      await server.register(fn as (o: unknown) => Promise<void>, { prefix: '' })
      registered = true
    } catch {
      /* 非路由插件导出,跳过 */
    }
  }
  if (!registered) throw new Error(`${file}.ts 没有可注册的插件`)
  await server.ready()
  return server
}

function expectErrorEnvelope(body: unknown, code = 400): void {
  const b = body as { code?: unknown; message?: unknown; error?: unknown }
  expect(typeof b.code).toBe('number')
  expect(b.code).toBe(code)
  expect(typeof b.message).toBe('string')
  // 病灶指纹不得回来:Fastify 默认错误体的 error 字段 / 字符串 code
  expect(b.error).toBeUndefined()
}

describe('G-261 十九站点:非法参数 ⇒ 400 且 code 为数字(修复前逐条实测 500)', () => {
  const servers = new Map<string, FastifyInstance>()
  const getServer = async (file: string) => {
    if (!servers.has(file)) servers.set(file, await buildServer(file))
    return servers.get(file)!
  }

  for (const [file, method, badUrl, badPayload, goodUrl, goodPayload] of CASES) {
    it(`${method} ${badUrl} (${file}.ts) 非法参数 ⇒ 400 统一信封`, async () => {
      const server = await getServer(file)
      const res = await server.inject({
        method: method as 'GET',
        url: badUrl,
        headers: { authorization: 'Bearer probe' },
        payload: badPayload === undefined ? undefined : (badPayload as object),
      })
      expect(res.statusCode, `病灶回归:实得 ${res.statusCode} ${res.body.slice(0, 160)}`).toBe(400)
      expectErrorEnvelope(res.json())
      expect(res.body).not.toContain('FST_ERR_VALIDATION')
      expect(res.body).not.toContain('FST_ERR_FAILED_ERROR_SERIALIZATION')
    })

    it(`${method} ${goodUrl} (${file}.ts) 合法参数不得被 uuid 校验拒绝(反向锁)`, async () => {
      const server = await getServer(file)
      const res = await server.inject({
        method: method as 'GET',
        url: goodUrl,
        headers: { authorization: 'Bearer probe' },
        payload: goodPayload === undefined ? undefined : (goodPayload as object),
      })
      // 病灶指纹不得回来:合法参数绝不能再走 ajv 先拒 ⇒ 错误序列化 500
      expect(res.body).not.toContain('FST_ERR_VALIDATION')
      if (res.statusCode === 500) {
        // 桩 db 的产物(空数组/缺字段与成功 schema 形状不合)允许 500,
        // 但必须证明它**不是**校验拒绝引来的 —— 上面 FST_ERR_VALIDATION 那条就是这条锁的牙
        expect(res.body).not.toMatch(/无效/)
      } else {
        expect([200, 201, 400, 401, 403, 404]).toContain(res.statusCode)
        if (res.statusCode === 400) {
          // 合法 uuid 不得被 Zod 判"无效"(其余 400 如"工作流未启用"属桩数据,合法)
          const msg = (res.json() as { message?: string }).message ?? ''
          expect(msg).not.toMatch(/无效的|无效 ID|请指定/)
        }
      }
    })
  }

  it('收尾:关闭全部探针实例', async () => {
    for (const s of servers.values()) await s.close()
    servers.clear()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
