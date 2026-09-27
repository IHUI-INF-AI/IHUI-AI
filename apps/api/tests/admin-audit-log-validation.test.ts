// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-257「参数校验失败被掩盖成 500」— /api/admin/audit-log* 一族的回归锁。
 *
 * 病灶形态(由另一路探针实测、本文件现读复证):路由在 JSON Schema 里声明
 * `format:'uuid'` / `minimum` / `maximum` / `enum` 这类**校验型**约束,且同一路由声明了
 * 400 响应体走 `utils/api-schemas.ts` 的 `errorResponseSchema`(它声明 `code: number`)。
 * 非法参数被 ajv **先**拒 → Fastify 默认错误体的 `code` 是字符串('FST_ERR_VALIDATION')
 * → fast-json-stringify 按 `code:number` 序列化时抛错 → 客户端错误被掩盖成 **500**。
 *
 * 修法唯一姿势(与参照实现 `routes/audit-evidence-export.ts` 同形):
 * JSON Schema 只声明类型,真实校验一律由路由内的 Zod 做,产出的 `error(400, msg)`
 * 形状与 errorResponseSchema 一致。**禁止**改 errorResponseSchema 放宽契约、
 * **禁止**删 400 响应声明绕开不匹配。
 *
 * 测试隔离铁律(AGENTS §5):全程不连生产 PostgreSQL(8810)/Redis(8811)——
 * 审计查询面与鉴权面一律 vi.mock 桩掉;本 Fastify 实例刻意**不装** setErrorHandler,
 * 与生产(src 全树无全局错误处理器,仅测试文件里自装)同形 —— 装了反而会把病灶洗成绿
 * (既有 tests/audit.test.ts 正是自装了处理器,所以它对 page=0 断言 400 能过,
 *  而生产实际是 500;本文件用生产形态重测)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// ---------- 鉴权 mock(两端共用的 authenticate 出口) ----------
const { mockAuthenticate } = vi.hoisted(() => ({ mockAuthenticate: vi.fn() }))
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
  checkAuth: vi.fn(),
}))

// ---------- audit.ts 的 DB 查询面桩 ----------
const { mockFindAuditLogs, mockGetDetailedStats, mockExportAuditLogsDb } = vi.hoisted(() => ({
  mockFindAuditLogs: vi.fn(),
  mockGetDetailedStats: vi.fn(),
  mockExportAuditLogsDb: vi.fn(),
}))
vi.mock('../src/db/search-queries.js', () => ({
  findAuditLogs: mockFindAuditLogs,
  getDetailedStats: mockGetDetailedStats,
  exportAuditLogs: mockExportAuditLogsDb,
}))

// ---------- audit-log.ts 的服务面桩(链查询/导出/验证/统计) ----------
const {
  mockQueryAuditLogs,
  mockExportAuditLogs,
  mockVerifyUserChain,
  mockVerifyRangeChain,
  mockGetAuditLogStats,
} = vi.hoisted(() => ({
  mockQueryAuditLogs: vi.fn(),
  mockExportAuditLogs: vi.fn(),
  mockVerifyUserChain: vi.fn(),
  mockVerifyRangeChain: vi.fn(),
  mockGetAuditLogStats: vi.fn(),
}))
vi.mock('../src/services/audit-log-service.js', () => ({
  queryAuditLogs: mockQueryAuditLogs,
  exportAuditLogs: mockExportAuditLogs,
  verifyUserChain: mockVerifyUserChain,
  verifyRangeChain: mockVerifyRangeChain,
  getAuditLogStats: mockGetAuditLogStats,
}))

import { auditRoutes } from '../src/routes/audit.js'
import { auditLogRoutes } from '../src/routes/audit-log.js'

const UUID_A = '22222222-2222-4222-8222-222222222222'

/** 错误体必须过 errorResponseSchema 的序列化形状:{ code: number, message: string }。 */
function expectErrorEnvelope(body: unknown, code = 400): void {
  const b = body as { code?: unknown; message?: unknown; error?: unknown }
  expect(typeof b.code).toBe('number')
  expect(b.code).toBe(code)
  expect(typeof b.message).toBe('string')
  // 病灶指纹不得回来:Fastify 默认错误体的 `error: 'Bad Request'` / 字符串 code
  expect(b.error).toBeUndefined()
}

describe('G-257 /api/admin/audit-log* 参数校验失败 ⇒ 400(不得掩盖成 500)', () => {
  let server: FastifyInstance

  beforeAll(async () => {
    // 刻意不装 setErrorHandler —— 复现生产形态(见文件头注释)
    server = Fastify({ logger: false })
    await server.register(auditRoutes, { prefix: '/api/admin' })
    // 与 src/routes/index.ts:1150 同前缀挂载,路径逐字保持现状
    await server.register(auditLogRoutes, { prefix: '/api/admin/audit-logs' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthenticate.mockImplementation(
      (request: { jwtPayload?: { userId: string; roleId: number } }) => {
        request.jwtPayload = { userId: 'admin-001', roleId: 1 }
        return Promise.resolve(request.jwtPayload)
      },
    )
    mockFindAuditLogs.mockResolvedValue({ list: [{ id: 'log-001' }], total: 1 })
    mockGetDetailedStats.mockResolvedValue({ users: 3 })
    mockExportAuditLogsDb.mockResolvedValue([{ id: 'log-001' }])
    mockQueryAuditLogs.mockResolvedValue({ list: [{ id: 'chain-001' }], total: 1 })
    mockGetAuditLogStats.mockResolvedValue({ total: 2, byAction: [], byUser: [] })
    mockVerifyUserChain.mockResolvedValue({ ok: true, checked: 1 })
    mockVerifyRangeChain.mockResolvedValue({ ok: true, checked: 1 })
    mockExportAuditLogs.mockImplementation(async function* () {
      yield '{"id":"chain-001"}'
    })
  })

  // ===========================================================================
  // A. audit.ts GET /api/admin/audit-logs —— 校验型约束住在 paginationQuerySchema
  //    (minimum/maximum/default)且该路由声明了 400 errorResponseSchema ⇒ 病灶在位
  // ===========================================================================
  describe('GET /api/admin/audit-logs(audit.ts)', () => {
    it('page=0(违反 minimum)⇒ 400 且 code 是数字', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/audit-logs?page=0',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
      expectErrorEnvelope(res.json())
    })

    it('pageSize=200(违反 maximum)⇒ 400 且 code 是数字', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/audit-logs?pageSize=200',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
      expectErrorEnvelope(res.json())
    })

    it('page=abc(整型不可解析)⇒ 400 而非 500', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/audit-logs?page=abc',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
      expectErrorEnvelope(res.json())
    })

    it('userId=not-a-uuid ⇒ 400 且错误体形状与 schema 一致(此前已走 Zod,留作对照)', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/audit-logs?userId=not-a-uuid',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
      expectErrorEnvelope(res.json())
    })

    it('反向锁:合法参数仍 200,响应字段与改前逐字一致', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/admin/audit-logs?page=2&pageSize=50&userId=${UUID_A}`,
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json() as { code: number; message: string; data: Record<string, unknown> }
      expect(body.code).toBe(0)
      expect(body.message).toBe('success')
      expect(body.data).toEqual({ list: [{ id: 'log-001' }], total: 1, page: 2, pageSize: 50 })
    })
  })

  // ===========================================================================
  // B. audit.ts GET /api/admin/audit-logs/export —— enum/minimum/maximum/default
  //    在 querystring 里(该路由**未**声明 400 响应 schema,所以症状是"错误体形状
  //    不走统一信封",而非掩盖成 500;按同一姿势迁到 Zod 后形状必须与信封一致)
  // ===========================================================================
  describe('GET /api/admin/audit-logs/export(audit.ts)', () => {
    it('format=xml(违反 enum)⇒ 400 且错误体是 { code:number, message:string }', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/audit-logs/export?format=xml',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
      expectErrorEnvelope(res.json())
    })

    it('limit=0(违反 minimum)⇒ 400 且走统一错误信封', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/audit-logs/export?limit=0',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
      expectErrorEnvelope(res.json())
    })

    it('limit=999999(违反 maximum)⇒ 400 且走统一错误信封', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/audit-logs/export?limit=999999',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
      expectErrorEnvelope(res.json())
    })
  })

  // ===========================================================================
  // C. audit-log.ts GET /api/admin/audit-logs/audit-logs —— format:'uuid' + 400 schema
  //    ⇒ 本票立因的正病灶:非法 uuid 的 400 被序列化环节掩盖成 500
  // ===========================================================================
  describe('GET /api/admin/audit-logs/audit-logs(audit-log.ts 链查询)', () => {
    it('userId=not-a-uuid ⇒ 400 且 code 是数字(修复前此路 ajv 先拒 ⇒ 500)', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/audit-logs/audit-logs?userId=not-a-uuid',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
      expectErrorEnvelope(res.json())
      expect(res.body).not.toContain('FST_ERR_VALIDATION')
    })

    it('pageSize=200(违反 maximum)⇒ 400 而非 500', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/audit-logs/audit-logs?pageSize=200',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
      expectErrorEnvelope(res.json())
    })

    it('page=0(违反 minimum)⇒ 400 而非 500', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/audit-logs/audit-logs?page=0',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
      expectErrorEnvelope(res.json())
    })

    it('反向锁:合法参数 200,字段 { list,total,page,pageSize } 逐字不变', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/admin/audit-logs/audit-logs?page=1&pageSize=20&userId=${UUID_A}`,
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json() as { code: number; message: string; data: Record<string, unknown> }
      expect(body.code).toBe(0)
      expect(body.data).toEqual({ list: [{ id: 'chain-001' }], total: 1, page: 1, pageSize: 20 })
      expect(mockQueryAuditLogs).toHaveBeenCalledTimes(1)
    })
  })

  // ===========================================================================
  // D. audit-log.ts POST /audit-logs/verify —— body 里 format:'uuid'/minimum/maximum
  // ===========================================================================
  describe('POST /api/admin/audit-logs/audit-logs/verify(audit-log.ts 链验证)', () => {
    it('body userId=not-a-uuid ⇒ 400 且 code 是数字(修复前 ⇒ 500)', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/admin/audit-logs/audit-logs/verify',
        headers: { authorization: 'Bearer t' },
        payload: { userId: 'not-a-uuid' },
      })
      expect(res.statusCode).toBe(400)
      expectErrorEnvelope(res.json())
      expect(res.body).not.toContain('FST_ERR_VALIDATION')
    })

    it('body limit=999999(违反 maximum)⇒ 400 而非 500', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/admin/audit-logs/audit-logs/verify',
        headers: { authorization: 'Bearer t' },
        payload: { limit: 999999 },
      })
      expect(res.statusCode).toBe(400)
      expectErrorEnvelope(res.json())
    })

    it('反向锁:合法 body 与空 body 均 200,userId 命中走 verifyUserChain', async () => {
      const withUser = await server.inject({
        method: 'POST',
        url: '/api/admin/audit-logs/audit-logs/verify',
        headers: { authorization: 'Bearer t' },
        payload: { userId: UUID_A, limit: 100 },
      })
      expect(withUser.statusCode).toBe(200)
      expect(withUser.json().data).toEqual({ ok: true, checked: 1 })
      expect(mockVerifyUserChain).toHaveBeenCalledWith(UUID_A, 100)

      const empty = await server.inject({
        method: 'POST',
        url: '/api/admin/audit-logs/audit-logs/verify',
        headers: { authorization: 'Bearer t' },
        payload: {},
      })
      expect(empty.statusCode).toBe(200)
      expect(mockVerifyRangeChain).toHaveBeenCalled()
    })
  })

  // ===========================================================================
  // E. audit-log.ts GET /audit-logs/stats 与 /audit-logs/export —— 同型站点
  // ===========================================================================
  describe('GET /api/admin/audit-logs/audit-logs/stats 与 export(audit-log.ts)', () => {
    it('stats userId=not-a-uuid ⇒ 400 而非 500', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/audit-logs/audit-logs/stats?userId=not-a-uuid',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
      expectErrorEnvelope(res.json())
    })

    it('stats 合法参数 ⇒ 200 且统计字段原样透传', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/admin/audit-logs/audit-logs/stats?userId=${UUID_A}`,
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data).toEqual({ total: 2, byAction: [], byUser: [] })
    })

    it('export format=xml(违反 enum)⇒ 400 走统一错误信封', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/audit-logs/audit-logs/export?format=xml',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
      expectErrorEnvelope(res.json())
    })

    it('export userId=not-a-uuid ⇒ 400 走统一错误信封', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/audit-logs/audit-logs/export?userId=not-a-uuid',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
      expectErrorEnvelope(res.json())
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
