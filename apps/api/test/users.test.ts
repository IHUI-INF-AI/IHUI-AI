import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { hashPassword } from '../src/utils/password-crypto.js'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// 可控鉴权 mock:设置 request.userId / jwtPayload
const { mockAuthenticate, currentAuth } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  currentAuth: { userId: 'user-001', roleId: 0 },
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
  checkAuth: vi.fn(),
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
  },
}))

const {
  mockFindUserById,
  mockFindUserByPhone,
  mockIsSystemAdminUser,
  mockUpdateUser,
  mockMergeUserAccounts,
} = vi.hoisted(() => ({
  mockFindUserById: vi.fn(),
  mockFindUserByPhone: vi.fn(),
  mockIsSystemAdminUser: vi.fn(),
  mockUpdateUser: vi.fn(),
  mockMergeUserAccounts: vi.fn(),
}))

vi.mock('../src/db/queries.js', () => ({
  findUserById: mockFindUserById,
  findUserByPhone: mockFindUserByPhone,
  findUserByAccount: vi.fn(),
  isSystemAdminUser: mockIsSystemAdminUser,
  updateUser: mockUpdateUser,
  mergeUserAccounts: mockMergeUserAccounts,
  createUser: vi.fn(),
  cancelUserAccount: vi.fn(),
  findRefreshToken: vi.fn(),
  revokeRefreshToken: vi.fn(),
  revokeRefreshTokenFamily: vi.fn(),
}))

const { mockCountFollowing, mockCountFollowers, mockCountFavorites } = vi.hoisted(() => ({
  mockCountFollowing: vi.fn(),
  mockCountFollowers: vi.fn(),
  mockCountFavorites: vi.fn(),
}))

vi.mock('../src/db/social-queries.js', () => ({
  countFollowing: mockCountFollowing,
  countFollowers: mockCountFollowers,
  countFavorites: mockCountFavorites,
}))

const { mockUpdateUserPassword } = vi.hoisted(() => ({ mockUpdateUserPassword: vi.fn() }))
vi.mock('../src/db/usercenter-queries.js', () => ({
  updateUserPassword: mockUpdateUserPassword,
}))

const { mockVerifyCode } = vi.hoisted(() => ({ mockVerifyCode: vi.fn() }))
vi.mock('../src/utils/code-store.js', () => ({
  verifyCode: mockVerifyCode,
  codeStore: new Map(),
  CODE_TTL_MS: 300000,
  CODE_RESEND_INTERVAL_MS: 60000,
  generateCode: vi.fn().mockReturnValue('123456'),
  cleanupExpiredCodes: vi.fn(),
}))

const { mockDbExecute, dbQueue } = vi.hoisted(() => ({
  mockDbExecute: vi.fn(),
  dbQueue: { items: [] as unknown[][] },
}))

vi.mock('../src/db/index.js', () => {
  function createChain() {
    const chain: {
      then: (resolve: (value: unknown[]) => unknown) => Promise<unknown>
      [m: string]: unknown
    } = {
      then: (resolve) => {
        const result = dbQueue.items.length > 0 ? dbQueue.items.shift()! : []
        return Promise.resolve(result).then(resolve)
      },
    }
    for (const m of ['from', 'where', 'orderBy', 'limit', 'offset']) {
      chain[m] = () => chain
    }
    return chain
  }
  const factory = () => createChain()
  return {
    db: {
      execute: mockDbExecute,
      select: vi.fn(factory),
    },
  }
})

vi.mock('@ihui/database', () => ({
  userDevices: {
    id: 'ud.id',
    userId: 'ud.userId',
    fingerprintHash: 'ud.fingerprintHash',
    userAgent: 'ud.userAgent',
    ip: 'ud.ip',
    firstSeenAt: 'ud.firstSeenAt',
    lastSeenAt: 'ud.lastSeenAt',
    trusted: 'ud.trusted',
    lastLocation: 'ud.lastLocation',
  },
}))

import { usersRoutes } from '../src/routes/users.js'

const NOW = new Date('2026-07-23T00:00:00Z')

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-001',
    phone: '13800000001',
    email: 'u1@example.com',
    nickname: 'tester',
    avatar: '',
    bio: '',
    gender: 0,
    roleId: 0,
    status: 1,
    passwordHash: '',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

describe('users routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(usersRoutes, { prefix: '/api/users' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    dbQueue.items.length = 0
    // 默认鉴权失败(401)
    mockAuthenticate.mockImplementation(() => {
      const err = new Error('Authentication required')
      ;(err as Error & { statusCode: number }).statusCode = 401
      throw err
    })
    mockCountFollowing.mockResolvedValue(0)
    mockCountFollowers.mockResolvedValue(0)
    mockCountFavorites.mockResolvedValue(0)
    mockIsSystemAdminUser.mockResolvedValue(false)
    mockDbExecute.mockResolvedValue([])
  })

  function authAs(userId: string, roleId = 0) {
    currentAuth.userId = userId
    currentAuth.roleId = roleId
    mockAuthenticate.mockImplementation(
      (request: { userId?: string; jwtPayload?: { userId: string; roleId: number } }) => {
        request.userId = userId
        request.jwtPayload = { userId, roleId }
        return Promise.resolve(request.jwtPayload)
      },
    )
  }

  function enqueue(...results: unknown[][]) {
    dbQueue.items.push(...results)
  }

  describe('GET /api/users/me', () => {
    it('未登录返回 401', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/users/me' })
      expect(res.statusCode).toBe(401)
    })

    it('登录用户返回自身资料(含 phone/email)', async () => {
      authAs('user-001')
      mockFindUserById.mockResolvedValueOnce(makeUser())
      const res = await app.inject({
        method: 'GET',
        url: '/api/users/me',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.id).toBe('user-001')
      expect(body.data.phone).toBe('13800000001')
      expect(body.data.email).toBe('u1@example.com')
    })

    it('用户不存在返回 404', async () => {
      authAs('user-001')
      mockFindUserById.mockResolvedValueOnce(null)
      const res = await app.inject({ method: 'GET', url: '/api/users/me' })
      expect(res.statusCode).toBe(404)
      expect(res.json().message).toContain('用户不存在')
    })
  })

  describe('GET /api/users/:id', () => {
    it('未登录返回 401', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/users/user-001' })
      expect(res.statusCode).toBe(401)
    })

    it('本人查询返回完整字段 + stats', async () => {
      authAs('user-001')
      mockFindUserById.mockResolvedValueOnce(makeUser())
      mockCountFollowing.mockResolvedValueOnce(3)
      mockCountFollowers.mockResolvedValueOnce(5)
      mockCountFavorites.mockResolvedValueOnce(2)
      const res = await app.inject({ method: 'GET', url: '/api/users/user-001' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.user.phone).toBe('13800000001')
      expect(body.data.stats).toEqual({ followingCount: 3, followersCount: 5, favoritesCount: 2 })
    })

    it('非本人非管理员查询返回精简字段(不含 phone/email)', async () => {
      authAs('user-002', 0)
      mockFindUserById.mockResolvedValueOnce(makeUser({ id: 'user-001' }))
      const res = await app.inject({ method: 'GET', url: '/api/users/user-001' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.user).not.toHaveProperty('phone')
      expect(body.data.user).not.toHaveProperty('email')
      expect(body.data.user.id).toBe('user-001')
    })

    it('管理员查询他人返回完整字段', async () => {
      authAs('admin-001', 1)
      mockFindUserById.mockResolvedValueOnce(makeUser({ id: 'user-001' }))
      const res = await app.inject({ method: 'GET', url: '/api/users/user-001' })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.user.phone).toBe('13800000001')
    })

    it('用户不存在返回 404', async () => {
      authAs('user-001')
      mockFindUserById.mockResolvedValueOnce(null)
      const res = await app.inject({ method: 'GET', url: '/api/users/unknown' })
      expect(res.statusCode).toBe(404)
    })
  })

  describe('PATCH /api/users/:id', () => {
    it('未登录返回 401', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/users/user-001',
        payload: { nickname: 'new' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('非本人非管理员修改返回 403', async () => {
      authAs('user-002', 0)
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/users/user-001',
        payload: { nickname: 'new' },
      })
      expect(res.statusCode).toBe(403)
      expect(res.json().message).toContain('无权')
    })

    it('参数校验失败(nickname 空)返回 400', async () => {
      authAs('user-001')
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/users/user-001',
        payload: { nickname: '' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('邮箱格式不正确返回 400', async () => {
      authAs('user-001')
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/users/user-001',
        payload: { email: 'not-an-email' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('系统内置管理员不可修改返回 403', async () => {
      authAs('user-001')
      mockFindUserById.mockResolvedValueOnce(makeUser())
      mockIsSystemAdminUser.mockResolvedValueOnce(true)
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/users/user-001',
        payload: { nickname: 'new' },
      })
      expect(res.statusCode).toBe(403)
      expect(res.json().message).toContain('系统内置管理员')
    })

    it('用户不存在返回 404', async () => {
      authAs('user-001')
      mockFindUserById.mockResolvedValueOnce(null)
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/users/user-001',
        payload: { nickname: 'new' },
      })
      expect(res.statusCode).toBe(404)
    })

    it('本人修改成功返回 200', async () => {
      authAs('user-001')
      mockFindUserById.mockResolvedValueOnce(makeUser())
      mockIsSystemAdminUser.mockResolvedValueOnce(false)
      mockUpdateUser.mockResolvedValueOnce(makeUser({ nickname: 'new' }))
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/users/user-001',
        payload: { nickname: 'new' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.user.nickname).toBe('new')
      expect(mockUpdateUser).toHaveBeenCalledWith('user-001', { nickname: 'new' })
    })
  })

  describe('POST /api/users/:id/password', () => {
    it('未登录返回 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/users/user-001/password',
        payload: { currentPassword: 'old', newPassword: 'newpass1' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('修改他人密码返回 403', async () => {
      authAs('user-002')
      const res = await app.inject({
        method: 'POST',
        url: '/api/users/user-001/password',
        payload: { currentPassword: 'old', newPassword: 'newpass1' },
      })
      expect(res.statusCode).toBe(403)
      expect(res.json().message).toContain('他人密码')
    })

    it('新密码过短返回 400', async () => {
      authAs('user-001')
      const res = await app.inject({
        method: 'POST',
        url: '/api/users/user-001/password',
        payload: { currentPassword: 'old', newPassword: '123' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('原密码错误返回 401', async () => {
      authAs('user-001')
      mockFindUserById.mockResolvedValueOnce(
        makeUser({ passwordHash: await hashPassword('correct') }),
      )
      mockIsSystemAdminUser.mockResolvedValueOnce(false)
      const res = await app.inject({
        method: 'POST',
        url: '/api/users/user-001/password',
        payload: { currentPassword: 'wrong', newPassword: 'newpass1' },
      })
      expect(res.statusCode).toBe(401)
      expect(res.json().message).toContain('原密码错误')
    })

    it('原密码正确修改成功返回 200', async () => {
      authAs('user-001')
      const hash = await hashPassword('oldpass')
      mockFindUserById.mockResolvedValueOnce(makeUser({ passwordHash: hash }))
      mockIsSystemAdminUser.mockResolvedValueOnce(false)
      mockUpdateUserPassword.mockResolvedValueOnce(undefined)
      const res = await app.inject({
        method: 'POST',
        url: '/api/users/user-001/password',
        payload: { currentPassword: 'oldpass', newPassword: 'newpass1' },
      })
      expect(res.statusCode).toBe(200)
      expect(mockUpdateUserPassword).toHaveBeenCalled()
    })
  })

  describe('POST /api/users/change-phone', () => {
    it('手机号格式不正确返回 400', async () => {
      authAs('user-001')
      mockIsSystemAdminUser.mockResolvedValueOnce(false)
      const res = await app.inject({
        method: 'POST',
        url: '/api/users/change-phone',
        payload: {
          oldPhone: '13800000001',
          oldCode: '123456',
          newPhone: '123',
          newCode: '123456',
        },
      })
      expect(res.statusCode).toBe(400)
    })

    it('旧手机号与当前账号不一致返回 400', async () => {
      authAs('user-001')
      mockIsSystemAdminUser.mockResolvedValueOnce(false)
      mockFindUserById.mockResolvedValueOnce(makeUser({ phone: '13800000001' }))
      const res = await app.inject({
        method: 'POST',
        url: '/api/users/change-phone',
        payload: {
          oldPhone: '13900000099',
          oldCode: '123456',
          newPhone: '13900000000',
          newCode: '123456',
        },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('旧手机号')
    })

    it('旧验证码无效返回 400', async () => {
      authAs('user-001')
      mockIsSystemAdminUser.mockResolvedValueOnce(false)
      mockFindUserById.mockResolvedValueOnce(makeUser({ phone: '13800000001' }))
      mockVerifyCode.mockResolvedValueOnce(false) // 旧验证码失败
      const res = await app.inject({
        method: 'POST',
        url: '/api/users/change-phone',
        payload: {
          oldPhone: '13800000001',
          oldCode: '000000',
          newPhone: '13900000000',
          newCode: '123456',
        },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('旧手机号验证码无效')
    })

    it('新验证码无效返回 400', async () => {
      authAs('user-001')
      mockIsSystemAdminUser.mockResolvedValueOnce(false)
      mockFindUserById.mockResolvedValueOnce(makeUser({ phone: '13800000001' }))
      mockVerifyCode.mockResolvedValueOnce(true) // 旧验证码通过
      mockVerifyCode.mockResolvedValueOnce(false) // 新验证码失败
      const res = await app.inject({
        method: 'POST',
        url: '/api/users/change-phone',
        payload: {
          oldPhone: '13800000001',
          oldCode: '123456',
          newPhone: '13900000000',
          newCode: '000000',
        },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('新手机号验证码无效')
    })

    it('新手机号已被其他账号绑定触发合并(200)', async () => {
      authAs('user-001')
      mockIsSystemAdminUser.mockResolvedValueOnce(false) // 当前用户非管理员
      mockFindUserById.mockResolvedValueOnce(makeUser({ id: 'user-001', phone: '13800000001' }))
      mockVerifyCode.mockResolvedValueOnce(true) // 旧验证码
      mockVerifyCode.mockResolvedValueOnce(true) // 新验证码
      mockFindUserByPhone.mockResolvedValueOnce(makeUser({ id: 'user-002' }))
      mockIsSystemAdminUser.mockResolvedValueOnce(false) // 目标账号非管理员
      mockMergeUserAccounts.mockResolvedValueOnce(undefined)
      mockUpdateUser.mockResolvedValueOnce(makeUser({ phone: '13900000000' }))
      const res = await app.inject({
        method: 'POST',
        url: '/api/users/change-phone',
        payload: {
          oldPhone: '13800000001',
          oldCode: '123456',
          newPhone: '13900000000',
          newCode: '123456',
        },
      })
      expect(res.statusCode).toBe(200)
      expect(mockMergeUserAccounts).toHaveBeenCalledWith({
        fromUserId: 'user-002',
        toUserId: 'user-001',
      })
    })

    it('系统管理员不可修改返回 403', async () => {
      authAs('user-001')
      mockIsSystemAdminUser.mockResolvedValueOnce(true)
      const res = await app.inject({
        method: 'POST',
        url: '/api/users/change-phone',
        payload: {
          oldPhone: '13800000001',
          oldCode: '123456',
          newPhone: '13900000000',
          newCode: '123456',
        },
      })
      expect(res.statusCode).toBe(403)
    })
  })

  describe('GET /api/users/:id/devices', () => {
    it('未登录返回 401', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/users/user-001/devices' })
      expect(res.statusCode).toBe(401)
    })

    it('非本人非管理员查看返回 403', async () => {
      authAs('user-002', 0)
      const res = await app.inject({ method: 'GET', url: '/api/users/user-001/devices' })
      expect(res.statusCode).toBe(403)
    })

    it('本人查询返回设备列表', async () => {
      authAs('user-001')
      enqueue([{ ip: '1.2.3.4', userAgent: 'Mozilla' }])
      const res = await app.inject({ method: 'GET', url: '/api/users/user-001/devices' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.devices).toHaveLength(1)
      expect(body.data.devices[0].ip).toBe('1.2.3.4')
    })
  })
})
