// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-77 回归锁(2026-11-11)。
 *
 * 病灶:GET /api/admin/members/departments/:id/users → findUsersByDepartment 的 select
 *       把 users 的 two_factor_secret / two_factor_backup_codes / two_factor_enabled_at
 *       (以及 password_hash)整行带出;路由只剥 passwordHash,响应 schema 又是
 *       additionalProperties:true ⇒ 任一 ADMIN 可批量导出全站 TOTP 密文与备份码哈希。
 * 判据:
 *   1) 查询层白名单投影不含上述凭据列,twoFactorEnabled(布尔)保留;
 *   2) 走真实路由 inject 后响应 JSON 深层不含凭据键;
 *   3) 路由层仍剥离 passwordHash(纵深防御);
 *   4) 源码形状断言锁定白名单写法,防回退成整行/黑名单。
 */
import { describe, it, expect, beforeEach, afterAll, beforeAll, vi } from 'vitest'
import Fastify, { type FastifyError } from 'fastify'
import { readFileSync } from 'node:fs'

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'info',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
  },
}))

// ADMIN 鉴权:adminMemberRoutes 的 preHandler 直接放行(不连 JWT/Redis)
vi.mock('../src/plugins/require-permission.js', () => ({ requireAdmin: vi.fn(async () => {}) }))

/**
 * 保真 db 替身:模拟 drizzle 的「显式投影」语义 —— select(<列投影>) 只回投影里
 * 出现的列;select() 无参才回整行。投影一旦回退成整行,夹具响应就会重新带上
 * 凭据列,断言随之翻红。
 */
const { makeDbMock } = vi.hoisted(() => {
  const FULL_ROW: Record<string, unknown> = {
    id: '00000000-0000-4000-8000-0000000000a1',
    phone: '13800000000',
    email: 'alice@example.com',
    username: 'alice',
    passwordHash: 'PASSWORD-HASH-MUST-NOT-LEAK',
    nickname: 'Alice',
    avatar: null,
    bio: null,
    gender: 1,
    birthday: '1990-01-01',
    familyId: null,
    roleId: 2,
    deptId: 1,
    status: 1,
    isVip: 0,
    identityType: 'normal',
    level: 1,
    isSystemAdmin: false,
    inviteCode: 'INV-0001',
    parentId: null,
    twoFactorSecret: Buffer.from('TOTP-SECRET-MUST-NOT-LEAK'),
    twoFactorEnabled: true,
    twoFactorBackupCodes: ['BACKUP-CODE-HASH-MUST-NOT-LEAK'],
    twoFactorEnabledAt: new Date('2026-01-02T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  }

  function pick(selection: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(selection)) out[key] = FULL_ROW[key]
    return out
  }

  function project(selection?: Record<string, unknown>): Record<string, unknown>[] {
    if (!selection) return [{ ...FULL_ROW }]
    if ('count' in selection) return [{ count: 1 }]
    return [pick(selection)]
  }

  function selectChain(selection?: Record<string, unknown>) {
    const chain: Record<string, unknown> = {
      from: () => chain,
      innerJoin: () => chain,
      leftJoin: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      offset: () => chain,
      then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
        Promise.resolve(project(selection)).then(resolve, reject)
      },
    }
    return chain
  }

  const makeDbMock = () => ({
    select: vi.fn((selection?: Record<string, unknown>) => selectChain(selection)),
  })

  return { makeDbMock }
})

vi.mock('../src/db/index.js', () => ({ db: makeDbMock() }))

// 只接管 findUsersByDepartment,便于注入「上游回退成整行」的夹具;默认委托真实实现,
// 因此查询层投影与路由 inject 仍是端到端真实的查询逻辑。
vi.mock('../src/db/member-queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  const real = actual.findUsersByDepartment as (
    departmentId: string,
    opts: { page: number; pageSize: number },
  ) => Promise<unknown>
  return { ...actual, findUsersByDepartment: vi.fn(real) }
})

import { adminMemberRoutes } from '../src/routes/member'
import { findUsersByDepartment } from '../src/db/member-queries.js'

const DEPT_ID = '00000000-0000-4000-8000-0000000000d1'
const SENSITIVE_KEYS = ['passwordHash', 'twoFactorSecret', 'twoFactorBackupCodes', 'twoFactorEnabledAt']

function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys)
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      keys.add(k)
      collectKeys(v, keys)
    }
  }
  return keys
}

function expectNoSensitiveKeys(body: unknown) {
  const keys = collectKeys(body)
  for (const key of SENSITIVE_KEYS) {
    expect(keys.has(key), `响应中出现敏感键 ${key}`).toBe(false)
  }
}

describe('F-77 部门用户列表不得下发 2FA 凭据', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    server.setErrorHandler((err: FastifyError, _request, reply) => {
      const statusCode = err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500
      reply.status(statusCode).send({ code: statusCode, message: err.message })
    })
    await server.register(adminMemberRoutes, { prefix: '/api/admin' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    vi.mocked(findUsersByDepartment).mockClear()
  })

  it('查询层白名单投影:不含密码哈希/2FA 凭据,保留 twoFactorEnabled 与业务字段', async () => {
    const result = await findUsersByDepartment(DEPT_ID, { page: 1, pageSize: 20 })
    expect(result.total).toBe(1)
    const row = result.list[0]!
    for (const key of SENSITIVE_KEYS) {
      expect(row, `查询层投影泄露 ${key}`).not.toHaveProperty(key)
    }
    expect(row.twoFactorEnabled).toBe(true)
    expect(row).toMatchObject({
      phone: '13800000000',
      email: 'alice@example.com',
      username: 'alice',
      nickname: 'Alice',
      gender: 1,
      roleId: 2,
      deptId: 1,
      status: 1,
      isVip: 0,
      identityType: 'normal',
      level: 1,
      isSystemAdmin: false,
      inviteCode: 'INV-0001',
    })
  })

  it('源码形状:findUsersByDepartment 的 select 是白名单且不含凭据列', () => {
    const src = readFileSync(new URL('../src/db/member-queries.ts', import.meta.url), 'utf8')
    const start = src.indexOf('export async function findUsersByDepartment')
    const end = src.indexOf('/** 按 ID 查询系统用户。 */')
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    const fnSrc = src.slice(start, end)
    expect(fnSrc).not.toMatch(/passwordHash\s*:/)
    expect(fnSrc).not.toMatch(/twoFactorSecret\s*:/)
    expect(fnSrc).not.toMatch(/twoFactorBackupCodes\s*:/)
    expect(fnSrc).not.toMatch(/twoFactorEnabledAt\s*:/)
    expect(fnSrc).toMatch(/twoFactorEnabled:\s*users\.twoFactorEnabled/)
    // 黑名单式 select() 整行(无显式投影)同样是回退信号
    expect(fnSrc).not.toMatch(/\.select\(\)/)
  })

  it('GET /api/admin/members/departments/:id/users 响应 JSON 深层不含凭据键', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/admin/members/departments/${DEPT_ID}/users`,
    })
    expect(res.statusCode).toBe(200)
    expectNoSensitiveKeys(res.json())
    const data = res.json().data as {
      list: Record<string, unknown>[]
      total: number
      page: number
      pageSize: number
    }
    expect(data.total).toBe(1)
    expect(data.list[0]!.nickname).toBe('Alice')
    expect(data.list[0]!.twoFactorEnabled).toBe(true)
  })

  it('路由层仍剥离 passwordHash(上游回退成整行时的纵深防御)', async () => {
    vi.mocked(findUsersByDepartment).mockResolvedValueOnce({
      list: [
        {
          id: '00000000-0000-4000-8000-0000000000a1',
          nickname: 'Alice',
          twoFactorEnabled: true,
          passwordHash: 'PASSWORD-HASH-MUST-NOT-LEAK',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    } as never)
    const res = await server.inject({
      method: 'GET',
      url: `/api/admin/members/departments/${DEPT_ID}/users`,
    })
    expect(res.statusCode).toBe(200)
    const list = (res.json().data as { list: Record<string, unknown>[] }).list
    expect(list[0]).not.toHaveProperty('passwordHash')
    expect(list[0]!.nickname).toBe('Alice')
  })

  it('源码形状:部门用户路由保留 passwordHash 剥离,不展开整行下发', () => {
    const src = readFileSync(new URL('../src/routes/member.ts', import.meta.url), 'utf8')
    const start = src.indexOf("'/members/departments/:id/users'")
    const end = src.indexOf('// POST /members/users', start)
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    const routeSrc = src.slice(start, end)
    expect(routeSrc).toMatch(/passwordHash:\s*_pw/)
    expect(routeSrc).toContain('...rest')
  })
})
