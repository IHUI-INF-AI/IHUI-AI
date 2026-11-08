// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-245 回归锁(2026-11-08)。
 *
 * 病灶:运营后台 usercenter 的用户查询/创建/更新只剥 passwordHash,
 *       twoFactorSecret(bytea 密文)与 twoFactorBackupCodes(hash 数组)原样出网。
 * 判据:任何 usercenter 用户响应都不得含这三个字段,其余档案字段保留。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const state = vi.hoisted(() => ({
  user: {} as Record<string, unknown>,
  list: [] as Record<string, unknown>[],
}))

vi.mock('../src/plugins/require-permission.js', () => ({ requireAdmin: vi.fn() }))

vi.mock('../src/utils/password-crypto.js', () => ({
  hashPassword: vi.fn(async () => 'hashed'),
  verifyPassword: vi.fn(async () => true),
}))

vi.mock('../src/db/usercenter-queries.js', () => ({
  findUsers: vi.fn(async () => ({ list: state.list, total: state.list.length, page: 1, pageSize: 20 })),
  deleteUser: vi.fn(),
  updateUserPassword: vi.fn(),
  updateUserStatus: vi.fn(),
  findDepartments: vi.fn(async () => []),
  findDepartmentById: vi.fn(),
  createDepartment: vi.fn(),
  updateDepartment: vi.fn(),
  deleteDepartment: vi.fn(),
  findUserCertificates: vi.fn(async () => []),
  createUserCertificate: vi.fn(),
  deleteUserCertificate: vi.fn(),
  getUserStatistics: vi.fn(),
}))

vi.mock('../src/db/queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    findUserById: vi.fn(async () => state.user),
    findUserByPhone: vi.fn(async (phone: string) => (phone === '13800000000' ? state.user : null)),
    createUser: vi.fn(async () => state.user),
    updateUser: vi.fn(async () => state.user),
    revokeAllUserRefreshTokens: vi.fn(),
  }
})

import { usercenterRoutes } from '../src/routes/usercenter.js'

type Handler = (request: unknown, reply: unknown) => unknown

function makeServer() {
  const handlers = new Map<string, Handler>()
  const add = (method: string) => (path: string, a: unknown, b?: unknown) =>
    handlers.set(`${method} ${path}`, (b ?? a) as Handler)
  const server = {
    get: vi.fn(add('GET')),
    post: vi.fn(add('POST')),
    put: vi.fn(add('PUT')),
    delete: vi.fn(add('DELETE')),
    addHook: vi.fn(),
    decorate: vi.fn(),
    log: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
  }
  return { server, handlers }
}

function makeReply() {
  return {
    code: 200,
    body: undefined as unknown,
    status(c: number) {
      this.code = c
      return this
    },
    send(b: unknown) {
      this.body = b
      return this
    },
  }
}

const USER_ID = '00000000-0000-4000-8000-0000000000c1'

function secretUser(): Record<string, unknown> {
  return {
    id: USER_ID,
    phone: '13800000000',
    nickname: '运营',
    email: 'ops@example.com',
    status: 1,
    roleId: 1,
    passwordHash: '$2b$12$hash',
    twoFactorSecret: Buffer.from([1, 2, 3]),
    twoFactorBackupCodes: ['hash-a', 'hash-b'],
  }
}

function assertRedacted(user: Record<string, unknown>) {
  expect(user).not.toHaveProperty('passwordHash')
  expect(user).not.toHaveProperty('twoFactorSecret')
  expect(user).not.toHaveProperty('twoFactorBackupCodes')
  expect(user.nickname).toBe('运营')
}

describe('F-245 usercenter 不得回传 2FA 凭据', () => {
  let handlers: Map<string, Handler>

  beforeEach(async () => {
    state.user = secretUser()
    state.list = [secretUser()]
    const made = makeServer()
    await usercenterRoutes(made.server as never, {} as never)
    handlers = made.handlers
  })

  it('GET /usercenter/users 列表已脱敏', async () => {
    const reply = makeReply()
    await handlers.get('GET /usercenter/users')!({ query: {} }, reply)
    const body = reply.body as { data: { list: Record<string, unknown>[] } }
    assertRedacted(body.data.list[0]!)
  })

  it('GET /usercenter/users/by-phone 已脱敏', async () => {
    const reply = makeReply()
    await handlers.get('GET /usercenter/users/by-phone')!(
      { query: { phone: '13800000000' } },
      reply,
    )
    const body = reply.body as { data: { user: Record<string, unknown> } }
    assertRedacted(body.data.user)
  })

  it('GET /usercenter/users/:id 已脱敏', async () => {
    const reply = makeReply()
    await handlers.get('GET /usercenter/users/:id')!({ params: { id: USER_ID } }, reply)
    const body = reply.body as { data: { user: Record<string, unknown> } }
    assertRedacted(body.data.user)
  })

  it('POST /usercenter/users 创建响应已脱敏', async () => {
    const reply = makeReply()
    await handlers.get('POST /usercenter/users')!(
      { body: { phone: '13900000000', password: 'Abc12345!', nickname: '新用户', status: 1 } },
      reply,
    )
    expect(reply.code).toBe(201)
    const body = reply.body as { data: { user: Record<string, unknown> } }
    assertRedacted(body.data.user)
  })

  it('PUT /usercenter/users/:id 更新响应已脱敏', async () => {
    const reply = makeReply()
    await handlers.get('PUT /usercenter/users/:id')!(
      { params: { id: USER_ID }, body: { nickname: '改名' } },
      reply,
    )
    expect(reply.code).toBe(200)
    const body = reply.body as { data: { user: Record<string, unknown> } }
    assertRedacted(body.data.user)
  })
})
