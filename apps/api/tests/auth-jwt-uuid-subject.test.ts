// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * JWT 鉴权腿的**主体形状闸**(2026-10-28 立,与 tests/internal-service-uuid-subject.test.ts 同族)。
 *
 * 一手根因(同型缺陷在 internal-service 腿已结清,JWT 腿残留):
 *   `users.id` 是 uuid 列;非 uuid 主体(如 `utils/system-access-token.ts:19` 铸的
 *   `sub='system-worker'`)走到 `authenticate` 的 `getUserStatus(payload.userId)` 时,
 *   Postgres 抛 `22P02 invalid input syntax for type uuid`(DrizzleQueryError 包裹),
 *   而该调用包在 try/catch 里 ⇒ 被读成 502 ACCOUNT_STATE_CHECK_FAILED ——
 *   换了状态码、仍在外溢,且与"真数据库坏了"同桶、无法追责。
 * 修法:复用 `utils/uuid.ts` 的 `isUuidString`(§0.6 单一真相源,不在本腿复制正则),
 * 在**发出 SQL 之前**把非法主体归位 401;真实 DB 故障(连接/超时/权限)仍应 502。
 *
 * 本文件钉三态,缺一不可(§5 测试隔离铁律:全程 mock 连接层,绝不触真库 PG/Redis):
 *  ① 非 uuid 主体 ⇒ 401 **且 getUserStatus 未被调用**(= 一条 SQL 都没发,副作用未发生);
 *  ② 正向对照:合法 uuid 主体 ⇒ 照常放行且恰好查一次(闸不是一刀切,否则即恒红门);
 *  ③ DB 真故障(查询抛连接类异常)⇒ 仍是 502,不得被洗成 401。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  // 与 tests/internal-service-uuid-subject.test.ts 同口径:任何用例都不得触真库/真 Redis
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'unit-test-only-jwt-secret-0123456789abcdef'
})

const { mockGetUserStatus, mockVerifyAccessToken } = vi.hoisted(() => ({
  mockGetUserStatus: vi.fn(),
  mockVerifyAccessToken: vi.fn(),
}))

vi.mock('jose', () => ({ decodeJwt: () => ({}) }))
vi.mock('@ihui/auth', () => ({ verifyAccessToken: mockVerifyAccessToken }))
// 连接层 monkeypatch:auth 腿唯一的 SQL 出口是 usercenter-queries.getUserStatus,
// 零查询断言(①)与 DB 故障注入(③)都挂在这把 spy 上;真池永不建立。
vi.mock('../src/db/usercenter-queries.js', () => ({ getUserStatus: mockGetUserStatus }))
vi.mock('../src/db/index.js', () => {
  const stub = {
    select: vi.fn(),
    execute: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }
  return { db: stub, dbRead: stub, dbWriter: stub, dbClient: { end: vi.fn() } }
})

const { authenticate } = await import('../src/plugins/auth.js')

/** 生产里真实出现过的那一枚伪身份(utils/system-access-token.ts 的 SUBJECT)。 */
const PSEUDO_SUBJECTS = ['system-worker', '1', 'abc'] as const
const UUID_SUBJECT = '6b8cd0f6-546f-44c8-853a-5f96edbe08be'

async function buildProbe(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  app.get('/probe', async (request, reply) => {
    try {
      await authenticate(request)
      return { ok: true, userId: request.userId }
    } catch (e) {
      const err = e as Error & { statusCode?: number; errorCode?: string }
      return reply
        .status(err.statusCode ?? 500)
        .send({ message: err.message, errorCode: err.errorCode })
    }
  })
  return app
}

async function call(
  app: FastifyInstance,
  authorization = 'Bearer mock-access-token',
): Promise<{ status: number; body: string }> {
  const res = await app.inject({ method: 'GET', url: '/probe', headers: { authorization } })
  return { status: res.statusCode, body: res.body }
}

describe('JWT 鉴权腿:非 uuid 主体一律归位 401 且零查询', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    mockGetUserStatus.mockReset()
    mockVerifyAccessToken.mockReset()
    mockVerifyAccessToken.mockResolvedValue({ userId: UUID_SUBJECT, roleId: 0 })
    app = await buildProbe()
  })

  for (const subject of PSEUDO_SUBJECTS) {
    it(`主体 ${JSON.stringify(subject)} ⇒ 401,且一条 SQL 都没发(22P02 不再外溢成 502)`, async () => {
      mockVerifyAccessToken.mockResolvedValue({ userId: subject, roleId: 0 })
      // 若闸缺失,这里会真查库并放行 ⇒ 断言的区分度来自"未调用"
      mockGetUserStatus.mockResolvedValue(1)
      const r = await call(app)
      expect(r.status).toBe(401)
      expect(r.body).toContain('UUID')
      expect(mockGetUserStatus).not.toHaveBeenCalled()
    })
  }

  it('正向对照:合法 uuid 主体 ⇒ 200 且恰好查一次(闸不是一刀切)', async () => {
    mockGetUserStatus.mockResolvedValue(1)
    const r = await call(app)
    expect(r.status).toBe(200)
    expect(JSON.parse(r.body)).toMatchObject({ ok: true, userId: UUID_SUBJECT })
    expect(mockGetUserStatus).toHaveBeenCalledTimes(1)
  })

  it('畸形载荷(userId 缺失/非串)⇒ 同样零查询归位 401,不得 TypeError 成 502', async () => {
    mockVerifyAccessToken.mockResolvedValue({ userId: undefined, roleId: 0 })
    const r = await call(app)
    expect(r.status).toBe(401)
    expect(mockGetUserStatus).not.toHaveBeenCalled()
  })

  it('DB 真故障(连接类异常)⇒ 仍 502,不得被形状闸洗成 401', async () => {
    mockGetUserStatus.mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:5432'))
    const r = await call(app)
    expect(r.status).toBe(502)
    expect(JSON.parse(r.body).errorCode).toBe('ACCOUNT_STATE_CHECK_FAILED')
  })

  it('封禁用户(status=0)语义不被闸吞掉:uuid 主体 + status 0 ⇒ 403', async () => {
    mockGetUserStatus.mockResolvedValue(0)
    const r = await call(app)
    expect(r.status).toBe(403)
  })

  it('无 token ⇒ 401 Authentication required(原有语义逐字不变)', async () => {
    const r = await call(app, '')
    expect(r.status).toBe(401)
    expect(mockGetUserStatus).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
