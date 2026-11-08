// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-166 课程/视频管理写端点越权 — 路由级夹具。
 *
 * 判据:`routes/miniapp-compat-routes.ts` 的 8 个课程/视频管理写端点
 * (POST /learn/group + PUT/DELETE /learn/course/:id + POST .../issue|delist
 *  + POST /learn/video + PUT/DELETE /learn/video/:id)此前只挂 `checkAuth`,
 * 任意登录用户即可改价/删课/上下架/增删视频。现改挂 `requireAdmin`
 * (`plugins/require-permission.ts`,roleId >= ADMIN_ROLE_ID=1 ⇒ 放行,否则 403
 * `需要管理员权限`;未认证 401)。
 *
 * 因此:
 *  1. 普通用户(roleId=0)调这 8 个端点必须 403,且 db 的 update/delete/insert
 *     一次都不能发生(闸必须在业务逻辑之前);
 *  2. 管理员(roleId=1)同一请求照原逻辑放行(200/201)—— 防止"把管理员也拦了"。
 * 改前把任一端点换回 `{ preHandler: checkAuth }`,对应 403 用例即翻红(实为 200/201)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.REDIS_URL ??= 'redis://127.0.0.1:6399/0'
})

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://127.0.0.1:5399/test',
    REDIS_URL: 'redis://127.0.0.1:6399',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
    // 管理员 TOTP 闸关档:本夹具只验证 roleId 闸,不叠加 TOTP 绑定态查询
    ADMIN_TOTP_MODE: 'off',
  },
}))

const { mockVerifyAccessToken } = vi.hoisted(() => ({ mockVerifyAccessToken: vi.fn() }))

vi.mock('@ihui/auth', () => ({
  signAccessToken: vi.fn().mockResolvedValue('mock-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-token'),
  verifyAccessToken: mockVerifyAccessToken,
  createFamilyId: vi.fn().mockReturnValue('00000000-0000-4000-8000-000000000099'),
  // access token 吊销名单:测试内不连 Redis,恒"未吊销"
  createBlacklist: vi.fn(() => ({
    add: vi.fn().mockResolvedValue(undefined),
    has: vi.fn().mockResolvedValue(false),
  })),
}))

// authenticate 内部 decodeJwt 拒绝 challenge token;这里恒返回普通 access token
vi.mock('jose', () => ({ decodeJwt: vi.fn(() => ({ type: 'access' })) }))

// authenticate 验签后查用户状态:status=1(active)
vi.mock('../src/db/usercenter-queries.js', () => ({ getUserStatus: vi.fn().mockResolvedValue(1) }))

// 按用户限流:测试内不连 Redis,恒放行
vi.mock('../src/services/user-rate-limit.js', () => ({
  checkUserRateLimit: vi.fn().mockResolvedValue(true),
}))

const { mockDbSelect, mockDbInsert, mockDbUpdate, mockDbDelete } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockDbInsert: vi.fn(),
  mockDbUpdate: vi.fn(),
  mockDbDelete: vi.fn(),
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
    update: mockDbUpdate,
    delete: mockDbDelete,
    execute: vi.fn(),
  },
  dbRead: { select: vi.fn(), execute: vi.fn() },
}))

import { miniappCompatRoutes } from '../src/routes/miniapp-compat-routes.js'

const COURSE_ID = '11111111-1111-4111-8111-111111111111'
const VIDEO_ID = '22222222-2222-4222-8222-222222222222'
const CHAPTER_ID = '33333333-3333-4333-8333-333333333333'
const MEMBER_ID = '00000000-0000-4000-8000-000000000010'
const ADMIN_ID = '00000000-0000-4000-8000-000000000020'
const AUTH_HEADERS = { authorization: 'Bearer mock-token' }

/** 以给定角色登录(roleId=0 普通用户,roleId=1 管理员 = ADMIN_ROLE_ID) */
function authAs(roleId: number): void {
  mockVerifyAccessToken.mockResolvedValue({
    userId: roleId >= 1 ? ADMIN_ID : MEMBER_ID,
    phone: '13800000000',
    familyId: '00000000-0000-4000-8000-000000000099',
    roleId,
  })
}

// ---- db 链式桩(只桩本夹具用到的 4 条查询形态) ----
type DbChain = Record<string, (...args: unknown[]) => unknown>

/** select().from().where().limit() → rows */
function selectLimit(rows: unknown[]): DbChain {
  const c: DbChain = {}
  c.from = () => c
  c.where = () => c
  c.limit = () => Promise.resolve(rows)
  return c
}

/** update().set().where().returning() → rows */
function updateReturning(rows: unknown[]): DbChain {
  const c: DbChain = {}
  c.set = () => c
  c.where = () => c
  c.returning = () => Promise.resolve(rows)
  return c
}

/** update().set().where() → 直接 await */
function updateWhere(): DbChain {
  const c: DbChain = {}
  c.set = () => c
  c.where = () => Promise.resolve([])
  return c
}

/** insert().values().returning() → rows */
function insertReturning(rows: unknown[]): DbChain {
  const c: DbChain = {}
  c.values = () => c
  c.returning = () => Promise.resolve(rows)
  return c
}

/** delete().where() → 直接 await */
function deleteWhere(): DbChain {
  const c: DbChain = {}
  c.where = () => Promise.resolve([])
  return c
}

/** 8 个课程/视频管理写端点(方法 + 路径 + 原攻击载荷) */
const WRITE_ENDPOINTS: Array<{
  label: string
  method: 'POST' | 'PUT' | 'DELETE'
  url: string
  payload?: Record<string, unknown>
}> = [
  {
    label: 'POST /api/learn/group',
    method: 'POST',
    url: '/api/learn/group',
    payload: { title: '新课程分组' },
  },
  {
    label: 'PUT /api/learn/course/:id(改价 0)',
    method: 'PUT',
    url: `/api/learn/course/${COURSE_ID}`,
    payload: { price: '0.00', isFree: true },
  },
  {
    label: 'DELETE /api/learn/course/:id',
    method: 'DELETE',
    url: `/api/learn/course/${COURSE_ID}`,
  },
  {
    label: 'POST /api/learn/course/:id/issue',
    method: 'POST',
    url: `/api/learn/course/${COURSE_ID}/issue`,
  },
  {
    label: 'POST /api/learn/course/:id/delist',
    method: 'POST',
    url: `/api/learn/course/${COURSE_ID}/delist`,
  },
  {
    label: 'POST /api/learn/video',
    method: 'POST',
    url: '/api/learn/video',
    payload: { chapterId: CHAPTER_ID, title: '新视频' },
  },
  {
    label: 'PUT /api/learn/video/:id',
    method: 'PUT',
    url: `/api/learn/video/${VIDEO_ID}`,
    payload: { title: '改视频' },
  },
  {
    label: 'DELETE /api/learn/video/:id',
    method: 'DELETE',
    url: `/api/learn/video/${VIDEO_ID}`,
  },
]

describe('F-166 课程/视频管理写端点必须有管理员闸', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    app.setErrorHandler((err, _req, reply) => {
      const e = err instanceof Error ? err : new Error(String(err))
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 500
      reply
        .status(statusCode >= 400 && statusCode < 600 ? statusCode : 500)
        .send({ code: statusCode, message: statusCode >= 500 ? '服务器错误' : e.message })
    })
    await app.register(miniappCompatRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('普通用户(roleId=0)→ 403 且零写库', () => {
    for (const ep of WRITE_ENDPOINTS) {
      it(`${ep.label} → 403 且 update/delete/insert 未被调用`, async () => {
        authAs(0)
        const res = await app.inject({
          method: ep.method,
          url: ep.url,
          headers: AUTH_HEADERS,
          ...(ep.payload ? { payload: ep.payload } : {}),
        })
        expect(res.statusCode).toBe(403)
        const body = res.json() as { code?: number; message?: string }
        expect(body.code).toBe(403)
        expect(body.message).toBe('需要管理员权限')
        expect(mockDbUpdate).not.toHaveBeenCalled()
        expect(mockDbDelete).not.toHaveBeenCalled()
        expect(mockDbInsert).not.toHaveBeenCalled()
        // 闸必须在业务逻辑之前:连存在性查询都不该发生
        expect(mockDbSelect).not.toHaveBeenCalled()
      })
    }

    it('未认证(无 token)→ 401 且零写库', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/learn/course/${COURSE_ID}`,
        payload: { price: '0.00' },
      })
      expect(res.statusCode).toBe(401)
      expect(mockDbUpdate).not.toHaveBeenCalled()
      expect(mockDbDelete).not.toHaveBeenCalled()
      expect(mockDbInsert).not.toHaveBeenCalled()
    })
  })

  describe('管理员(roleId=1)→ 按原逻辑放行(正向对照)', () => {
    it('POST /api/learn/group → 201 并写入', async () => {
      authAs(1)
      mockDbInsert.mockImplementationOnce(() => insertReturning([{ id: COURSE_ID }]))
      const res = await app.inject({
        method: 'POST',
        url: '/api/learn/group',
        headers: AUTH_HEADERS,
        payload: { title: '新课程分组' },
      })
      expect(res.statusCode).toBe(201)
      expect((res.json() as { data: { id: string } }).data.id).toBe(COURSE_ID)
      expect(mockDbInsert).toHaveBeenCalledTimes(1)
    })

    it('PUT /api/learn/course/:id → 200 并更新', async () => {
      authAs(1)
      mockDbSelect.mockImplementationOnce(() => selectLimit([{ id: COURSE_ID }]))
      mockDbUpdate.mockImplementationOnce(() => updateReturning([{ id: COURSE_ID }]))
      const res = await app.inject({
        method: 'PUT',
        url: `/api/learn/course/${COURSE_ID}`,
        headers: AUTH_HEADERS,
        payload: { price: '0.00', isFree: true },
      })
      expect(res.statusCode).toBe(200)
      expect((res.json() as { data: { id: string } }).data.id).toBe(COURSE_ID)
      expect(mockDbUpdate).toHaveBeenCalledTimes(1)
    })

    it('DELETE /api/learn/course/:id → 200 并软删', async () => {
      authAs(1)
      mockDbUpdate.mockImplementationOnce(() => updateWhere())
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/learn/course/${COURSE_ID}`,
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(mockDbUpdate).toHaveBeenCalledTimes(1)
    })

    it('POST /api/learn/course/:id/issue → 200 published', async () => {
      authAs(1)
      mockDbUpdate.mockImplementationOnce(() => updateWhere())
      const res = await app.inject({
        method: 'POST',
        url: `/api/learn/course/${COURSE_ID}/issue`,
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect((res.json() as { data: { status: string } }).data.status).toBe('published')
      expect(mockDbUpdate).toHaveBeenCalledTimes(1)
    })

    it('POST /api/learn/course/:id/delist → 200 draft', async () => {
      authAs(1)
      mockDbUpdate.mockImplementationOnce(() => updateWhere())
      const res = await app.inject({
        method: 'POST',
        url: `/api/learn/course/${COURSE_ID}/delist`,
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect((res.json() as { data: { status: string } }).data.status).toBe('draft')
      expect(mockDbUpdate).toHaveBeenCalledTimes(1)
    })

    it('POST /api/learn/video → 201 并写入', async () => {
      authAs(1)
      mockDbInsert.mockImplementationOnce(() => insertReturning([{ id: VIDEO_ID }]))
      const res = await app.inject({
        method: 'POST',
        url: '/api/learn/video',
        headers: AUTH_HEADERS,
        payload: { chapterId: CHAPTER_ID, title: '新视频' },
      })
      expect(res.statusCode).toBe(201)
      expect((res.json() as { data: { id: string } }).data.id).toBe(VIDEO_ID)
      expect(mockDbInsert).toHaveBeenCalledTimes(1)
    })

    it('PUT /api/learn/video/:id → 200 并更新', async () => {
      authAs(1)
      mockDbUpdate.mockImplementationOnce(() => updateReturning([{ id: VIDEO_ID }]))
      const res = await app.inject({
        method: 'PUT',
        url: `/api/learn/video/${VIDEO_ID}`,
        headers: AUTH_HEADERS,
        payload: { title: '改视频' },
      })
      expect(res.statusCode).toBe(200)
      expect((res.json() as { data: { id: string } }).data.id).toBe(VIDEO_ID)
      expect(mockDbUpdate).toHaveBeenCalledTimes(1)
    })

    it('DELETE /api/learn/video/:id → 200 并物理删除', async () => {
      authAs(1)
      mockDbDelete.mockImplementationOnce(() => deleteWhere())
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/learn/video/${VIDEO_ID}`,
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(mockDbDelete).toHaveBeenCalledTimes(1)
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
