// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-246(P2)判据取证:审计链查询异常**不得**被吞成空结果/成功。
 *
 * 病灶(旧代码,本文件首跑时现读复证):
 *  - `GET /api/admin/audit-logs/audit-logs` 在 db 抛错时 → **200 + { list: [], total: 0 }**;
 *  - `POST .../verify` 在 db 抛错时 → **200 + { valid: true, totalChecked: 0 }**
 *    (`verifyAuditLogIntegrity([])` 对空输入直接判"链完好")—— 这是给审计员出具的假结论;
 *  - 导出侧把空页当末页 `break`,HTTP 仍是 200(静默截断)。
 *
 * 修后判据(缺一即"改回旧实现仍绿"):
 *  ① DB 抛错 ⇒ 5xx + 可归因错误码,响应里**没有** `data.list` 空成功;
 *  ② 成功路径仍 200 且 list/total 原样返回(不得为修 ① 而把正常读一起打死);
 *  ③ `/verify` 在 DB 抛错时**不再**回 `valid:true`;
 *  ④ 查询层每个读函数都抛 `AUDIT_CHAIN_UNAVAILABLE`,不是只修路由一处;
 *  ⑤ 源码结构锁:audit-queries 只剩写路径那一处 catch,不存在 catch-to-empty。
 *
 * 全程不连库:db/dbRead 用 vi.mock 桩掉;Fastify 错误处理器按生产 `server.ts`
 * 的 AppError 分支同形安装(statusCode + message + errorCode)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// ---------- 鉴权桩:admin(roleId=1),保持 preHandler 原样执行 ----------
const { mockAuthenticate } = vi.hoisted(() => ({ mockAuthenticate: vi.fn() }))
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
  checkAuth: vi.fn(),
}))

// ---------- DB 桩:读路径全部由 dbRead.execute 承担 ----------
const { dbReadExecute } = vi.hoisted(() => ({ dbReadExecute: vi.fn() }))
vi.mock('../src/db/index.js', () => ({
  db: { execute: vi.fn().mockResolvedValue([]), select: vi.fn(), transaction: vi.fn() },
  dbRead: { execute: dbReadExecute, select: vi.fn() },
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { auditLogRoutes } from '../src/routes/audit-log.js'
import {
  countAuditLogs,
  getLastAuditLogHash,
  groupByAction,
  groupByUser,
  selectAuditLogChain,
  selectAuditLogs,
  selectAuditLogsForExport,
  selectAuditLogsRange,
} from '../src/db/audit-queries.js'
import { AppError } from '../src/errors/AppError.js'

const CHAIN_LIST_URL = '/api/admin/audit-logs/audit-logs'
const CHAIN_VERIFY_URL = '/api/admin/audit-logs/audit-logs/verify'
const CHAIN_EXPORT_URL = '/api/admin/audit-logs/audit-logs/export'
const DB_FAULT = 'relation "audit_logs_chain" does not exist'

const ROW_A = {
  id: '11111111-1111-4111-8111-111111111111',
  timestamp: new Date('2026-11-01T00:00:00.000Z'),
  user_id: '22222222-2222-4222-8222-222222222222',
  action: 'auth.login',
  resource_type: 'session',
  resource_id: null,
  ip: '203.0.113.7',
  user_agent: 'Mozilla/5.0 (test)',
  result: 'success',
  metadata: { seq: 0 },
  prev_hash: '0'.repeat(64),
  current_hash: 'a'.repeat(64),
}
const ROW_B = {
  ...ROW_A,
  id: '33333333-3333-4333-8333-333333333333',
  timestamp: new Date('2026-11-01T00:00:01.000Z'),
  action: 'data.read',
  prev_hash: 'a'.repeat(64),
  current_hash: 'b'.repeat(64),
}
const RAW_ROWS = [ROW_A, ROW_B]

interface ChunkLike {
  constructor?: { name?: string }
  value?: unknown
  queryChunks?: unknown[]
}

/** 递归取 drizzle SQL 的文本片段(只读文本,不执行)。 */
function collectText(chunk: unknown, acc: { text: string }): void {
  if (!chunk || typeof chunk !== 'object') return
  const c = chunk as ChunkLike
  if (Array.isArray(c.value) && !Array.isArray(c.queryChunks)) {
    acc.text += c.value.join('')
    return
  }
  if (Array.isArray(c.queryChunks)) {
    for (const child of c.queryChunks) collectText(child, acc)
  }
}

function sqlText(query: unknown): string {
  const acc = { text: '' }
  collectText(query, acc)
  return acc.text
}

/** 典型页查询:列表 SQL + COUNT SQL(按 SQL 文本分流,不依赖调用顺序)。 */
function mockRowsAndCount(rows: Record<string, unknown>[]): void {
  dbReadExecute.mockImplementation(async (query: unknown) => {
    if (sqlText(query).includes('COUNT(*)')) return [{ cnt: rows.length }]
    return rows
  })
}

function expectAuditChainUnavailable(res: { statusCode: number; body: string }): void {
  expect(res.statusCode).toBe(503)
  const body = res.json() as {
    code?: unknown
    message?: unknown
    errorCode?: unknown
    data?: unknown
  }
  expect(body.code).toBe(503)
  expect(body.errorCode).toBe('AUDIT_CHAIN_UNAVAILABLE')
  expect(typeof body.message).toBe('string')
  expect(body.message).toContain('审计链')
  // 病灶指纹不得回来:不得是空成功的 200 信封
  expect(body.data).toBeUndefined()
}

describe('F-246 审计链查询失败 ⇒ 5xx(不得吞成空结果)', () => {
  let server: FastifyInstance

  beforeAll(async () => {
    server = Fastify({ logger: false })
    // 与 src/server.ts 的 errorHandler 同形:AppError 透传 statusCode + message + errorCode
    server.setErrorHandler((err, _request, reply) => {
      const statusCode = (err as { statusCode?: number }).statusCode ?? 500
      const appErr = err instanceof AppError ? err : null
      reply.status(statusCode).send({
        code: statusCode,
        message: appErr ? appErr.message : '服务器错误',
        ...(appErr ? { errorCode: appErr.errorCode } : {}),
      })
    })
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
    dbReadExecute.mockReset()
  })

  it('① GET 链列表:db 抛错 ⇒ 503 + AUDIT_CHAIN_UNAVAILABLE(旧代码此处 200 空列表)', async () => {
    dbReadExecute.mockRejectedValue(new Error(DB_FAULT))

    const res = await server.inject({
      method: 'GET',
      url: CHAIN_LIST_URL,
      headers: { authorization: 'Bearer t' },
    })

    expectAuditChainUnavailable(res)
    expect(res.body).not.toContain('"list":[]')
  })

  it('② 成功路径:db 正常 ⇒ 200 且 list/total 原样返回', async () => {
    mockRowsAndCount(RAW_ROWS)

    const res = await server.inject({
      method: 'GET',
      url: `${CHAIN_LIST_URL}?page=1&pageSize=20`,
      headers: { authorization: 'Bearer t' },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      code: number
      data: { list: Array<{ id: string; action: string }>; total: number; page: number }
    }
    expect(body.code).toBe(0)
    expect(body.data.total).toBe(2)
    expect(body.data.page).toBe(1)
    expect(body.data.list.map((r) => r.id)).toEqual([ROW_A.id, ROW_B.id])
    expect(body.data.list.map((r) => r.action)).toEqual(['auth.login', 'data.read'])
  })

  it('③ POST 链验证:db 抛错 ⇒ 503,不再回 valid:true 的假结论', async () => {
    dbReadExecute.mockRejectedValue(new Error(DB_FAULT))

    const res = await server.inject({
      method: 'POST',
      url: CHAIN_VERIFY_URL,
      headers: { authorization: 'Bearer t' },
      payload: { limit: 100 },
    })

    expectAuditChainUnavailable(res)
    expect(res.body).not.toContain('"valid":true')
  })

  it('④ GET 链导出:取数阶段失败 ⇒ 503(不是 200 + 一行 export failed)', async () => {
    dbReadExecute.mockRejectedValue(new Error(DB_FAULT))

    const res = await server.inject({
      method: 'GET',
      url: CHAIN_EXPORT_URL,
      headers: { authorization: 'Bearer t' },
    })

    expectAuditChainUnavailable(res)
  })

  it('⑤ 查询层每个读函数都抛 AUDIT_CHAIN_UNAVAILABLE,不是只修路由一处', async () => {
    const calls: Array<[string, () => Promise<unknown>]> = [
      ['selectAuditLogs', () => selectAuditLogs({}, 1, 20)],
      ['selectAuditLogsForExport', () => selectAuditLogsForExport({}, null, 500)],
      ['selectAuditLogChain', () => selectAuditLogChain(ROW_A.user_id, 100)],
      ['selectAuditLogsRange', () => selectAuditLogsRange(undefined, undefined, 100)],
      ['countAuditLogs', () => countAuditLogs({})],
      ['getLastAuditLogHash', () => getLastAuditLogHash()],
      ['groupByAction', () => groupByAction({})],
      ['groupByUser', () => groupByUser({})],
    ]

    for (const [name, call] of calls) {
      dbReadExecute.mockRejectedValue(new Error(DB_FAULT))
      await expect(call(), `${name} 必须把 DB 故障抛出去`).rejects.toMatchObject({
        statusCode: 503,
        errorCode: 'AUDIT_CHAIN_UNAVAILABLE',
      })
    }
  })

  it('⑥ 结构锁:audit-queries 只剩写路径一处 catch,无 catch-to-empty', () => {
    const source = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '../src/db/audit-queries.ts'),
      'utf8',
    )

    // 8 处读查询 catch 全部改写为 auditQueryFailed;仅 insertAuditLog(写路径)保留降级
    expect(source.match(/auditQueryFailed\('.*?'/g) ?? []).toHaveLength(8)
    expect(source.match(/\bcatch\s*\(/g) ?? []).toHaveLength(9)
    expect(source).toContain("logger.warn('[audit-queries] insertAuditLog failed")
    // 写路径那处 catch 只能是 `return undefined`,不得吞成空结果
    const catchBody = source.slice(source.search(/\bcatch\s*\(/), source.search(/\bcatch\s*\(/) + 400)
    expect(catchBody).toContain('return undefined')
    expect(catchBody).not.toContain('return []')
    expect(catchBody).not.toContain('return 0')
    expect(catchBody).not.toContain('GENESIS')
    // 吞空结果的指纹不得回来
    expect(source).not.toContain('return { list: [], total: 0 }')
    for (const op of [
      'selectAuditLogs',
      'selectAuditLogsForExport',
      'selectAuditLogChain',
      'selectAuditLogsRange',
      'countAuditLogs',
      'getLastAuditLogHash',
      'groupByAction',
      'groupByUser',
    ]) {
      expect(source, `${op} 的吞错警告不得回来`).not.toContain(
        `[audit-queries] ${op} failed (table not ready?)`,
      )
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
