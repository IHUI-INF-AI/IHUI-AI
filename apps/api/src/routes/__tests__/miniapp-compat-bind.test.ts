// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 小程序 compat 绑定手机/邮箱端点行为锁(2026-10-25,补建批次同批落)。
 *
 * 立因:`pkg-user/user/phone.tsx` 打 POST /user/phone/bind、`email.tsx` 打 POST /user/email/bind,
 * 而后端注册面此前从未有过这两条 ⇒ "绑定"这一步每次 404,被前端 catch 吞成无响应。
 * 补建之后必须把三条不变量钉死(§5「认证不等于授权」+「越权用例断言副作用没发生」):
 *  1. 匿名不发写库(401);
 *  2. 验证码没验过 ⇒ 一行都不写(写库链零调用);
 *  3. 号/邮箱被**别人**占用 ⇒ 409 且不写;被**自己**占用(同号重绑)= 正向对照,照写;
 *  4. 写库 where 必须锚令牌主体(userId 来自 checkAuth 注入,绝不来自请求体)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.REDIS_URL ??= 'redis://localhost:6379/0'
})

vi.mock('../../config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:8810/test',
    REDIS_URL: 'redis://localhost:8811',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
  },
}))

const { mockVerifyAccessToken } = vi.hoisted(() => ({ mockVerifyAccessToken: vi.fn() }))

vi.mock('@ihui/auth', () => ({
  signAccessToken: vi.fn().mockResolvedValue('mock-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-token'),
  verifyAccessToken: mockVerifyAccessToken,
  createFamilyId: vi.fn().mockReturnValue('00000000-0000-4000-8000-000000000002'),
}))

vi.mock('jose', () => ({ decodeJwt: vi.fn(() => ({ type: 'access' })) }))
vi.mock('../../db/usercenter-queries.js', () => ({ getUserStatus: vi.fn().mockResolvedValue(1) }))

// 验证码消费口:测试面逐条控制"验过/没验过",绝不真连 Redis
const { mockVerifyCode } = vi.hoisted(() => ({ mockVerifyCode: vi.fn() }))
vi.mock('../../utils/code-store.js', () => ({ verifyCode: mockVerifyCode }))

// db 双链记录:update 链的 set/where 实参与 dbRead 占用查的返回
const { mockDbUpdate, mockReadSelect, updateCalls } = vi.hoisted(() => ({
  mockDbUpdate: vi.fn(),
  mockReadSelect: vi.fn(),
  updateCalls: [] as Array<{ setArg: Record<string, unknown>; whereArg: unknown }>,
}))
vi.mock('../../db/index.js', () => ({
  db: {
    update: mockDbUpdate,
    insert: vi.fn(),
    delete: vi.fn(),
    select: vi.fn(),
    execute: vi.fn(),
  },
  dbRead: { select: mockReadSelect, execute: vi.fn() },
}))

import { miniappCompatRoutes } from '../miniapp-compat-routes.js'

const SELF_ID = '00000000-0000-4000-8000-000000000010'
const OTHER_ID = '00000000-0000-4000-8000-000000000099'
const PHONES = '13800001111'
const EMAIL = 'bind@example.com'
const AUTH_HEADERS = { authorization: 'Bearer mock-token' }

function mockAuth(): void {
  mockVerifyAccessToken.mockResolvedValue({ userId: SELF_ID, roleId: 0, type: 'access' })
}

/** dbRead.select(...).from(...).where(...).limit(1) → 占用查询返回 rows */
function mockOccupied(rows: Array<{ id: string }>): void {
  mockReadSelect.mockImplementation(() => {
    const chain: Record<string, unknown> = {}
    chain.from = vi.fn(() => chain)
    chain.where = vi.fn(() => chain)
    chain.limit = vi.fn().mockResolvedValue(rows)
    return chain
  })
}

/** db.update(...).set(...).where(...).returning(...) → 记录实参并返回 rows */
function mockUpdateReturning(rows: unknown[]): void {
  mockDbUpdate.mockImplementation(() => {
    const chain: Record<string, unknown> = {}
    chain.set = vi.fn((v: Record<string, unknown>) => {
      chain._set = v
      return chain
    })
    chain.where = vi.fn((w: unknown) => {
      updateCalls.push({ setArg: chain._set as Record<string, unknown>, whereArg: w })
      return chain
    })
    chain.returning = vi.fn().mockResolvedValue(rows)
    return chain
  })
}

/**
 * 从 drizzle 0.38 的 SQL 条件树里收集全部 Param 值(取法同 exam-signup-ownership.test.ts:
 * 0.38 的 SQL 没有 toSQL(),`Param{brand,value,encoder}` 住在 queryChunks 深处;
 * 对 SQL 对象 JSON.stringify 会撞循环引用 —— 那是尺子自身的坑,不是被测代码的坑)。
 */
function collectParamValues(node: unknown, acc: unknown[]): void {
  if (node === null || typeof node !== 'object') return
  const o = node as Record<string, unknown>
  if (Array.isArray(o.queryChunks)) {
    for (const inner of o.queryChunks) collectParamValues(inner, acc)
    return
  }
  if ('value' in o && typeof o.encoder === 'object') {
    acc.push(o.value) // Param 叶子
  }
}

describe('compat 绑定手机/邮箱端点(POST /user/phone/bind、/user/email/bind)', () => {
  const server = Fastify({ logger: false })
  server.register(miniappCompatRoutes, { prefix: '/api' })

  beforeAll(async () => {
    await server.ready()
  })
  afterAll(async () => {
    await server.close()
  })
  beforeEach(() => {
    vi.clearAllMocks()
    updateCalls.length = 0
    mockAuth()
    mockVerifyCode.mockResolvedValue(true)
    mockOccupied([])
    mockUpdateReturning([{ id: SELF_ID }])
  })

  /* ── phone ── */
  it('匿名不发请求体进写库:401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/user/phone/bind',
      payload: { phone: PHONES, code: '123456' },
    })
    expect(res.statusCode).toBe(401)
    expect(mockDbUpdate).not.toHaveBeenCalled()
  })

  it('验证码错 ⇒ 一行都不写(副作用没发生)', async () => {
    mockVerifyCode.mockResolvedValue(false)
    const res = await server.inject({
      method: 'POST',
      url: '/api/user/phone/bind',
      payload: { phone: PHONES, code: '000000' },
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(400)
    expect(mockDbUpdate).not.toHaveBeenCalled()
  })

  it('被他人占用 ⇒ 409,且写库链零调用', async () => {
    mockOccupied([{ id: OTHER_ID }])
    const res = await server.inject({
      method: 'POST',
      url: '/api/user/phone/bind',
      payload: { phone: PHONES, code: '123456' },
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(409)
    expect(mockDbUpdate).not.toHaveBeenCalled()
  })

  it('被自己占用(同号重绑)= 正向对照:照写、where 锚令牌主体', async () => {
    mockOccupied([{ id: SELF_ID }])
    const res = await server.inject({
      method: 'POST',
      url: '/api/user/phone/bind',
      payload: { phone: PHONES, code: '123456' },
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ bound: true, phone: PHONES })
    // 请求体里没有 userId —— 归属只能来自令牌注入,这是 §5 的反查点
    expect(updateCalls).toHaveLength(1)
    const call = updateCalls[0]
    if (!call) throw new Error('捕获为空(夹具与真实写链错位)')
    const params: unknown[] = []
    collectParamValues(call.whereArg, params)
    expect(params).toContain(SELF_ID)
  })

  it('手机号形态不符(10 位)⇒ 400,且不消费验证码', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/user/phone/bind',
      payload: { phone: '1380000111', code: '123456' },
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(400)
    expect(mockVerifyCode).not.toHaveBeenCalled()
    expect(mockDbUpdate).not.toHaveBeenCalled()
  })

  /* ── email ── */
  it('email:匿名/错码/他人占用 三闸同型', async () => {
    const anon = await server.inject({
      method: 'POST',
      url: '/api/user/email/bind',
      payload: { email: EMAIL, code: '123456' },
    })
    expect(anon.statusCode).toBe(401)

    mockVerifyCode.mockResolvedValue(false)
    const badCode = await server.inject({
      method: 'POST',
      url: '/api/user/email/bind',
      payload: { email: 'ok@example.com', code: '123456' },
      headers: AUTH_HEADERS,
    })
    expect(badCode.statusCode).toBe(400)

    mockVerifyCode.mockResolvedValue(true)
    mockOccupied([{ id: OTHER_ID }])
    const taken = await server.inject({
      method: 'POST',
      url: '/api/user/email/bind',
      payload: { email: EMAIL, code: '123456' },
      headers: AUTH_HEADERS,
    })
    expect(taken.statusCode).toBe(409)
    expect(mockDbUpdate).not.toHaveBeenCalled()
  })

  it('email:正向对照 —— 合法链路写入并回 bound', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/user/email/bind',
      payload: { email: EMAIL, code: '123456' },
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ bound: true, email: EMAIL })
    expect(updateCalls).toHaveLength(1)
    const call = updateCalls[0]
    if (!call) throw new Error('捕获为空(夹具与真实写链错位)')
    const params: unknown[] = []
    collectParamValues(call.whereArg, params)
    expect(params).toContain(SELF_ID)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
