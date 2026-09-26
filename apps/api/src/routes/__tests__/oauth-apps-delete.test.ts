// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:8810/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.REDIS_URL ??= 'redis://localhost:8811/0'
})

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const PROBE_CLIENT_ID = 'zhs_o13cprobe00000000000000000001'

function probeAppRow(ownerUuid: string | null) {
  return {
    id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    clientId: PROBE_CLIENT_ID,
    clientSecret: 'probe-secret-plaintext',
    clientSecretHash: null,
    name: 'oauthchan-probe-1',
    description: null,
    redirectUris: ['https://example.com/cb'],
    scopes: ['read:profile'],
    icon: null,
    ownerUuid,
    isActive: 1,
    createdAt: new Date('2026-09-23T00:00:00.000Z'),
    updatedAt: new Date('2026-09-23T00:00:00.000Z'),
  }
}

const oauthMocks = vi.hoisted(() => ({
  findOAuthAppByClientId: vi.fn(),
  createOAuthApp: vi.fn(),
  deleteOAuthApp: vi.fn(),
}))

vi.mock('../../db/oauth-queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    findOAuthAppByClientId: oauthMocks.findOAuthAppByClientId,
    createOAuthApp: oauthMocks.createOAuthApp,
    deleteOAuthApp: oauthMocks.deleteOAuthApp,
  }
})

// auth.ts 鉴权链会查用户状态, mock 为 active(1), 与 auth-extended.test.ts 同口径
vi.mock('../../db/usercenter-queries.js', () => ({ getUserStatus: vi.fn().mockResolvedValue(1) }))

import { authExtendedRoutes } from '../auth-extended.js'
import { signAccessToken } from '@ihui/auth'

describe('O13c 自助 OAuth 应用删除', () => {
  let app: FastifyInstance
  let tokenA: string
  let tokenB: string

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(cookie)
    await app.register(authExtendedRoutes, { prefix: '/api' })
    await app.ready()
    const base = { phone: '', familyId: 'fam-o13c', roleId: 0 }
    tokenA = await signAccessToken({ ...base, userId: USER_A })
    tokenB = await signAccessToken({ ...base, userId: USER_B })
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('同一 owner:POST 创建 200 → DELETE 删除 200', async () => {
    oauthMocks.createOAuthApp.mockResolvedValue(probeAppRow(USER_A))
    const created = await app.inject({
      method: 'POST',
      url: '/api/auth/oauth/apps/create',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { name: 'oauthchan-probe-1', redirectUris: ['https://example.com/cb'] },
    })
    expect(created.statusCode).toBe(200)

    oauthMocks.findOAuthAppByClientId.mockResolvedValue(probeAppRow(USER_A))
    // deleteOAuthApp 现回报库确认的 client_id 集合(旧契约是 void);
    // 路由的 deleted 由 removedIds.length 派生 ⇒ 夹具必须给出"真删掉了哪一行"。
    oauthMocks.deleteOAuthApp.mockResolvedValue([PROBE_CLIENT_ID])
    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/auth/oauth/apps/${PROBE_CLIENT_ID}`,
      headers: { authorization: `Bearer ${tokenA}` },
    })
    expect(deleted.statusCode).toBe(200)
    expect(deleted.json().data.deleted).toBe(true)
    expect(oauthMocks.deleteOAuthApp).toHaveBeenCalledWith(PROBE_CLIENT_ID, USER_A)
  })

  it('跨 owner 删除 → 403 且不执行物理删除', async () => {
    oauthMocks.findOAuthAppByClientId.mockResolvedValue(probeAppRow(USER_A))
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/auth/oauth/apps/${PROBE_CLIENT_ID}`,
      headers: { authorization: `Bearer ${tokenB}` },
    })
    expect(res.statusCode).toBe(403)
    expect(oauthMocks.deleteOAuthApp).not.toHaveBeenCalled()
  })

  it('删除不存在的应用 → 404 且不执行物理删除', async () => {
    oauthMocks.findOAuthAppByClientId.mockResolvedValue(undefined)
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/auth/oauth/apps/zhs_not_exist_0000000000000001',
      headers: { authorization: `Bearer ${tokenA}` },
    })
    expect(res.statusCode).toBe(404)
    expect(oauthMocks.deleteOAuthApp).not.toHaveBeenCalled()
  })

  it('无 body 却带 Content-Type: application/json 的 DELETE 在解析层 400(生产 400 复现)', async () => {
    // Fastify 5 默认 JSON 解析器对"声明了 JSON 却无 body"的请求直接 400,
    // handler 尚未执行(deleteOAuthApp 不应被调用)。正确调用见首个用例:
    // 无 body 的 DELETE 不要带 Content-Type(见 packages/api-client client.ts 2026-07-30 注释)。
    oauthMocks.findOAuthAppByClientId.mockResolvedValue(probeAppRow(USER_A))
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/auth/oauth/apps/${PROBE_CLIENT_ID}`,
      headers: { authorization: `Bearer ${tokenA}`, 'content-type': 'application/json' },
    })
    expect(res.statusCode).toBe(400)
    expect(oauthMocks.deleteOAuthApp).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
