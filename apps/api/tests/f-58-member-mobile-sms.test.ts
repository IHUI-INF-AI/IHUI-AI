// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-58:POST /api/members/register/mobile 必须真正校验短信验证码。
 *
 * 判据:
 *  - 缺码 / 错码 / 过期码 / 复用码一律 400,且不落库;
 *  - 正确码注册成功,码被一次性消费;
 *  - 校验复用 code-store.verifyCode(与 /auth/sms/register 同源),不新造存储。
 *
 * 不连真实 DB/Redis:member-queries 全量 mock;REDIS_URL 指到死端口 ⇒ code-store 走内存兜底。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.NODE_ENV = 'test'
})

const { mockRegisterMemberByMobile } = vi.hoisted(() => ({
  mockRegisterMemberByMobile: vi.fn(),
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'info',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:5432/test',
    // 死端口 ⇒ code-store 回退进程内存储,测试不依赖真实 Redis
    REDIS_URL: 'redis://127.0.0.1:1/0',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
  },
}))

vi.mock('../src/db/member-queries.js', () => {
  class MemberConflictError extends Error {
    statusCode = 409
    constructor(message: string) {
      super(message)
      this.name = 'MemberConflictError'
    }
  }
  return {
    findMembers: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
    findUnauditedMembers: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
    findMemberById: vi.fn(),
    findMembersByIds: vi.fn().mockResolvedValue([]),
    findAuthMembers: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
    createMember: vi.fn(),
    updateMember: vi.fn(),
    setMemberStatus: vi.fn(),
    resetMemberPassword: vi.fn(),
    deleteMember: vi.fn(),
    registerMember: vi.fn(),
    registerMemberByMobile: mockRegisterMemberByMobile,
    findMemberCompanies: vi.fn().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 }),
    findMemberLevels: vi.fn().mockResolvedValue([]),
    findMemberLevelById: vi.fn(),
    createMemberLevel: vi.fn(),
    updateMemberLevel: vi.fn(),
    deleteMemberLevel: vi.fn(),
    getMemberStatistics: vi.fn().mockResolvedValue({ total: 0, active: 0, pending: 0, sealed: 0 }),
    MemberConflictError,
  }
})

import { memberRoutes } from '../src/routes/member.js'
import {
  __test__ as codeStoreTest,
  putCodeEntry,
  CODE_TTL_MS,
  type CodeEntry,
} from '../src/utils/code-store.js'

const MOBILE = '13800000001'

async function seedCode(code: string, ttlMs = CODE_TTL_MS): Promise<void> {
  const now = Date.now()
  await putCodeEntry(MOBILE, { code, expiresAt: now + ttlMs, sentAt: now } as CodeEntry)
}

let app: FastifyInstance

function postRegister(payload: Record<string, unknown>) {
  return app.inject({ method: 'POST', url: '/api/members/register/mobile', payload })
}

describe('F-58 member 手机号注册验证码校验', () => {
  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(memberRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(async () => {
    vi.clearAllMocks()
    await codeStoreTest.reset()
    mockRegisterMemberByMobile.mockResolvedValue({ id: 'member-001', mobile: MOBILE })
  })

  it('反例:缺码 ⇒ 400 且不落库', async () => {
    const res = await postRegister({ mobile: MOBILE, password: 'password123' })
    expect(res.statusCode).toBe(400)
    expect(typeof res.json().message).toBe('string')
    expect(mockRegisterMemberByMobile).not.toHaveBeenCalled()
  })

  it('反例:错码 ⇒ 400,不消费原码、不落库', async () => {
    await seedCode('246810')
    const res = await postRegister({ mobile: MOBILE, password: 'password123', code: '999999' })
    expect(res.statusCode).toBe(400)
    expect(res.json().message).toContain('验证码错误或已过期')
    expect(await codeStoreTest.exists(MOBILE)).toBe(true)
    expect(mockRegisterMemberByMobile).not.toHaveBeenCalled()
  })

  it('反例:过期码 ⇒ 400 且不落库', async () => {
    await seedCode('246810', -1000)
    const res = await postRegister({ mobile: MOBILE, password: 'password123', code: '246810' })
    expect(res.statusCode).toBe(400)
    expect(mockRegisterMemberByMobile).not.toHaveBeenCalled()
  })

  it('正例:正确码 ⇒ 201 且码被一次性消费', async () => {
    await seedCode('246810')
    const res = await postRegister({
      mobile: MOBILE,
      password: 'password123',
      code: '246810',
      nickname: '昵称',
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().data).toEqual({ id: 'member-001', mobile: MOBILE })
    expect(mockRegisterMemberByMobile).toHaveBeenCalledTimes(1)
    expect(mockRegisterMemberByMobile).toHaveBeenCalledWith({
      mobile: MOBILE,
      password: 'password123',
      nickname: '昵称',
    })
    expect(await codeStoreTest.exists(MOBILE)).toBe(false)
  })

  it('复用同一枚码 ⇒ 第二次 400(一次性)', async () => {
    await seedCode('135790')
    const first = await postRegister({ mobile: MOBILE, password: 'password123', code: '135790' })
    expect(first.statusCode).toBe(201)
    const second = await postRegister({ mobile: MOBILE, password: 'password123', code: '135790' })
    expect(second.statusCode).toBe(400)
    expect(second.json().message).toContain('验证码错误或已过期')
    expect(mockRegisterMemberByMobile).toHaveBeenCalledTimes(1)
  })

  it('无码抢注被拒后,真号主带正确码仍能注册(号码未被抢占)', async () => {
    const stolen = await postRegister({ mobile: MOBILE, password: 'password123', code: 'x' })
    expect(stolen.statusCode).toBe(400)
    expect(mockRegisterMemberByMobile).not.toHaveBeenCalled()

    await seedCode('654321')
    const owner = await postRegister({ mobile: MOBILE, password: 'password123', code: '654321' })
    expect(owner.statusCode).toBe(201)
    expect(mockRegisterMemberByMobile).toHaveBeenCalledTimes(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
