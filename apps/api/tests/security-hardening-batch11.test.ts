// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 安全强化第 11 批(2026-10-31)修复钉住。
 *
 * 覆盖:
 * - zhs-organization:写端点(POST/PUT/DELETE)此前整作用域零鉴权(匿名可建/改/删
 *   组织树,CRITICAL)→ 现匿名一律 401;GET 只读保持公开不被本批破坏。
 * - developer-routes DELETE /teams/:id/invitations/:id:此前任意登录用户枚举 UUID
 *   即可删任意团队邀请(IDOR)→ 现非当事人 403 且**不产生删除副作用**,被邀人本人可删。
 * - internal-relay-account-pool-credential:X-Internal-Secret 改走 secretsEqual 单源
 *   (常数时间),错误密钥 401 行为不变。
 * - fsBridge.grep:pattern 超 200 字符上限直接拒绝(ReDoS 入库/运行双闸的服务侧一腿)。
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

vi.mock('jose', () => ({ decodeJwt: () => ({}) }))
vi.mock('@ihui/auth', () => ({
  signAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-refresh-token'),
  verifyAccessToken: vi.fn().mockResolvedValue({
    userId: '00000000-0000-4000-8000-000000000001',
    phone: '13800000001',
    familyId: '00000000-0000-4000-8000-000000000002',
    roleId: 0,
  }),
  verifyRefreshToken: vi.fn().mockResolvedValue({
    userId: '00000000-0000-4000-8000-000000000001',
    phone: '13800000001',
    familyId: '00000000-0000-4000-8000-000000000002',
    roleId: 0,
  }),
  createFamilyId: vi.fn().mockReturnValue('00000000-0000-4000-8000-000000000002'),
}))

vi.mock('../src/db/usercenter-queries.js', () => ({
  getUserStatus: vi.fn().mockResolvedValue(1),
}))

function chainFor(result: unknown[] = []) {
  const chain: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
  }
  for (const m of ['from', 'where', 'orderBy', 'limit', 'offset', 'values', 'set', 'returning']) {
    chain[m] = () => chain
  }
  return chain
}

vi.mock('../src/db/index.js', () => {
  return {
    db: {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      execute: vi.fn(),
    },
    dbRead: { select: vi.fn() },
  }
})

vi.mock('../src/services/developer-api-keys-service.js', () => ({
  listApiKeys: vi.fn(),
  createApiKey: vi.fn(),
}))

vi.mock('../src/services/relay-account-pool-credential.js', () => ({
  applyPoolCredentialWriteback: vi.fn().mockResolvedValue({ status: 'applied' }),
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    AI_CALLBACK_SECRET: 'test-internal-secret-value',
    isDevelopmentRuntime: true,
    NODE_ENV: 'test',
  },
}))

import { db } from '../src/db/index.js'
import { zhsOrganizationRoutes } from '../src/routes/zhs-organization.js'
import { developerRoutes } from '../src/routes/other/developer-routes.js'
import internalRelayAccountPoolCredentialRoutes from '../src/routes/internal-relay-account-pool-credential.js'
import { fsBridge } from '../src/services/workspace-ai-service.js'

// ---------------------------------------------------------------------------
// C-1 组织树写操作鉴权
// ---------------------------------------------------------------------------

describe('zhs-organization 写端点鉴权(第 11 批 C-1)', () => {
  const app = Fastify({ logger: false })

  beforeAll(async () => {
    await app.register(zhsOrganizationRoutes, { prefix: '/api/organization' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('POST /api/organization 匿名 → 401(修复前 201)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/organization',
      payload: { orgName: 'x' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('PUT /api/organization/:id 匿名 → 401(修复前 200)', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/organization/1',
      payload: { orgName: 'x' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('DELETE /api/organization/:id 匿名 → 401(修复前 200)', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/api/organization/1' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/organization 匿名仍 200(只读面不被本批破坏)', async () => {
    vi.mocked(db.select).mockImplementation(() => chainFor([{ count: 0 }]) as never)
    const res = await app.inject({ method: 'GET', url: '/api/organization' })
    expect(res.statusCode).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// H-1 团队邀请删除 IDOR
// ---------------------------------------------------------------------------

describe('developer-routes 邀请删除归属闸(第 11 批 H-1)', () => {
  const invitation = {
    id: '00000000-0000-4000-8000-00000000aa01',
    teamId: '00000000-0000-4000-8000-00000000bb01',
    inviterId: '00000000-0000-4000-8000-00000000cc01',
    inviteeId: '00000000-0000-4000-8000-00000000dd01',
  }

  const buildApp = async (userId: string) => {
    const a = Fastify({ logger: false })
    // 测试钩子直接注入主体(等价 barrel 的 authenticate 之后形态)
    a.addHook('onRequest', async (req) => {
      ;(req as unknown as { userId: string }).userId = userId
    })
    await a.register(developerRoutes)
    await a.ready()
    return a
  }

  it('非当事人(也非团队管理员)→ 403 且不产生删除副作用', async () => {
    const app = await buildApp('00000000-0000-4000-8000-00000000ee01') // 无关第三人
    // 第 1 次 select = 邀请行;第 2 次 select(teamMembers)= 空(非团队成员)
    vi.mocked(db.select)
      .mockImplementationOnce(() => chainFor([invitation]) as never)
      .mockImplementationOnce(() => chainFor([]) as never)
    const del = vi.mocked(db.delete)
    del.mockClear()
    const res = await app.inject({
      method: 'DELETE',
      url: `/teams/x/invitations/${invitation.id}`,
    })
    expect(res.statusCode).toBe(403)
    expect(del).not.toHaveBeenCalled()
    await app.close()
  })

  it('被邀人本人可删 → 200 且执行删除', async () => {
    const app = await buildApp('00000000-0000-4000-8000-00000000dd01') // 被邀人本人
    vi.mocked(db.select).mockImplementationOnce(() => chainFor([invitation]) as never)
    const del = vi.mocked(db.delete)
    del.mockImplementation(() => chainFor([invitation]) as never)
    const res = await app.inject({
      method: 'DELETE',
      url: `/teams/x/invitations/${invitation.id}`,
    })
    expect(res.statusCode).toBe(200)
    expect(del).toHaveBeenCalledTimes(1)
    await app.close()
  })
})

// ---------------------------------------------------------------------------
// L2 内部密钥常数时间比较(行为回归钉)
// ---------------------------------------------------------------------------

describe('internal credential 端点(第 11 批 L2)', () => {
  const app = Fastify({ logger: false })

  beforeAll(async () => {
    await app.register(internalRelayAccountPoolCredentialRoutes)
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('错误密钥 → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/internal/relay/account-pool/credential',
      headers: { 'x-internal-secret': 'wrong-secret' },
      payload: { poolAccountId: 'p1', baseVersion: 0 },
    })
    expect(res.statusCode).toBe(401)
  })

  it('正确密钥 + 合法 body → 200', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/internal/relay/account-pool/credential',
      headers: { 'x-internal-secret': 'test-internal-secret-value' },
      payload: { poolAccountId: 'p1', baseVersion: 0 },
    })
    expect(res.statusCode).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// ReDoS:fsBridge.grep pattern 长度闸
// ---------------------------------------------------------------------------

describe('fsBridge.grep pattern 闸(第 11 批 ReDoS)', () => {
  it('pattern 超 200 字符 → 固定错误,不执行正则', () => {
    expect(() =>
      fsBridge.grep({ path: '.', workspacePath: '.', pattern: 'a'.repeat(201) }),
    ).toThrow(/200 字符上限/)
  })

  it('pattern 不超限时不因长度闸报错(报错只会来自路径闸)', () => {
    // 未配 IHUI_WORKSPACE_ROOTS ⇒ 路径闸 fail-closed;断言错误不是长度闸的
    try {
      fsBridge.grep({ path: '.', workspacePath: '.', pattern: 'abc' })
      expect.unreachable('应抛错(路径闸或长度闸)')
    } catch (e) {
      expect((e as Error).message).not.toMatch(/200 字符上限/)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
