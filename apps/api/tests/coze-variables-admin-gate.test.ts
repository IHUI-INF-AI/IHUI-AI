// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-137(P2,越权域):`/api/coze/variables/*` 全局 Coze 变量表无租户隔离。
 *
 * 立因:`apps/api/src/routes/coze-variables.ts` 此前只挂 `checkAuth`,
 * 任意登录用户即可:
 *   ① GET  /retrieve?variableName=xxx&botId=yyy ⇒ 读到整行(含 `variableValue`,常为 token/密钥);
 *   ② POST /update                              ⇒ 按 uuid 覆盖任意变量的值/描述;
 *   ③ POST /delete                              ⇒ 按 uuid 删除任意变量。
 * 变量表是平台级资产,没有 user/tenant 列,所以正确收口是整片挂 `requireAdmin`。
 *
 * 本文件钉:未登录 401、普通用户三条(含 create 写面)全 403 且零写、403 响应不泄漏
 * `variableValue`、管理员正向能力不被误伤(恰好一次副作用)、既有 400/404/200 不因收口变 500。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const h = vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  return {
    writes: [] as Array<{ op: string; id?: string; data?: Record<string, unknown> }>,
    row: null as Record<string, unknown> | null,
  }
})

const queries = vi.hoisted(() => ({
  findByName: vi.fn(),
  findList: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}))

const mockRequireAdmin = vi.hoisted(() => vi.fn())

// 身份从请求头注入:缺 x-test-role ⇒ 401;roleId >= 1 ⇒ 管理员。与真实 refine 同语义。
vi.mock('../src/plugins/auth.js', () => {
  interface MockRequest {
    headers: Record<string, string | string[] | undefined>
    userId?: string
    jwtPayload?: { userId?: string; roleId?: number }
  }
  interface MockReply {
    status: (code: number) => { send: (body: unknown) => void }
  }
  const authenticate = (request: MockRequest): void => {
    const role = request.headers['x-test-role']
    if (role === undefined) {
      const err = new Error('Authentication required') as Error & { statusCode: number }
      err.statusCode = 401
      throw err
    }
    request.userId = String(request.headers['x-test-user'] ?? '')
    request.jwtPayload = { userId: request.userId, roleId: Number(role) }
  }
  return {
    authenticate: async (request: MockRequest) => authenticate(request),
    checkAuth: async (request: MockRequest, reply: MockReply): Promise<boolean> => {
      try {
        authenticate(request)
        return true
      } catch (e) {
        const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
        reply.status(statusCode).send({ code: statusCode, message: 'Authentication required' })
        return false
      }
    },
    requireActiveUser: async () => undefined,
  }
})

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: mockRequireAdmin,
}))

vi.mock('../src/db/misc-queries.js', () => ({
  findCozeVariableList: queries.findList,
  findCozeVariableByName: queries.findByName,
  createCozeVariable: queries.create,
  updateCozeVariable: queries.update,
  deleteCozeVariable: queries.remove,
}))

import { cozeVariablesRoutes } from '../src/routes/coze-variables.js'

const BOT_ID = 'bot-1'
const VAR_ID = '11111111-1111-4111-8111-111111111111'
const SECRET = 'COZE_SECRET_TOKEN_VALUE_DO_NOT_LEAK'
const ROW = {
  id: VAR_ID,
  botId: BOT_ID,
  variableName: 'secret_token',
  variableValue: SECRET,
  description: null,
  dataType: 'string',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
}

function authHeaders(roleId: number, userId = 'u-test') {
  return { 'x-test-role': String(roleId), 'x-test-user': userId }
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(cozeVariablesRoutes, { prefix: '/api/coze/variables' })
  await app.ready()
  return app
}

beforeEach(() => {
  h.writes.length = 0
  h.row = { ...ROW }
  queries.findByName.mockReset()
  queries.findList.mockReset()
  queries.create.mockReset()
  queries.update.mockReset()
  queries.remove.mockReset()
  mockRequireAdmin.mockReset()

  queries.findByName.mockImplementation(async () => h.row ?? undefined)
  queries.findList.mockResolvedValue({ list: h.row ? [h.row] : [], total: 1, page: 1, pageSize: 20 })
  queries.create.mockImplementation(async (data: Record<string, unknown>) => ({ ...ROW, ...data }))
  queries.update.mockImplementation(async (id: string, data: Record<string, unknown>) => {
    h.writes.push({ op: 'update', id, data })
    return h.row ? { ...h.row, ...data, id } : undefined
  })
  queries.remove.mockImplementation(async (id: string) => {
    h.writes.push({ op: 'delete', id })
  })

  // 真实 requireAdmin 的替身:未登录 401;非管理员 403(且不得落到 handler / 写库);管理员放行。
  mockRequireAdmin.mockImplementation(
    async (
      request: { headers: Record<string, string | string[] | undefined>; userId?: string },
      reply: { status: (code: number) => { send: (body: unknown) => void } },
    ): Promise<void> => {
      const role = request.headers['x-test-role']
      if (role === undefined) {
        reply.status(401).send({ code: 401, message: 'Authentication required' })
        return
      }
      request.userId = String(request.headers['x-test-user'] ?? '')
      if (Number(role) < 1) {
        reply.status(403).send({ code: 403, message: '需要管理员权限' })
      }
    },
  )
})

describe('F-137 /api/coze/variables 全局变量面', () => {
  it('未登录:retrieve/update/delete 一律 401,零写且不泄漏变量值', async () => {
    const app = await buildApp()
    const retrieve = await app.inject({
      method: 'GET',
      url: '/api/coze/variables/retrieve?variableName=secret_token&botId=bot-1',
    })
    expect(retrieve.statusCode).toBe(401)
    expect(retrieve.body).not.toContain(SECRET)

    const update = await app.inject({
      method: 'POST',
      url: '/api/coze/variables/update',
      payload: { id: VAR_ID, variableValue: 'attacker' },
    })
    expect(update.statusCode).toBe(401)

    const del = await app.inject({
      method: 'POST',
      url: '/api/coze/variables/delete',
      payload: { id: VAR_ID },
    })
    expect(del.statusCode).toBe(401)

    expect(h.writes).toEqual([])
    await app.close()
  })

  it('普通登录用户(roleId=0):retrieve/update/delete/create 全 403,零写,403 体不含 variableValue', async () => {
    const app = await buildApp()
    const headers = authHeaders(0)

    const retrieve = await app.inject({
      method: 'GET',
      url: '/api/coze/variables/retrieve?variableName=secret_token&botId=bot-1',
      headers,
    })
    // 旧代码在这里返回 200 且 data.variableValue 为下面这串原文
    expect(retrieve.body).not.toContain(SECRET)
    expect(retrieve.body).not.toContain('variableValue')
    expect(retrieve.statusCode).toBe(403)

    const update = await app.inject({
      method: 'POST',
      url: '/api/coze/variables/update',
      headers,
      payload: { id: VAR_ID, variableValue: 'attacker' },
    })
    expect(update.statusCode).toBe(403)

    const del = await app.inject({
      method: 'POST',
      url: '/api/coze/variables/delete',
      headers,
      payload: { id: VAR_ID },
    })
    expect(del.statusCode).toBe(403)

    const create = await app.inject({
      method: 'POST',
      url: '/api/coze/variables/create',
      headers,
      payload: { botId: BOT_ID, variableName: 'attacker_key', variableValue: 'x' },
    })
    expect(create.statusCode).toBe(403)

    // 越权请求不得发生任何写副作用(不是"写了再回滚")
    expect(h.writes).toEqual([])
    await app.close()
  })

  it('管理员 retrieve → 200 且必要字段完整', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/api/coze/variables/retrieve?variableName=secret_token&botId=bot-1',
      headers: authHeaders(1),
    })
    expect(res.statusCode).toBe(200)
    const data = res.json().data as Record<string, unknown>
    expect(data.variableName).toBe('secret_token')
    expect(data.variableValue).toBe(SECRET)
    expect(data.botId).toBe(BOT_ID)
    expect(data.updatedAt).toBeTruthy()
    await app.close()
  })

  it('管理员 update/delete → 成功且副作用恰好一次', async () => {
    const app = await buildApp()
    const update = await app.inject({
      method: 'POST',
      url: '/api/coze/variables/update',
      headers: authHeaders(1),
      payload: { id: VAR_ID, variableValue: 'rotated', description: '轮转' },
    })
    expect(update.statusCode).toBe(200)
    expect(h.writes).toHaveLength(1)
    expect(h.writes[0]).toMatchObject({ op: 'update', id: VAR_ID })
    expect(h.writes[0]?.data).toMatchObject({ variableValue: 'rotated', description: '轮转' })

    h.writes.length = 0
    const del = await app.inject({
      method: 'POST',
      url: '/api/coze/variables/delete',
      headers: authHeaders(1),
      payload: { id: VAR_ID },
    })
    expect(del.statusCode).toBe(200)
    expect(h.writes).toHaveLength(1)
    expect(h.writes[0]).toMatchObject({ op: 'delete', id: VAR_ID })
    await app.close()
  })

  it('管理员侧既有错误码不变:不存在 404 / 非法 uuid 400 / 删除不存在仍 200,均不掉 500', async () => {
    const app = await buildApp()
    const headers = authHeaders(1)

    h.row = null
    const missing = await app.inject({
      method: 'GET',
      url: '/api/coze/variables/retrieve?variableName=nope',
      headers,
    })
    expect(missing.statusCode).toBe(404)

    h.writes.length = 0
    const badUuidUpdate = await app.inject({
      method: 'POST',
      url: '/api/coze/variables/update',
      headers,
      payload: { id: 'not-a-uuid', variableValue: 'x' },
    })
    expect(badUuidUpdate.statusCode).toBe(400)
    expect(h.writes).toEqual([])

    const badUuidDelete = await app.inject({
      method: 'POST',
      url: '/api/coze/variables/delete',
      headers,
      payload: { id: 'not-a-uuid' },
    })
    expect(badUuidDelete.statusCode).toBe(400)
    expect(h.writes).toEqual([])

    h.row = null
    const missingUpdate = await app.inject({
      method: 'POST',
      url: '/api/coze/variables/update',
      headers,
      payload: { id: '22222222-2222-4222-8222-222222222222', variableValue: 'x' },
    })
    expect(missingUpdate.statusCode).toBe(404)

    const missingDelete = await app.inject({
      method: 'POST',
      url: '/api/coze/variables/delete',
      headers,
      payload: { id: '22222222-2222-4222-8222-222222222222' },
    })
    // 既有语义:delete 对不存在的 id 也回成功;收口不得把它变成 500
    expect(missingDelete.statusCode).toBe(200)
    await app.close()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
