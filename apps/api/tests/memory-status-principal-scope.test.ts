// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * GET /memory/status 的**作用域**授权(§5「认证不等于授权」,2026-10-31 收口)。
 *
 * 旧口径 `parsed.data.user_id ?? request.userId` 把**客户端参数放在主体前面** ⇒
 * 任一登录用户改一个 ?user_id= 就能读别人(或任意 agent)的四层记忆内容本体
 * (会话摘要 / 多模态 caption / 元经验教训标题正文 / 工作记忆压缩)。
 * 本文件钉三条:等于本人放行;他人主体拒绝;"面板传 agentId"这一格必须有
 * agents 归属查询证明,否则同样拒绝。拒绝一律 404(不用 403 —— 那等于替人确认 id 存在)。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

/**
 * 每次调用重设:鉴权注入的主体 + agents 归属查询是否命中 + 是否系统管理员。
 * 必须整体住在 vi.hoisted 里(mock 工厂在收集期就引用它),常量也一并放进去 ——
 * 写在 hoisted 外面会撞"Cannot access 'X' before initialization"。
 */
const ctl = vi.hoisted(() => ({
  OWNER: '00000000-0000-4000-8000-000000000001',
  ATTACKER: '00000000-0000-4000-8000-000000000099',
  AGENT_ID: '11111111-1111-4000-8000-000000000001',
  principal: '',
  agentOwnedByPrincipal: false,
  isAdmin: false,
}))

const { OWNER, ATTACKER, AGENT_ID } = ctl

vi.mock('../src/plugins/auth.js', () => ({
  checkAuthOrInternalService: vi.fn(async (request: { userId?: string }) => {
    request.userId = ctl.principal
    return true
  }),
}))

vi.mock('../src/db/queries.js', () => ({
  isSystemAdminUser: vi.fn(async () => ctl.isAdmin),
}))

// 测试隔离铁律:任何用例都不得触真库。agents 归属查询按 ctl 答复,其余链式查询回空集。
vi.mock('../src/db/index.js', () => {
  const makeChain = (rows: unknown[]): Record<string, unknown> => {
    const step: Record<string, unknown> = {}
    for (const m of ['from', 'where', 'orderBy', 'limit', 'groupBy']) {
      step[m] = vi.fn(() => step)
    }
    step.then = (resolve: (v: unknown) => void) => Promise.resolve(rows).then(resolve)
    return step
  }
  return {
    db: {
      select: vi.fn((shape?: Record<string, unknown>) =>
        makeChain(
          shape && 'agentId' in shape
            ? ctl.agentOwnedByPrincipal
              ? [{ agentId: ctl.AGENT_ID }]
              : []
            : [],
        ),
      ),
      execute: vi.fn().mockResolvedValue([]),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  }
})

import { memoryRoutes } from '../src/routes/memory.js'

async function build() {
  const app = Fastify({ logger: false })
  app.setErrorHandler((err, _req, reply) => {
    reply.status(err.statusCode && err.statusCode >= 400 ? err.statusCode : 500).send({
      code: 500,
      message: 'boom',
    })
  })
  await app.register(memoryRoutes, { prefix: '/api' })
  await app.ready()
  return app
}

describe('GET /memory/status 作用域只认主体', () => {
  beforeEach(() => {
    ctl.principal = OWNER
    ctl.agentOwnedByPrincipal = false
    ctl.isAdmin = false
  })

  it('不带 user_id ⇒ 按主体自己的桶出 200(正向对照)', async () => {
    const app = await build()
    const res = await app.inject({ method: 'GET', url: '/api/memory/status' })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('带别人的 user_id ⇒ 404,且响应体不含他人记忆', async () => {
    const app = await build()
    ctl.principal = ATTACKER
    const res = await app.inject({
      method: 'GET',
      url: `/api/memory/status?user_id=${OWNER}`,
    })
    expect(res.statusCode).toBe(404)
    expect(res.body).not.toContain(OWNER)
    await app.close()
  })

  it('面板传 agentId:agents 归属查询没命中 ⇒ 仍然 404', async () => {
    const app = await build()
    const res = await app.inject({
      method: 'GET',
      url: `/api/memory/status?user_id=${AGENT_ID}`,
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('面板传 agentId:证明是本人名下 agent ⇒ 放行(功能没被关掉)', async () => {
    const app = await build()
    ctl.agentOwnedByPrincipal = true
    const res = await app.inject({
      method: 'GET',
      url: `/api/memory/status?user_id=${AGENT_ID}`,
    })
    expect(res.statusCode).toBe(200)
    await app.close()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
