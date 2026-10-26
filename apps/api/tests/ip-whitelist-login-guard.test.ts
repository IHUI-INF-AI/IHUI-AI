// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * IP 白名单生效链的行为用例（登录腿 = POST /api/auth/sso/exchange，续期腿 = /api/auth/sso/refresh）。
 *
 * 全 mock：db 层与签发原语都不落真库（PG 8810 / Redis 8811 一律不连）；
 * 每条拒绝用例都配正向对照，证明断言不是恒真。
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'

const OWNER_ID = '11111111-1111-4111-8111-111111111111'
const VICTIM_ID = '22222222-2222-4222-8222-222222222222'

const m = vi.hoisted(() => ({
  checkAuth: vi.fn(),
  authenticate: vi.fn(),
  findUserPreferences: vi.fn(),
  upsertUserPreference: vi.fn(),
  deleteUserPreference: vi.fn(),
  findUserById: vi.fn(),
  findRefreshToken: vi.fn(),
  revokeRefreshToken: vi.fn(),
  revokeRefreshTokenFamily: vi.fn(),
  findLiveFamilyToken: vi.fn(),
  revokeAllUserRefreshTokens: vi.fn(),
  saveRefreshToken: vi.fn(),
  getUserPermissions: vi.fn(),
  getUserStatus: vi.fn(),
  signAccessToken: vi.fn(),
  signRefreshToken: vi.fn(),
  verifyRefreshToken: vi.fn(),
  verifyAccessToken: vi.fn(),
  insertRow: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({ checkAuth: m.checkAuth, authenticate: m.authenticate }))
// 真 security-logs-queries 走这份假 db —— 拒绝用例要直接看到落库那一行的 principal
vi.mock('../src/db/index.js', () => ({
  db: {
    insert: (table: unknown) => ({
      values: (row: Record<string, unknown>) => ({
        returning: async () => {
          m.insertRow({ table, row })
          return [{ id: 'log-1', ...row }]
        },
      }),
    }),
    select: () => ({
      from: () => ({
        where: () => ({ orderBy: () => ({ limit: () => ({ offset: async () => [] }) }) }),
      }),
    }),
    update: () => ({ set: () => ({ where: async () => [] }) }),
    delete: () => ({ where: async () => [] }),
    transaction: async (fn: (t: unknown) => Promise<unknown>) => fn({}),
  },
  dbRead: {},
  dbClient: {},
}))
vi.mock('../src/db/user-preferences-queries.js', () => ({
  USER_PREFERENCE_GROUPS: { security: 'security' },
  findUserPreferences: m.findUserPreferences,
  upsertUserPreference: m.upsertUserPreference,
  deleteUserPreference: m.deleteUserPreference,
}))
vi.mock('../src/db/queries.js', () => ({
  findUserById: m.findUserById,
  findRefreshToken: m.findRefreshToken,
  revokeRefreshToken: m.revokeRefreshToken,
  revokeRefreshTokenFamily: m.revokeRefreshTokenFamily,
  // /sso/refresh 的重放裁决经 refresh-replay-policy 真实现,其 db 依赖命名导出必须齐备
  findLiveFamilyToken: m.findLiveFamilyToken,
  revokeAllUserRefreshTokens: m.revokeAllUserRefreshTokens,
  saveRefreshToken: m.saveRefreshToken,
}))
vi.mock('../src/db/rbac-queries.js', () => ({ getUserPermissions: m.getUserPermissions }))
vi.mock('../src/db/usercenter-queries.js', () => ({ getUserStatus: m.getUserStatus }))
vi.mock('../src/config/index.js', () => ({
  config: { JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!', NODE_ENV: 'test' },
}))
vi.mock('jose', () => ({ decodeJwt: () => ({}) }))
vi.mock('@ihui/auth', () => ({
  signAccessToken: m.signAccessToken,
  signRefreshToken: m.signRefreshToken,
  verifyAccessToken: m.verifyAccessToken,
  verifyRefreshToken: m.verifyRefreshToken,
  createFamilyId: () => 'fam-mock',
  ACCESS_TOKEN_TTL_SECONDS: 900,
  REFRESH_TOKEN_TTL_SECONDS: 30 * 24 * 60 * 60,
  noopFamilyRevoker: { revoke: async () => {} },
}))

import { authSsoRoutes } from '../src/routes/auth-sso.js'
import { userSecurityConfigRoutes } from '../src/routes/user/security-config-routes.js'
import {
  evaluateLoginIpWhitelist,
  normalizeIpLiteral,
} from '../src/routes/user/ip-whitelist-guard.js'

let app: FastifyInstance

/** 按 (userId, group, key) 寻址的假偏好表；读面真从它取，写面真改它。 */
let store: Map<string, string>
const rowKey = (userId: string, group: string, key: string) => `${userId}|${group}|${key}`
const seed = (userId: string, key: string, value: string) =>
  store.set(rowKey(userId, 'security', key), value)

const redis = new Map<string, string>()
const mockRedis = {
  get: async (k: string) => redis.get(k) ?? null,
  del: async (...keys: string[]) => {
    let n = 0
    for (const k of keys) if (redis.delete(k)) n++
    return n
  },
  set: async (k: string, v: string) => {
    redis.set(k, v)
    return 'OK'
  },
}

let codeSeq = 0
function issueSsoCode(userId = OWNER_ID, clientId = 'desktop') {
  codeSeq += 1
  const code = `code-${userId}-${clientId}-${codeSeq}`
  redis.set(
    `sso:code:${code}`,
    JSON.stringify({ userId, clientId, redirectUri: '/x', createdAt: Date.now() }),
  )
  return { code, clientId }
}

/** 默认来源 IP 由 inject 的 remoteAddress 决定；不带就是 127.0.0.1。 */
async function exchange(
  params: { code: string; clientId: string },
  extra?: Record<string, unknown>,
) {
  return app.inject({
    method: 'POST',
    url: '/api/auth/sso/exchange',
    payload: { ...params, ...extra },
  })
}

beforeAll(async () => {
  app = Fastify({ logger: false })
  await app.register(cookie)
  ;(app as unknown as { redis: unknown }).redis = mockRedis
  await app.register(authSsoRoutes, { prefix: '/api/auth' })
  await app.register(userSecurityConfigRoutes, { prefix: '/api' })
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  vi.clearAllMocks()
  store = new Map()
  redis.clear()
  m.checkAuth.mockImplementation(async (request: { userId?: string }) => {
    request.userId = OWNER_ID
    return true
  })
  m.authenticate.mockResolvedValue({ userId: OWNER_ID })
  m.getUserStatus.mockResolvedValue(1)
  m.getUserPermissions.mockResolvedValue([])
  m.findUserPreferences.mockImplementation(async (userId: string, group?: string) => {
    const list: { id: string; key: string; value: string | null }[] = []
    for (const [k, v] of store) {
      const [u, g, key] = k.split('|')
      // rowKey 恒为 `${userId}|${group}|${key}` 三段 ⇒ key 必存在;
      // noUncheckedIndexedAccess 下解构出的是 string | undefined,显式收敛。
      if (u === userId && (!group || g === group)) list.push({ id: k, key: key ?? '', value: v })
    }
    return { list, total: list.length }
  })
  m.upsertUserPreference.mockImplementation(
    async (userId: string, group: string, key: string, value: string | null) => {
      store.set(rowKey(userId, group, key), value ?? '')
      return { id: rowKey(userId, group, key), userId, group, key, value }
    },
  )
  m.deleteUserPreference.mockImplementation((userId: string, group: string, key: string) => {
    store.delete(rowKey(userId, group, key))
    return true
  })
  m.findUserById.mockImplementation(async (id: string) =>
    id === OWNER_ID
      ? {
          id: OWNER_ID,
          phone: '13800000001',
          email: 'o@example.com',
          nickname: 'O',
          roleId: 0,
          status: 1,
          familyId: 'fam-1',
        }
      : null,
  )
  m.signAccessToken.mockResolvedValue('access-token-mock')
  m.signRefreshToken.mockResolvedValue('refresh-token-mock')
  m.saveRefreshToken.mockResolvedValue(undefined)
})

const signedIn = () => m.signAccessToken.mock.calls.length > 0

describe('IP 白名单闸门 —— 新登录腿', () => {
  it('空表 = 未启用 ⇒ 放行（正向对照：签发真的发生了）', async () => {
    const res = await exchange(issueSsoCode())
    expect(res.statusCode).toBe(200)
    expect(signedIn()).toBe(true)
    expect(m.saveRefreshToken).toHaveBeenCalledTimes(1)
    expect(m.insertRow).not.toHaveBeenCalled()
  })

  it('来源 IP 命中白名单 ⇒ 放行', async () => {
    seed(OWNER_ID, 'ipWhitelist', JSON.stringify(['127.0.0.1']))
    const res = await exchange(issueSsoCode())
    expect(res.statusCode).toBe(200)
    expect(signedIn()).toBe(true)
  })

  it('不在白名单 ⇒ 403，且签发侧一个副作用都没发生', async () => {
    seed(OWNER_ID, 'ipWhitelist', JSON.stringify(['198.51.100.7']))
    const res = await exchange(issueSsoCode())
    expect(res.statusCode).toBe(403)
    const body = res.json()
    expect(body.code).toBe(403)
    expect(typeof body.message).toBe('string')
    // 拒绝路径上绝不签发
    expect(m.signAccessToken).not.toHaveBeenCalled()
    expect(m.signRefreshToken).not.toHaveBeenCalled()
    expect(m.saveRefreshToken).not.toHaveBeenCalled()
  })

  it('自救 IP = 最后一次改白名单那台 ⇒ 放行（否则用户把自己锁死在错误网络上）', async () => {
    seed(OWNER_ID, 'ipWhitelist', JSON.stringify(['198.51.100.7']))
    seed(OWNER_ID, 'ipWhitelistTrustedIp', '127.0.0.1')
    const res = await exchange(issueSsoCode())
    expect(res.statusCode).toBe(200)
    expect(signedIn()).toBe(true)
    // 对照：自救锚点指向别的 IP 时不生效
    seed(OWNER_ID, 'ipWhitelistTrustedIp', '203.0.113.9')
    const blocked = await exchange(issueSsoCode(OWNER_ID, 'desktop-2'))
    expect(blocked.statusCode).toBe(403)
  })

  it('被拒时写 security_logs 事件，principal 就是刚验证过凭据的那个 userId', async () => {
    seed(OWNER_ID, 'ipWhitelist', JSON.stringify(['198.51.100.7']))
    const res = await exchange(issueSsoCode())
    expect(res.statusCode).toBe(403)
    expect(m.insertRow).toHaveBeenCalledTimes(1)
    const row = m.insertRow.mock.calls[0]![0].row as Record<string, unknown>
    expect(row.action).toBe('login_blocked_by_ip_allowlist')
    expect(row.userId).toBe(OWNER_ID)
    expect(row.ip).toBe('127.0.0.1')
  })

  it('自报 ip / 自报 userId / 伪造 XFF 一律不参与判定', async () => {
    // 白名单里只有 198.51.100.7，而真实来源是 127.0.0.1 ⇒ 无论客户端怎么自称都得 403
    seed(OWNER_ID, 'ipWhitelist', JSON.stringify(['198.51.100.7']))
    const claimed = await app.inject({
      method: 'POST',
      url: '/api/auth/sso/exchange',
      headers: { 'x-forwarded-for': '198.51.100.7' },
      payload: { ...issueSsoCode(), ip: '198.51.100.7', userId: OWNER_ID },
    })
    expect(claimed.statusCode).toBe(403)
    // 对照：真实来源在表内时，自报的另一个 IP 不会把它判成非法
    seed(OWNER_ID, 'ipWhitelist', JSON.stringify(['127.0.0.1']))
    const honest = await app.inject({
      method: 'POST',
      url: '/api/auth/sso/exchange',
      headers: { 'x-forwarded-for': '198.51.100.7' },
      payload: { ...issueSsoCode(), ip: '198.51.100.7', userId: VICTIM_ID },
    })
    expect(honest.statusCode).toBe(200)
    // 且判的始终是"授权码里那个账号"的表，不是 body 自报的 userId
    seed(VICTIM_ID, 'ipWhitelist', JSON.stringify(['198.51.100.7']))
    m.findUserById.mockImplementation(async (id: string) =>
      id === VICTIM_ID
        ? {
            id: VICTIM_ID,
            phone: '',
            email: 'v@example.com',
            nickname: 'V',
            roleId: 0,
            status: 1,
            familyId: 'f2',
          }
        : null,
    )
    const victimAttempt = await app.inject({
      method: 'POST',
      url: '/api/auth/sso/exchange',
      payload: { ...issueSsoCode(VICTIM_ID), ip: '198.51.100.7' },
    })
    expect(victimAttempt.statusCode).toBe(403)
  })

  it('IPv6 字面量归一后判等（::1 与全写形态、::ffff:127.0.0.1 与 v4 形态同形）', async () => {
    seed(OWNER_ID, 'ipWhitelist', JSON.stringify(['0:0:0:0:0:0:0:1']))
    const v6 = await app.inject({
      method: 'POST',
      url: '/api/auth/sso/exchange',
      remoteAddress: '::1',
      payload: issueSsoCode(),
    })
    expect(v6.statusCode).toBe(200)
    // 对照：别的 v6 地址照样拦
    seed(OWNER_ID, 'ipWhitelist', JSON.stringify(['::2']))
    const other = await app.inject({
      method: 'POST',
      url: '/api/auth/sso/exchange',
      remoteAddress: '::1',
      payload: issueSsoCode(OWNER_ID, 'desktop-2'),
    })
    expect(other.statusCode).toBe(403)
  })

  it('量不出来源 IP 时失败关闭（白名单非空 ⇒ 不拿"判不出"当放行）', async () => {
    seed(OWNER_ID, 'ipWhitelist', JSON.stringify(['198.51.100.7']))
    const decision = await evaluateLoginIpWhitelist({ request: { ip: '' }, userId: OWNER_ID })
    expect(decision).toEqual({ allowed: false, whitelistSize: 1 })
    // 对照：同一份空 IP 输入，空表仍然放行（拦的是白名单启用后的非法来源，不是"没 IP"本身）
    store.clear()
    const noneConfigured = await evaluateLoginIpWhitelist({ request: { ip: '' }, userId: OWNER_ID })
    expect(noneConfigured.allowed).toBe(true)
  })
})

describe('IP 白名单闸门 —— 续期腿不受影响', () => {
  it('refresh 腿在白名单不命中时照常轮转（产品语义：不踢已在线会话）', async () => {
    seed(OWNER_ID, 'ipWhitelist', JSON.stringify(['198.51.100.7']))
    m.verifyRefreshToken.mockResolvedValue({ userId: OWNER_ID, familyId: 'fam-1' })
    m.findRefreshToken.mockResolvedValue({
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86400000),
    })
    m.revokeRefreshToken.mockResolvedValue(undefined)
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/sso/refresh',
      payload: { refreshToken: 'some-refresh-token' },
    })
    expect(res.statusCode).toBe(200)
    expect(m.signAccessToken).toHaveBeenCalledTimes(1)
    expect(m.insertRow).not.toHaveBeenCalled()
    // 对照：同一份白名单在登录腿上确实会拦（上面 403 那几条），说明这条绿不是判据失灵
    const loginLeg = await exchange(issueSsoCode())
    expect(loginLeg.statusCode).toBe(403)
  })
})

describe('白名单写面 —— 自救锚点随每次修改刷新', () => {
  it('POST 成功后写 ipWhitelistTrustedIp = 本次 request.ip', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/user/ip-whitelist',
      remoteAddress: '203.0.113.9',
      payload: { ip: '203.0.113.9' },
    })
    expect(res.statusCode).toBe(200)
    expect(store.get(rowKey(OWNER_ID, 'security', 'ipWhitelistTrustedIp'))).toBe('203.0.113.9')
  })

  it('DELETE 也刷锚点；摘到最后一项时删列表行但保留自救位', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/user/ip-whitelist',
      remoteAddress: '203.0.113.9',
      payload: { ip: '203.0.113.9' },
    })
    const del = await app.inject({
      method: 'DELETE',
      url: '/api/user/ip-whitelist?ip=203.0.113.9',
      remoteAddress: '198.51.100.7',
    })
    expect(del.statusCode).toBe(200)
    expect(del.json().data).toEqual([])
    expect(store.has(rowKey(OWNER_ID, 'security', 'ipWhitelist'))).toBe(false)
    expect(store.get(rowKey(OWNER_ID, 'security', 'ipWhitelistTrustedIp'))).toBe('198.51.100.7')
    // 清空白名单后同一台 IP 再登录 ⇒ 空表放行
    const res = await exchange(issueSsoCode())
    expect(res.statusCode).toBe(200)
  })
})

describe('normalizeIpLiteral', () => {
  it('同形判等：压缩形态、前导零、v4-mapped 都归一到一份', () => {
    expect(normalizeIpLiteral('::1')).toBe(normalizeIpLiteral('0:0:0:0:0:0:0:1'))
    expect(normalizeIpLiteral('2001:0DB8::0001')).toBe('2001:db8:0:0:0:0:0:1')
    expect(normalizeIpLiteral('::ffff:127.0.0.1')).toBe('127.0.0.1')
    expect(normalizeIpLiteral(' 127.0.0.1 ')).toBe('127.0.0.1')
    expect(normalizeIpLiteral('::')).toBe('0:0:0:0:0:0:0:0')
  })

  it('非字面量一律 null（CIDR、zone id、坏段、空值）', () => {
    for (const bad of ['10.0.0.0/24', 'fe80::1%eth0', '1:2:3', '999.1.1.1', '', '   ', 'abc']) {
      expect(normalizeIpLiteral(bad), bad).toBeNull()
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
