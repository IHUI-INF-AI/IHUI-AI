// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// F-135/F-136 夹具:智能体购买/续费必须由服务端定价,续费不得直接延长权益。

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requireAdmin: vi.fn(),
  requireActiveUser: vi.fn(),
  dbSelect: vi.fn(),
  dbInsert: vi.fn(),
  dbUpdate: vi.fn(),
  dbDelete: vi.fn(),
  dbExecute: vi.fn(),
  calcPermission: vi.fn(),
  getHistory: vi.fn(),
  genOrderNo: vi.fn(),
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAuth: mocks.requireAuth,
  requireAdmin: mocks.requireAdmin,
  isSystemAdmin: (request: { jwtPayload?: { roleId?: number } }) =>
    (request.jwtPayload?.roleId ?? 0) >= 1,
}))
vi.mock('../src/plugins/auth.js', () => ({
  requireActiveUser: mocks.requireActiveUser,
}))
vi.mock('../src/db/index.js', () => ({
  db: {
    execute: mocks.dbExecute,
    select: mocks.dbSelect,
    insert: mocks.dbInsert,
    update: mocks.dbUpdate,
    delete: mocks.dbDelete,
  },
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

const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const AGENT_ID = '11111111-1111-4111-8111-111111111111'
const ORDER_ID = '22222222-2222-4222-8222-222222222222'

type Chain = {
  then: (resolve?: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise<unknown>
  [m: string]: unknown
}

function chain(finalValue: unknown): Chain {
  const obj: Record<string, unknown> = {
    then: (resolve?: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(finalValue).then(resolve, reject),
  }
  for (const m of ['from', 'where', 'limit', 'offset', 'orderBy', 'values', 'set', 'returning']) {
    obj[m] = vi.fn().mockReturnValue(obj)
  }
  return obj as Chain
}

/** 捕获 insert 的 values,并让 returning() 返回给定行。 */
function insertChain(returned: unknown[], sink: Array<Record<string, unknown>>): Chain {
  const c = chain(returned)
  c.values = vi.fn((values: Record<string, unknown>) => {
    sink.push(values)
    return c
  })
  return c
}

const errorHandler = (
  err: Error & { name?: string; issues?: Array<{ message?: string }>; statusCode?: number },
  _req: unknown,
  reply: { status: (code: number) => { send: (body: unknown) => void }; sent?: boolean },
): void => {
  if (reply.sent) return
  const isZod = err.name === 'ZodError' && Array.isArray(err.issues)
  const statusCode = isZod
    ? 400
    : typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 600
      ? err.statusCode
      : 500
  reply.status(statusCode).send({
    code: statusCode,
    message: isZod ? (err.issues?.[0]?.message ?? '参数错误') : (err.message ?? '服务器错误'),
  })
}

describe('F-135/F-136 智能体购买与续费的服务端定价', () => {
  let app: FastifyInstance
  const inserted: Array<Record<string, unknown>> = []

  beforeAll(async () => {
    app = Fastify({ logger: false })
    app.setErrorHandler(errorHandler as never)
    await app.register(agentExtendedRoutes)
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    inserted.length = 0
    mocks.requireAuth.mockImplementation(async (request: { userId?: string }) => {
      request.userId = USER_ID
    })
    mocks.requireActiveUser.mockResolvedValue(undefined)
    mocks.calcPermission.mockResolvedValue({ hasPermission: true })
    mocks.dbExecute.mockResolvedValue([])
    mocks.dbDelete.mockReturnValue(chain([]))
  })

  it('F-135 购买价取服务端 agents.price', async () => {
    mocks.dbSelect.mockReturnValueOnce(chain([{ price: 9900, isFree: false }]))
    mocks.dbInsert.mockReturnValue(insertChain([{ id: ORDER_ID, status: 'pending' }], inserted))

    const res = await app.inject({
      method: 'POST',
      url: '/buy/create',
      payload: { agentId: AGENT_ID, userId: USER_ID, duration: 30 },
    })

    expect(res.statusCode).toBe(201)
    expect(inserted).toHaveLength(1)
    expect(inserted[0]?.price).toBe('99.00')
    expect(inserted[0]?.status).toBe('pending')
    // 变异自证:把 price 改回 body.price.toString() 后,这里会拿到客户端价而翻红。
  })

  it('F-228 请求体带 price=21000 ⇒ 400 显式拒绝,不静默忽略、不落单', async () => {
    mocks.dbSelect.mockReturnValueOnce(chain([{ price: 9900, isFree: false }]))

    const res = await app.inject({
      method: 'POST',
      url: '/buy/create',
      payload: { agentId: AGENT_ID, userId: USER_ID, duration: 30, price: 21000 },
    })

    expect(res.statusCode).toBe(400)
    expect(mocks.dbInsert).not.toHaveBeenCalled()
    expect(inserted).toHaveLength(0)
    // 改前:zod 默认 strip 掉 price,返回 201 并静默按服务端价落单 ⇒ 本断言红。
    // 改后:显式 400,客户端不可能以为 21000(2,100,000 分)参与了计价。
  })

  it('F-135 免费智能体按 0 元落库(以服务端 isFree 为准)', async () => {
    mocks.dbSelect.mockReturnValueOnce(chain([{ price: 9900, isFree: true }]))
    mocks.dbInsert.mockReturnValue(insertChain([{ id: ORDER_ID }], inserted))

    const res = await app.inject({
      method: 'POST',
      url: '/buy/create',
      payload: { agentId: AGENT_ID, userId: USER_ID, duration: 30 },
    })

    expect(res.statusCode).toBe(201)
    expect(inserted[0]?.price).toBe('0.00')
  })

  it('F-135 智能体不存在 ⇒ 404,且不落购买单', async () => {
    mocks.dbSelect.mockReturnValueOnce(chain([]))

    const res = await app.inject({
      method: 'POST',
      url: '/buy/create',
      payload: { agentId: AGENT_ID, userId: USER_ID, duration: 30 },
    })

    expect(res.statusCode).toBe(404)
    expect(mocks.dbInsert).not.toHaveBeenCalled()
  })

  it('F-135 时长超过上限 ⇒ 400,且不落购买单', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/buy/create',
      payload: { agentId: AGENT_ID, userId: USER_ID, duration: 3651 },
    })

    expect(res.statusCode).toBe(400)
    expect(mocks.dbInsert).not.toHaveBeenCalled()
  })

  it('F-136 续费只生成待支付订单,不再直接延长原记录权益', async () => {
    // 固定未来时刻,避免 Date.now() 在同一次断言里两次取值产生 1ms 抖动。
    const oldExpiresAt = new Date('2027-06-01T00:00:00.000Z')
    mocks.dbSelect
      .mockReturnValueOnce(chain([{ id: ORDER_ID, agentId: AGENT_ID, expiresAt: oldExpiresAt }]))
      .mockReturnValueOnce(chain([{ price: 19800, isFree: false }]))
    mocks.dbInsert.mockReturnValue(insertChain([{ id: 'renew-1', status: 'pending' }], inserted))
    mocks.dbUpdate.mockReturnValue(chain([]))

    const res = await app.inject({
      method: 'POST',
      url: '/developer/renew',
      payload: { agentId: AGENT_ID, userId: USER_ID, duration: 30 },
    })

    expect(res.statusCode).toBe(201)
    expect(mocks.dbUpdate).not.toHaveBeenCalled()
    expect(inserted).toHaveLength(1)
    expect(inserted[0]?.price).toBe('198.00')
    expect(inserted[0]?.status).toBe('pending')
    expect((inserted[0]?.expiresAt as Date).getTime()).toBe(oldExpiresAt.getTime() + 30 * 86400000)
    // 变异自证:恢复"直接 UPDATE 原记录 expiresAt"后,dbUpdate 会被调用且无新订单,本断言翻红。
  })

  it('F-136 续费时长超过上限 ⇒ 400,且不落续费单', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/developer/renew',
      payload: { agentId: AGENT_ID, userId: USER_ID, duration: 3651 },
    })

    expect(res.statusCode).toBe(400)
    expect(mocks.dbInsert).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
