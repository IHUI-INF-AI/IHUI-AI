// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-363(P2):`rule-params` 写面漏 admin。
 *
 * 同资源的 `DELETE /api/agent-ext/rule-params/:id` 已是 requireAdmin,而
 * `POST /rule-params` 与 `PUT /rule-params/:id` 此前只有插件级 requireAuth ——
 * 任意登录用户可新增/改写他人的规则参数。读接口(list/:id)不在本票范围,保持现状。
 *
 * 本文件钉住:
 *  ① 未登录 POST → 401;
 *  ② 普通登录用户 POST/PUT → 403 且零写(侧效应计数);
 *  ③ 管理员 POST/PUT → 成功,副作用恰好一次(防重复写/漏闸放行的"假成功")。
 *
 * 旧代码(POST/PUT 无 preHandler)下 ② 应为红:普通用户拿到 201/200 且写语句发出。
 *
 * 隔离:auth/RBAC 桩掉,db.execute 为纯内存 mock,不连 PG/Redis、零网络。
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FastifyReply, FastifyRequest } from 'fastify'
import Fastify from 'fastify'
import type { JWTPayload } from '@ihui/auth'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requireAdmin: vi.fn(),
  requireActiveUser: vi.fn(),
  dbExecute: vi.fn(),
  syncSettlement: vi.fn(),
  calcPermission: vi.fn(),
  getHistory: vi.fn(),
  genOrderNo: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(),
  requireActiveUser: mocks.requireActiveUser,
  default: vi.fn(),
}))
vi.mock('../src/plugins/require-permission.js', () => ({
  requireAuth: mocks.requireAuth,
  requireAdmin: mocks.requireAdmin,
  requirePermission: vi.fn(() => mocks.requireAuth),
  isSystemAdmin: (request: { jwtPayload?: { roleId?: number } }) =>
    (request.jwtPayload?.roleId ?? 0) >= 1,
}))
vi.mock('../src/db/index.js', () => ({
  db: { execute: mocks.dbExecute },
}))
vi.mock('../src/services/settlement-service.js', () => ({
  syncAgentBuyToSettlement: mocks.syncSettlement,
}))
vi.mock('../src/services/agent-service.js', () => ({
  calculateAgentPermission: mocks.calcPermission,
}))
vi.mock('../src/services/context-manager-service.js', () => ({
  getConversationHistory: mocks.getHistory,
}))
vi.mock('../src/utils/crypto-random.js', () => ({
  generateOrderNumber: mocks.genOrderNo,
}))

import agentExtendedRoutes from '../src/routes/agent-extended.js'

const USER_REGULAR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER_ADMIN = 'cccccccc-cccc-4ccc-accc-cccccccccccc'
const PARAM_ID = '11111111-1111-4111-8111-111111111111'

/**
 * 取 db.execute(sql`…`) 里的全部字符串:既含 SQL 文本块(StringChunk.value),
 * 也含真正绑定进去的参数(Param.value)。据此区分 SELECT / INSERT / UPDATE。
 */
function walkStrings(node: unknown, out: string[]): void {
  if (typeof node === 'string') {
    out.push(node)
    return
  }
  if (Array.isArray(node)) {
    for (const n of node) walkStrings(n, out)
    return
  }
  if (node && typeof node === 'object') {
    const rec = node as Record<string, unknown>
    if ('value' in rec) {
      walkStrings(rec.value, out)
    }
    if ('queryChunks' in rec) walkStrings(rec.queryChunks, out)
  }
}

let execCalls: string[] = []

/** 写语句计数:INSERT/UPDATE 才是副作用;SELECT 不算。 */
function writeCalls(): string[] {
  return execCalls.filter((text) => text.includes('INSERT') || text.includes('UPDATE'))
}

function makePayload(userId: string, roleId: number): JWTPayload {
  return { userId, phone: '', familyId: '', roleId }
}

function asAnonymous(): void {
  mocks.requireAuth.mockImplementation(
    async (_request: FastifyRequest, reply: FastifyReply) => {
      reply.status(401).send({ code: 401, message: 'Authentication required' })
    },
  )
  mocks.requireActiveUser.mockResolvedValue(undefined)
}

function asRegular(userId: string): void {
  mocks.requireAuth.mockImplementation(async (request: FastifyRequest) => {
    request.userId = userId
    request.jwtPayload = makePayload(userId, 0)
  })
  mocks.requireAdmin.mockImplementation(
    async (_request: FastifyRequest, reply: FastifyReply) => {
      reply.status(403).send({ code: 403, message: '需要管理员权限' })
    },
  )
  mocks.requireActiveUser.mockResolvedValue(undefined)
}

function asAdmin(userId: string): void {
  mocks.requireAuth.mockImplementation(async (request: FastifyRequest) => {
    request.userId = userId
    request.jwtPayload = makePayload(userId, 1)
  })
  mocks.requireAdmin.mockImplementation(async (request: FastifyRequest) => {
    request.userId = userId
    request.jwtPayload = makePayload(userId, 1)
  })
  mocks.requireActiveUser.mockResolvedValue(undefined)
}

describe('agent-extended rule-params 写面管理员闸(F-363)', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(agentExtendedRoutes)
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuth.mockReset()
    mocks.requireAdmin.mockReset()
    mocks.requireActiveUser.mockReset()
    mocks.dbExecute.mockReset()
    mocks.requireActiveUser.mockResolvedValue(undefined)

    execCalls = []
    mocks.dbExecute.mockImplementation(async (sqlObj: unknown) => {
      const values: string[] = []
      walkStrings(sqlObj, values)
      execCalls.push(values.join(' '))
      return [{ id: PARAM_ID, param_name: 'p', param_code: 'c', status: 1 }]
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('① 未登录 POST → 401,零写', async () => {
    asAnonymous()
    const res = await server.inject({
      method: 'POST',
      url: '/rule-params',
      payload: { param_name: 'p', param_code: 'c' },
    })
    expect(res.statusCode).toBe(401)
    expect(writeCalls()).toHaveLength(0)
  })

  it('② 普通登录用户 POST → 403 且零写(旧代码 201 + INSERT)', async () => {
    asRegular(USER_REGULAR)
    const res = await server.inject({
      method: 'POST',
      url: '/rule-params',
      payload: { param_name: 'p', param_code: 'c' },
    })
    expect(res.statusCode).toBe(403)
    expect(writeCalls()).toHaveLength(0)
  })

  it('② 普通登录用户 PUT → 403 且零写(旧代码 200 + UPDATE)', async () => {
    asRegular(USER_REGULAR)
    const res = await server.inject({
      method: 'PUT',
      url: `/rule-params/${PARAM_ID}`,
      payload: { param_name: 'p2' },
    })
    expect(res.statusCode).toBe(403)
    expect(writeCalls()).toHaveLength(0)
  })

  it('③ 管理员 POST → 201,INSERT 恰好一次', async () => {
    asAdmin(USER_ADMIN)
    const res = await server.inject({
      method: 'POST',
      url: '/rule-params',
      payload: { param_name: 'p', param_code: 'c' },
    })
    expect(res.statusCode).toBe(201)
    expect(execCalls.filter((t) => t.includes('INSERT'))).toHaveLength(1)
    expect(writeCalls()).toHaveLength(1)
  })

  it('③ 管理员 PUT → 200,UPDATE 恰好一次', async () => {
    asAdmin(USER_ADMIN)
    const res = await server.inject({
      method: 'PUT',
      url: `/rule-params/${PARAM_ID}`,
      payload: { param_name: 'p2' },
    })
    expect(res.statusCode).toBe(200)
    expect(execCalls.filter((t) => t.includes('UPDATE'))).toHaveLength(1)
    expect(writeCalls()).toHaveLength(1)
  })
})
