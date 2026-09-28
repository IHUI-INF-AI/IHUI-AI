// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 游客可访问的 `GET /api/agents/:agentId` 对**畸形 id** 不得回 500(2026-09-28 真机普查实测)。
 *
 * 病灶:`agents.agent_id` 是 `uuid` 列,而路由的参数校验只有 `z.string()` —— 于是
 * `eq(agents.agentId, 'carousel')` 会把字符串交给 Postgres,抛
 * `22P02 invalid input syntax for type uuid`,路由没有兜住 ⇒ 客户端拿到 **500 服务器错误**。
 * 实测两条(未带任何令牌):
 *   GET /api/agents/carousel                          → 500
 *   GET /api/agents/definitely-not-a-real-slug-9x7    → 500
 * 为什么这比"回 401"更难发现:同一份响应体既可能是"这条不存在",也可能是"服务坏了",
 * 而 AGENTS §5 早就记过一型 —— fail-open 的公开面崩在鉴权层后面,监控只看到 5xx。
 *
 * 三条不变量:
 *  ① 畸形 id ⇒ GET 回 **404**、PUT/DELETE 回 **400**,且**服务层一次都没被调用**
 *     (形状闸必须在进 SQL 之前;只断言状态码会放过"先查了再抛 403"那一型);
 *  ② 合法 uuid ⇒ 照常进服务层(闸不许把正当请求一起挡掉);
 *  ③ 判据只许有一份 —— `interactions` 与 `ws-tasks` 两处历史手写正则已并到 `utils/uuid`,
 *     镜像锁禁止再出现第二份正则;而 `edu-supplementary-routes` 的 `z.uuid()` **刻意保留**
 *     (它比本判据严:校验版本位/变体位),把严的换成宽的是放宽别人的契约,同样由镜像锁拦住。
 *
 * 测试隔离铁律(AGENTS §5):全程不连生产 PostgreSQL / Redis —— 服务层与鉴权层整体桩掉。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const { mockAuthenticate, svc } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(async (_req: unknown, _reply: unknown, done: () => void) => done()),
  svc: {
    getAgentDetail: vi.fn(),
    listAgents: vi.fn(),
    createAgent: vi.fn(),
    updateAgent: vi.fn(),
    deleteAgent: vi.fn(),
  },
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
  checkAuth: vi.fn(async () => true),
}))
vi.mock('../src/services/agent-service.js', () => svc)

let app: FastifyInstance

beforeAll(async () => {
  const { agentsRoutes } = await import('../src/routes/agents.js')
  app = Fastify()
  await app.register(agentsRoutes, { prefix: '/api' })
  await app.ready()
})

afterAll(async () => {
  await app?.close()
})

const A_UUID = '11112222-3333-4444-5555-666677778888'

describe('畸形 agentId 不得冒成 500', () => {
  it.each(['/api/agents/carousel', '/api/agents/definitely-not-a-real-slug-9x7', '/api/agents/1'])(
    'GET %s ⇒ 404 且服务层零调用',
    async (url) => {
      svc.getAgentDetail.mockClear()
      const res = await app.inject({ method: 'GET', url })
      expect(res.statusCode).toBe(404)
      expect(svc.getAgentDetail).not.toHaveBeenCalled()
    },
  )

  it('PUT /api/agents/carousel ⇒ 400(写侧是客户端错误),且服务层零调用', async () => {
    svc.updateAgent.mockClear()
    const res = await app.inject({
      method: 'PUT',
      url: '/api/agents/carousel',
      payload: { name: 'x' },
    })
    expect(res.statusCode).toBe(400)
    expect(svc.updateAgent).not.toHaveBeenCalled()
  })

  it('DELETE /api/agents/carousel ⇒ 400,且服务层零调用', async () => {
    svc.deleteAgent.mockClear()
    const res = await app.inject({ method: 'DELETE', url: '/api/agents/carousel' })
    expect(res.statusCode).toBe(400)
    expect(svc.deleteAgent).not.toHaveBeenCalled()
  })
})

describe('反向对照 —— 闸不得把正当请求一起挡掉', () => {
  it('合法 uuid 的 GET 仍进服务层,并由服务层的"查不到"产出 404', async () => {
    svc.getAgentDetail.mockClear().mockResolvedValue(null)
    const res = await app.inject({ method: 'GET', url: `/api/agents/${A_UUID}` })
    expect(svc.getAgentDetail).toHaveBeenCalledTimes(1)
    expect(res.statusCode).toBe(404)
  })

  it('合法 uuid 的 GET 命中未发布记录 ⇒ 游客侧仍按"不存在"处理(不泄露存在性)', async () => {
    svc.getAgentDetail.mockClear().mockResolvedValue({ agent: { agentId: A_UUID, status: 'draft' } })
    const res = await app.inject({ method: 'GET', url: `/api/agents/${A_UUID}` })
    expect(svc.getAgentDetail).toHaveBeenCalledTimes(1)
    expect(res.statusCode).toBe(404)
  })
})

describe('判据只许有一份(且不得把更严的那一份换宽)', () => {
  it('两处历史手写正则已并到 utils/uuid;第三处刻意保留 zod 的更严判据', async () => {
    const { readFileSync } = await import('node:fs')
    const { fileURLToPath } = await import('node:url')
    const path = await import('node:path')
    const root = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..')
    for (const rel of [
      'apps/api/src/routes/interactions.ts',
      'apps/api/src/plugins/ws-tasks.ts',
    ]) {
      const src = readFileSync(path.join(root, rel), 'utf8')
      expect(src, rel).toContain("from '../utils/uuid.js'")
      expect(src, rel).not.toMatch(/\[0-9a-f\]\{8\}/)
    }
    // edu 用的是 z.uuid()(校验版本位/变体位,比本判据严)。它换成宽判据 = 悄悄放宽契约,
    // 所以这里把它钉成"仍走 zod":实测 `11112222-3333-4444-5555-666677778888`
    // 被 z.uuid() 拒(variant 位不是 8/9/a/b)而被本判据收 —— 两者回答的不是同一个问题。
    const edu = readFileSync(
      path.join(root, 'apps/api/src/routes/edu-supplementary-routes.ts'),
      'utf8',
    )
    expect(edu).toContain('z.uuid()')
    expect(edu).not.toContain("from '../utils/uuid.js'")
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
