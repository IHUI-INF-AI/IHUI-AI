// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​​‌‌​‍‍​‌​​‌‌‌‌‍‍​‌​​‌‌‌​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​​‌‌​​‌‌‍‍​‌​​‌​‌​‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SDB-29 回归:账号注销必须真正吊销开发者凭据。
 *
 * 两条根因:
 * 1. 鉴权只查 developer_api_keys.status,不 join users.status ⇒ 注销(status=3)
 *    用户手里的 Key / 分享 token 仍可调用付费接口(注销 = 未吊销)。
 * 2. 注销清理(purgeUserPii)不吊销 developer_api_keys / api_key_shares。
 *
 * 夹具是一个按 drizzle 调用形态求值的内存库:select/update/delete 都作用在
 * 同一份行上,因此能断言"吊销后鉴权拒绝",而不是只断言"函数被调用过"。
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { FastifyRequest } from 'fastify'

const h = vi.hoisted(() => {
  type KeyRow = {
    id: string
    userId: string
    name: string
    key: string
    secret: string
    status: string
    permissions: string[]
    rateLimit: number
    expiresAt: Date | null
    allowedIps: string[] | null
    allowedModels: string[] | null
    maxTokensPerReq: number | null
    blockedIps: string[] | null
    rateLimit5h: number | null
    rateLimit1d: number | null
    rateLimit7d: number | null
    perModelRpmLimit: Record<string, number> | null
    perModelTpmLimit: Record<string, number> | null
    lastUsedAt: Date | null
  }
  type ShareRow = {
    id: string
    sourceApiKeyId: string
    createdBy: string
    shareToken: string
    revokedAt: Date | null
    expiresAt: Date
    scopeModels: string[] | null
    scopeEndpoints: string[] | null
    rateLimitRpm: number
    rateLimitTpm: number
    maxTotalTokens: number | null
    usedTotalTokens: number
    sharedWithUserId: string | null
    updatedAt: Date
  }
  type UserRow = { id: string; status: number }

  const makeKey = (over: Partial<KeyRow> & Pick<KeyRow, 'id' | 'userId' | 'key'>): KeyRow => ({
    name: '测试密钥',
    secret: 'hashed',
    status: 'active',
    permissions: ['chat:write'],
    rateLimit: 60,
    expiresAt: null,
    allowedIps: null,
    allowedModels: null,
    maxTokensPerReq: null,
    blockedIps: null,
    rateLimit5h: null,
    rateLimit1d: null,
    rateLimit7d: null,
    perModelRpmLimit: null,
    perModelTpmLimit: null,
    lastUsedAt: null,
    ...over,
  })

  const makeShare = (
    over: Partial<ShareRow> & Pick<ShareRow, 'id' | 'sourceApiKeyId' | 'createdBy' | 'shareToken'>,
  ): ShareRow => ({
    revokedAt: null,
    expiresAt: new Date(Date.now() + 3_600_000),
    scopeModels: null,
    scopeEndpoints: null,
    rateLimitRpm: 60,
    rateLimitTpm: 100_000,
    maxTotalTokens: null,
    usedTotalTokens: 0,
    sharedWithUserId: null,
    updatedAt: new Date(),
    ...over,
  })

  const state = {
    users: [] as UserRow[],
    keys: [] as KeyRow[],
    shares: [] as ShareRow[],
    deletes: [] as string[],
  }

  return { state, makeKey, makeShare }
})

vi.mock('../src/db/index.js', async () => {
  const { getTableName } = await import('drizzle-orm')
  const { PgDialect } = await import('drizzle-orm/pg-core')
  const dialect = new PgDialect()
  const tableOf = (t: unknown) =>
    getTableName(t as Parameters<typeof getTableName>[0])
  const paramsOf = (where: unknown): unknown[] =>
    dialect.sqlToQuery(where as Parameters<typeof dialect.sqlToQuery>[0]).params as unknown[]

  // 按 select 的字段形状分派:鉴权联表 / revokeKey 归属读 / revokeShare 归属读 / 注销前的 id 列表
  const rowsFor = (shape: string[], table: string, where: unknown): unknown[] => {
    const params = where ? paramsOf(where) : []
    const s = h.state
    if (shape.includes('userStatus')) {
      const row = s.keys.find((k) => k.key === params[0])
      if (!row) return []
      const user = s.users.find((u) => u.id === row.userId)
      if (!user) return [] // INNER JOIN:用户行不存在 → 空集
      return [{ key: row, userStatus: user.status }]
    }
    if (shape.includes('createdBy')) {
      const row = s.shares.find((x) => x.id === params[0])
      return row ? [{ id: row.id, createdBy: row.createdBy }] : []
    }
    if (shape.includes('userId')) {
      const row = s.keys.find((x) => x.id === params[0])
      return row ? [{ id: row.id, userId: row.userId, status: row.status }] : []
    }
    if (shape.length === 1 && shape[0] === 'id') {
      if (table === 'developer_api_keys') {
        return s.keys.filter((k) => k.userId === params[0]).map((k) => ({ id: k.id }))
      }
      if (table === 'api_key_shares') {
        return s.shares
          .filter((x) => x.createdBy === params[0] && x.revokedAt === null)
          .map((x) => ({ id: x.id }))
      }
    }
    return []
  }

  const select = (fields: Record<string, unknown>) => {
    const shape = Object.keys(fields)
    let table = ''
    let where: unknown
    const builder = {
      from(t: unknown) {
        table = tableOf(t)
        return builder
      },
      innerJoin() {
        return builder
      },
      where(w: unknown) {
        where = w
        return builder
      },
      limit() {
        return builder
      },
      // thenable:既支持 await 直接取行,也支持 .limit(1)
      then(resolve: (v: unknown[]) => unknown, reject?: (e: unknown) => unknown) {
        return Promise.resolve(rowsFor(shape, table, where)).then(resolve, reject)
      },
    }
    return builder
  }

  const applyUpdate = (
    table: string,
    values: Record<string, unknown>,
    params: unknown[],
  ): string[] => {
    const s = h.state
    if (table === 'developer_api_keys') {
      const row = s.keys.find((k) => k.id === params[0])
      if (!row) return []
      Object.assign(row, values)
      return [row.id]
    }
    if (table === 'api_key_shares') {
      const row = s.shares.find((x) => x.id === params[0])
      if (!row) return []
      Object.assign(row, values)
      return [row.id]
    }
    if (table === 'users') {
      const row = s.users.find((u) => u.id === params[0])
      if (!row) return []
      if (typeof values.status === 'number') row.status = values.status
      return [row.id]
    }
    return []
  }

  const update = (t: unknown) => {
    const table = tableOf(t)
    return {
      set(values: Record<string, unknown>) {
        return {
          where(where: unknown) {
            const touched = applyUpdate(table, values, paramsOf(where))
            return {
              returning: async () => touched.map((id) => ({ id })),
              // lastUsedAt 异步更新是 fire-and-forget(`void ... .catch()`)
              then(resolve: (v: unknown[]) => unknown) {
                return Promise.resolve([]).then(resolve)
              },
              catch: () => Promise.resolve([]),
            }
          },
        }
      },
    }
  }

  const db = {
    select,
    update,
    delete: (t: unknown) => ({
      where: async () => {
        h.state.deletes.push(tableOf(t))
      },
    }),
    transaction: async <T,>(fn: (tx: typeof db) => Promise<T>): Promise<T> => fn(db),
  }
  return { db, dbRead: { select } }
})

vi.mock('../src/config/index.js', () => ({
  config: { API_KEY_REQUIRE_SECRET: true, API_KEY_RATE_LIMIT_FAIL_MODE: 'close' },
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock('../src/utils/api-key-hash.js', () => ({ verifySecret: vi.fn(() => true) }))

// 只替换 getShareByToken(按"未撤销 + 未过期 + 源 Key/账号存在"求值),
// revokeShare 保留真实实现 —— 注销侧吊销的就是它。
vi.mock('../src/services/api-key-share-service.js', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    getShareByToken: async (token: string) => {
      const s = h.state
      const row = s.shares.find(
        (x) => x.shareToken === token && x.revokedAt === null && x.expiresAt.getTime() > Date.now(),
      )
      if (!row) return null
      const sourceKey = s.keys.find((k) => k.id === row.sourceApiKeyId)
      const owner = sourceKey ? s.users.find((u) => u.id === sourceKey.userId) : undefined
      if (!sourceKey || !owner) return null
      return { ...row, sourceKey, ownerStatus: owner.status }
    },
  }
})

vi.mock('../src/services/api-key-tpm-service.js', () => ({
  checkTpmQuota: vi.fn(),
  recordTpmUsage: vi.fn(),
}))

vi.mock('../src/db/queries.js', () => ({ revokeAllUserRefreshTokens: vi.fn(async () => {}) }))

vi.mock('ioredis', () => {
  class FakeRedis {
    async eval() {
      return [1, 0]
    }
    on() {}
  }
  return { default: FakeRedis }
})

const { authenticateApiKey } = await import('../src/plugins/api-key-auth.js')
const { purgeUserPii } = await import('../src/services/purge-user-pii.js')

function req(headers: Record<string, string>): FastifyRequest {
  return { headers, ip: '127.0.0.1' } as unknown as FastifyRequest
}

const OWNER_KEY_HEADERS = { authorization: 'Bearer ihui_owner_key', 'x-api-secret': 'sk_plain' }
const OTHER_KEY_HEADERS = { authorization: 'Bearer ihui_other_key', 'x-api-secret': 'sk_plain' }

beforeEach(() => {
  h.state.users = [
    { id: 'user-1', status: 1 },
    { id: 'user-2', status: 1 },
  ]
  h.state.keys = [
    h.makeKey({ id: 'key-1', userId: 'user-1', key: 'ihui_owner_key' }),
    h.makeKey({ id: 'key-2', userId: 'user-2', key: 'ihui_other_key' }),
  ]
  h.state.shares = [
    h.makeShare({
      id: 'share-1',
      sourceApiKeyId: 'key-1',
      createdBy: 'user-1',
      shareToken: 'owner_share_token',
    }),
    h.makeShare({
      id: 'share-2',
      sourceApiKeyId: 'key-2',
      createdBy: 'user-2',
      shareToken: 'other_share_token',
    }),
  ]
  h.state.deletes.length = 0
})

describe('SDB-29 注销清理吊销开发者凭据', () => {
  it('① 注销后 API Key 落为 revoked,且鉴权立即 401', async () => {
    const result = await purgeUserPii('user-1')
    expect(result.userRowAnonymized).toBe(true)

    const ownerKey = h.state.keys.find((k) => k.id === 'key-1')
    expect(ownerKey?.status).toBe('revoked')

    await expect(authenticateApiKey(req(OWNER_KEY_HEADERS))).rejects.toMatchObject({
      statusCode: 401,
    })
  })

  it('② 注销后分享 token 同样被撤销,鉴权 401', async () => {
    await purgeUserPii('user-1')

    const share = h.state.shares.find((s) => s.id === 'share-1')
    expect(share?.revokedAt).toBeInstanceOf(Date)

    await expect(
      authenticateApiKey(req({ authorization: 'Bearer share_owner_share_token' })),
    ).rejects.toMatchObject({ statusCode: 401 })
  })

  it('③ 清理幂等:连续注销两次不抛错,凭据仍处吊销态', async () => {
    await purgeUserPii('user-1')
    await expect(purgeUserPii('user-1')).resolves.toMatchObject({ userRowAnonymized: true })

    expect(h.state.keys.find((k) => k.id === 'key-1')?.status).toBe('revoked')
    expect(h.state.shares.find((s) => s.id === 'share-1')?.revokedAt).toBeInstanceOf(Date)
  })

  it('④ 其它用户的 Key / 分享不受影响', async () => {
    await purgeUserPii('user-1')

    expect(h.state.keys.find((k) => k.id === 'key-2')?.status).toBe('active')
    expect(h.state.shares.find((s) => s.id === 'share-2')?.revokedAt).toBeNull()

    const ctx = await authenticateApiKey(req(OTHER_KEY_HEADERS))
    expect(ctx.userId).toBe('user-2')
  })
})

describe('SDB-29 鉴权兜底(fail-closed)', () => {
  it('账号已注销(status=3)时即使 Key 仍 active 也 401', async () => {
    h.state.users = h.state.users.map((u) => (u.id === 'user-1' ? { ...u, status: 3 } : u))
    await expect(authenticateApiKey(req(OWNER_KEY_HEADERS))).rejects.toMatchObject({
      statusCode: 401,
    })
  })

  it('账号被禁用(status=0)时 401', async () => {
    h.state.users = h.state.users.map((u) => (u.id === 'user-1' ? { ...u, status: 0 } : u))
    await expect(authenticateApiKey(req(OWNER_KEY_HEADERS))).rejects.toMatchObject({
      statusCode: 401,
    })
  })

  it('Key 已被吊销(revoked)时 401', async () => {
    const row = h.state.keys.find((k) => k.id === 'key-1')
    if (row) row.status = 'revoked'
    await expect(authenticateApiKey(req(OWNER_KEY_HEADERS))).rejects.toMatchObject({
      statusCode: 401,
    })
  })

  it('users 行不存在(孤儿 Key)时 401,不得放行', async () => {
    h.state.users = h.state.users.filter((u) => u.id !== 'user-1')
    await expect(authenticateApiKey(req(OWNER_KEY_HEADERS))).rejects.toMatchObject({
      statusCode: 401,
    })
  })

  it('分享 token 的源 Key 所属账号注销后 401', async () => {
    h.state.users = h.state.users.map((u) => (u.id === 'user-1' ? { ...u, status: 3 } : u))
    await expect(
      authenticateApiKey(req({ authorization: 'Bearer share_owner_share_token' })),
    ).rejects.toMatchObject({ statusCode: 401 })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍‌​‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‌‌​‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​​‌‌​‍‍​‌​​‌‌‌‌‍‍​‌​​‌‌‌​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​​‌‌​​‌‌‍‍​‌​​‌​‌​‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
