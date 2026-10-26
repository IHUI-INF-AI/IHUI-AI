// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话吊销面 · 本轮四条服务端判据的行为夹具(2026-10-26 补,此前只写进提交信息)。
 *
 * 铁律:不连生产 PG(8810)/ Redis(8811) —— 所有 db/redis 走 vi.mock;
 * @ihui/auth 除三处 verify/sign 替身(需要注入任意 payload 的用例)外保留真实现,
 * 重放三档裁决走 services/refresh-replay-policy.ts 的**真实现**(AGENTS §0.6:
 * 测试 import 源判据,不在测试里复制第二份时间窗/家族逻辑)。
 *
 * 覆盖矩阵(每条都是"有副作用 / 无副作用"成对,摘掉对应判据必翻红):
 *  A. POST /sso/refresh 的重放三档裁决(routes/auth-sso.ts,与 /auth/refresh 同形):
 *     - race(宽限期内)⇒ 200 轮转,且不重复 revoke(固定窗口)、不查同族、不吊家族
 *     - stale-sibling(超宽限但族内有活 token)⇒ 401 + errorCode=REFRESH_TOKEN_STALE,
 *       不吊销家族、不签发
 *     - reuse(超宽限且族内无活 token)⇒ 吊销家族 + 401,不带 stale 码
 *     - 对照组:未吊销 ⇒ 200 且 revokeRefreshToken 恰好一次;禁用用户 ⇒ 403 不签发
 *     ⇒ 把 auth-sso.ts 的 assessRefreshReplay 分支摘掉(退回"revokedAt 一律 401")
 *       ⇒ race 例与 stale 例同时翻红。
 *  B. rotateRefreshTokenFlow 的 status!==1 ⇒ 403 且不签发(auth-extended.ts):
 *     ⇒ 摘掉该判定 ⇒ 403 例拿到 ok:true 翻红;把判据写反(≠1 放行)⇒ 对照组翻红。
 *  C. PUT /admin/users/:id:status 改成非 1 ⇒ revokeAllUserRefreshTokens;
 *     改成 1(启用)⇒ 不调用(对照,防止反向吊销)。
 *     ⇒ 摘掉 user-routes.ts 的吊销调用 ⇒ C-1 翻红;改成无条件吊销 ⇒ C-2 翻红。
 *  D. PUT /auth/profile/password:改密成功 ⇒ 吊销全量 refresh;
 *     旧密码错误 ⇒ 不改密(updateUser 未调用)且不吊销(对照)。
 *     ⇒ 摘掉吊销 ⇒ D-1 翻红;把校验放后(错密码也改密)⇒ D-2 翻红。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'
import cookie from '@fastify/cookie'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const FAMILY_ID = 'fam-001'

const m = vi.hoisted(() => ({
  // @ihui/auth 替身(仅注入 payload / 断言"有没有签发"所需)
  verifyRefreshToken: vi.fn(),
  signAccessToken: vi.fn(),
  signRefreshToken: vi.fn(),
  // db/queries 替身(吊销面的主角全在这)
  findUserById: vi.fn(),
  findRefreshToken: vi.fn(),
  revokeRefreshToken: vi.fn(),
  revokeRefreshTokenFamily: vi.fn(),
  findLiveFamilyToken: vi.fn(),
  revokeAllUserRefreshTokens: vi.fn(),
  updateUser: vi.fn(),
  saveRefreshToken: vi.fn(),
  // 鉴权替身
  authenticate: vi.fn(),
  requireAdmin: vi.fn(),
  // 周边副作用替身
  recordSecurityEvent: vi.fn(),
  getUserPermissions: vi.fn(),
  getUserStatus: vi.fn(),
  findUserPreferences: vi.fn(),
  // 口令替身(判据分型只看 verifyPassword 的 true/false,不测 KDF 本身)
  verifyPassword: vi.fn(),
  hashPassword: vi.fn(),
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
  },
}))

vi.mock('jose', () => ({ decodeJwt: () => ({}) }))

// @ihui/auth 真实现打底(importOriginal),只替三处需要注入任意 payload 的函数;
// isRefreshTokenReused / isRefreshTokenExpired / evaluatePkce 等保持真实现。
vi.mock('@ihui/auth', async (importOriginal) => {
  const actual = (await importOriginal<Record<string, unknown>>()) as Record<string, unknown>
  return {
    ...actual,
    verifyRefreshToken: m.verifyRefreshToken,
    signAccessToken: m.signAccessToken,
    signRefreshToken: m.signRefreshToken,
  }
})

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: m.authenticate,
  checkAuth: vi.fn(),
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAuth: vi.fn(async () => {}),
  requireAdmin: m.requireAdmin,
  requirePermission: () => vi.fn(async () => {}),
  requireAnyPermission: () => vi.fn(async () => {}),
}))

// 与真 drizzle 同形的可配置写链(参照 b28-bool-write-ack 的 makeChain):
// PUT /admin/users/:id 的 UPDATE … RETURNING 命中集由 writeRows 喂。
const state = vi.hoisted(() => ({
  selectRows: [] as unknown[],
  writeRows: [] as unknown[],
}))

function makeChain(getRows: () => unknown[]): Record<string, unknown> {
  // 目标取 callable(链式面会把它当函数调)但断言成 Record<string, unknown>:
  // Proxy 的 T 由变量注解(Record<string, unknown>)推断,传裸 function 会让 TS 判
  // 「`() => void` 不能赋给 `Record<string, unknown>`」(TS2345);
  // 断言后既保住 apply 陷阱(callable 目标),又让类型与注解一致。
  const proxy: Record<string, unknown> = new Proxy(
    function () {} as unknown as Record<string, unknown>,
    {
      get(_t, prop: string) {
        if (prop === 'then') {
          return (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
            Promise.resolve(getRows()).then(resolve, reject)
        }
        return proxy
      },
      apply() {
        return proxy
      },
    },
  )
  return proxy
}

function makeDb() {
  return {
    select: () => makeChain(() => state.selectRows),
    update: () => makeChain(() => state.writeRows),
    delete: () => makeChain(() => state.writeRows),
    insert: () => makeChain(() => state.writeRows),
    execute: () => Promise.resolve([]),
  }
}

vi.mock('../src/db/index.js', () => ({
  db: makeDb(),
  dbRead: makeDb(),
  dbClient: {},
}))

// db/queries 只覆盖"吊销面"相关的命名导出,其余保持真实现(路由图很大,少一格都会 import 即抛)
vi.mock('../src/db/queries.js', async (importOriginal) => {
  const actual = (await importOriginal<Record<string, unknown>>()) as Record<string, unknown>
  return {
    ...actual,
    findUserById: m.findUserById,
    findRefreshToken: m.findRefreshToken,
    revokeRefreshToken: m.revokeRefreshToken,
    revokeRefreshTokenFamily: m.revokeRefreshTokenFamily,
    findLiveFamilyToken: m.findLiveFamilyToken,
    revokeAllUserRefreshTokens: m.revokeAllUserRefreshTokens,
    updateUser: m.updateUser,
    saveRefreshToken: m.saveRefreshToken,
  }
})

vi.mock('../src/db/rbac-queries.js', async (importOriginal) => {
  const actual = (await importOriginal<Record<string, unknown>>()) as Record<string, unknown>
  return { ...actual, getUserPermissions: m.getUserPermissions }
})

vi.mock('../src/db/usercenter-queries.js', async (importOriginal) => {
  const actual = (await importOriginal<Record<string, unknown>>()) as Record<string, unknown>
  return { ...actual, getUserStatus: m.getUserStatus }
})

// 登录腿的 IP 白名单读本表:交空表 = 未启用 = 放行(本文件不测白名单)
vi.mock('../src/db/user-preferences-queries.js', () => ({
  USER_PREFERENCE_GROUPS: { security: 'security' },
  findUserPreferences: m.findUserPreferences,
  upsertUserPreference: vi.fn(),
  deleteUserPreference: vi.fn(),
}))

vi.mock('../src/db/security-logs-queries.js', async (importOriginal) => {
  const actual = (await importOriginal<Record<string, unknown>>()) as Record<string, unknown>
  return { ...actual, recordSecurityEvent: m.recordSecurityEvent }
})

// 口令判据分型用替身(测的是"验不过就不改密不吊销"这条链,不是 KDF 本身)
vi.mock('../src/utils/password-crypto.js', () => ({
  verifyPassword: m.verifyPassword,
  hashPassword: m.hashPassword,
}))

import { authSsoRoutes } from '../src/routes/auth-sso.js'
import { authExtendedRoutes, rotateRefreshTokenFlow } from '../src/routes/auth-extended.js'
import { userRoutes } from '../src/routes/admin-extended/user-routes.js'
import { REFRESH_TOKEN_STALE_ERROR_CODE } from '@ihui/shared/auth/auto-login-policy'

const baseUser = {
  id: USER_ID,
  phone: '13800000001',
  email: 't@example.com',
  nickname: 'T',
  avatar: '',
  roleId: 0,
  status: 1,
  familyId: FAMILY_ID,
  passwordHash: '$fake$hash',
}

const refreshPayload = {
  userId: USER_ID,
  phone: '13800000001',
  roleId: 0,
  familyId: FAMILY_ID,
  type: 'refresh' as const,
}

describe('会话吊销面 · 四条判据成对行为用例', () => {
  let appSso: FastifyInstance
  let appExt: FastifyInstance
  let appAdmin: FastifyInstance

  beforeAll(async () => {
    appSso = Fastify({ logger: false })
    await appSso.register(cookie)
    await appSso.register(authSsoRoutes, { prefix: '/api/auth' })
    await appSso.ready()

    appExt = Fastify({ logger: false })
    await appExt.register(cookie)
    await appExt.register(authExtendedRoutes)
    await appExt.ready()

    appAdmin = Fastify({ logger: false })
    await appAdmin.register(userRoutes)
    await appAdmin.ready()
  })

  afterAll(async () => {
    await Promise.all([appSso.close(), appExt.close(), appAdmin.close()])
  })

  beforeEach(() => {
    state.selectRows = []
    state.writeRows = []
    m.verifyRefreshToken.mockReset()
    m.verifyRefreshToken.mockResolvedValue(refreshPayload)
    m.signAccessToken.mockReset()
    m.signAccessToken.mockResolvedValue('at-new')
    m.signRefreshToken.mockReset()
    m.signRefreshToken.mockResolvedValue('rt-new')
    m.findUserById.mockReset()
    m.findUserById.mockResolvedValue(baseUser)
    m.findRefreshToken.mockReset()
    m.findRefreshToken.mockResolvedValue({
      token: 'fixture-refresh-token',
      userId: USER_ID,
      familyId: FAMILY_ID,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86_400_000),
    })
    m.revokeRefreshToken.mockReset()
    m.revokeRefreshToken.mockResolvedValue(undefined)
    m.revokeRefreshTokenFamily.mockReset()
    m.revokeRefreshTokenFamily.mockResolvedValue(0)
    m.findLiveFamilyToken.mockReset()
    m.findLiveFamilyToken.mockResolvedValue(null)
    m.revokeAllUserRefreshTokens.mockReset()
    m.revokeAllUserRefreshTokens.mockResolvedValue(undefined)
    m.updateUser.mockReset()
    m.updateUser.mockResolvedValue({ id: USER_ID })
    m.saveRefreshToken.mockReset()
    m.saveRefreshToken.mockResolvedValue(undefined)
    m.authenticate.mockReset()
    m.authenticate.mockImplementation(async (request: FastifyRequest) => {
      // 与 b28-bool-write-ack 同法:鉴权面与本次判据无关,只负责注入 userId
      ;(request as { userId?: string }).userId = USER_ID
      return refreshPayload
    })
    m.requireAdmin.mockReset()
    m.requireAdmin.mockImplementation(async (request: FastifyRequest) => {
      ;(request as { userId?: string }).userId = USER_ID
    })
    m.recordSecurityEvent.mockReset()
    m.recordSecurityEvent.mockResolvedValue(undefined)
    m.getUserPermissions.mockReset()
    m.getUserPermissions.mockResolvedValue([])
    m.getUserStatus.mockReset()
    m.getUserStatus.mockResolvedValue(1)
    m.findUserPreferences.mockReset()
    m.findUserPreferences.mockResolvedValue({ list: [], total: 0 })
    m.verifyPassword.mockReset()
    m.verifyPassword.mockResolvedValue(true)
    m.hashPassword.mockReset()
    m.hashPassword.mockResolvedValue('$fake$newhash')
  })

  // ───────── A. POST /sso/refresh 重放三档(refresh-replay-policy 真实现) ─────────
  describe('A · POST /api/auth/sso/refresh — 重放三档裁决(与 /auth/refresh 同尺)', () => {
    const ssoRefresh = (token = 'fixture-refresh-token') =>
      appSso.inject({
        method: 'POST',
        url: '/api/auth/sso/refresh',
        payload: { refreshToken: token },
      })

    it('A-0 对照:未被吊销的 token ⇒ 200 轮转,旧 token 恰好 revoke 一次', async () => {
      const res = await ssoRefresh()
      expect(res.statusCode).toBe(200)
      expect(res.json().data.accessToken).toBe('at-new')
      expect(m.revokeRefreshToken).toHaveBeenCalledTimes(1)
      expect(m.revokeRefreshToken).toHaveBeenCalledWith('fixture-refresh-token')
      expect(m.revokeRefreshTokenFamily).not.toHaveBeenCalled()
      // 未吊销的常规轮转不该触碰重放裁决
      expect(m.findLiveFamilyToken).not.toHaveBeenCalled()
    })

    it('A-1 race(宽限期内重放)⇒ 200 正常轮转,且**不重复 revoke**(固定窗口不滑动)', async () => {
      m.findRefreshToken.mockResolvedValue({
        token: 'fixture-refresh-token',
        userId: USER_ID,
        familyId: FAMILY_ID,
        revokedAt: new Date(Date.now() - 5_000), // < 30s leeway
        expiresAt: new Date(Date.now() + 86_400_000),
      })
      const res = await ssoRefresh()
      expect(res.statusCode).toBe(200)
      expect(res.json().data.refreshToken).toBe('rt-new')
      expect(m.revokeRefreshToken).not.toHaveBeenCalled() // 已是吊销态,重刷 revokedAt 即滑窗
      expect(m.revokeRefreshTokenFamily).not.toHaveBeenCalled()
      expect(m.findLiveFamilyToken).not.toHaveBeenCalled() // race 短路,不该查同族活 token
    })

    it('A-2 stale-sibling(超宽限但族内有活 token)⇒ 401 + REFRESH_TOKEN_STALE,不吊族不签发', async () => {
      m.findRefreshToken.mockResolvedValue({
        token: 'fixture-refresh-token',
        userId: USER_ID,
        familyId: FAMILY_ID,
        revokedAt: new Date(Date.now() - 60_000),
        expiresAt: new Date(Date.now() + 86_400_000),
      })
      m.findLiveFamilyToken.mockResolvedValue({ id: 'sibling-live' })
      const res = await ssoRefresh()
      expect(res.statusCode).toBe(401)
      const body = res.json()
      expect(body.errorCode).toBe(REFRESH_TOKEN_STALE_ERROR_CODE)
      // 只拒本次:副作用两侧都断言
      expect(m.revokeRefreshTokenFamily).not.toHaveBeenCalled()
      expect(m.revokeRefreshToken).not.toHaveBeenCalled()
      expect(m.signAccessToken).not.toHaveBeenCalled()
      expect(m.saveRefreshToken).not.toHaveBeenCalled()
    })

    it('A-3 reuse(超宽限且族内无活 token)⇒ 吊销整族 + 401,**不带** stale 码', async () => {
      m.findRefreshToken.mockResolvedValue({
        token: 'fixture-refresh-token',
        userId: USER_ID,
        familyId: FAMILY_ID,
        revokedAt: new Date(Date.now() - 60_000),
        expiresAt: new Date(Date.now() + 86_400_000),
      })
      m.findLiveFamilyToken.mockResolvedValue(null)
      const res = await ssoRefresh()
      expect(res.statusCode).toBe(401)
      const body = res.json()
      expect(body.errorCode).toBeUndefined()
      expect(m.revokeRefreshTokenFamily).toHaveBeenCalledTimes(1)
      expect(m.revokeRefreshTokenFamily).toHaveBeenCalledWith(FAMILY_ID)
      expect(m.signAccessToken).not.toHaveBeenCalled()
    })

    it('A-4 对照:禁用用户(status!==1)仍 403 且不签发(保留既有判定)', async () => {
      m.findUserById.mockResolvedValue({ ...baseUser, status: 0 })
      const res = await ssoRefresh()
      expect(res.statusCode).toBe(403)
      expect(m.signAccessToken).not.toHaveBeenCalled()
      expect(m.revokeRefreshToken).not.toHaveBeenCalled()
    })
  })

  // ───────── B. rotateRefreshTokenFlow 的禁用账号闸门 ─────────
  describe('B · rotateRefreshTokenFlow — status!==1 ⇒ 403 且轮转未发生', () => {
    it('B-1 禁用用户 ⇒ { ok:false, status:403 },不吊销、不签发', async () => {
      m.findUserById.mockResolvedValue({ ...baseUser, status: 0 })
      const result = await rotateRefreshTokenFlow('fixture-refresh-token')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.status).toBe(403)
        expect(result.message).toContain('禁用')
      }
      expect(m.revokeRefreshToken).not.toHaveBeenCalled()
      expect(m.signAccessToken).not.toHaveBeenCalled()
      expect(m.signRefreshToken).not.toHaveBeenCalled()
      expect(m.saveRefreshToken).not.toHaveBeenCalled()
    })

    it('B-2 对照:启用用户 ⇒ 正常轮转签发(防判据写反把所有人都拒了)', async () => {
      const result = await rotateRefreshTokenFlow('fixture-refresh-token')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.tokens.accessToken).toBe('at-new')
        expect(result.tokens.refreshToken).toBe('rt-new')
      }
      expect(m.revokeRefreshToken).toHaveBeenCalledWith('fixture-refresh-token')
      expect(m.signAccessToken).toHaveBeenCalledTimes(1)
    })
  })

  // ───────── C. PUT /admin/users/:id 禁用即吊销 ─────────
  describe('C · PUT /admin/users/:id — 改非启用态必须吊销全量 refresh;改回启用不吊销', () => {
    it('C-1 status 改成 0 ⇒ 200 且 revokeAllUserRefreshTokens(id) 恰好一次', async () => {
      state.writeRows = [{ id: USER_ID, status: 0 }]
      const res = await appAdmin.inject({
        method: 'PUT',
        url: `/admin/users/${USER_ID}`,
        payload: { status: 0 },
      })
      expect(res.statusCode).toBe(200)
      expect(m.revokeAllUserRefreshTokens).toHaveBeenCalledTimes(1)
      expect(m.revokeAllUserRefreshTokens).toHaveBeenCalledWith(USER_ID)
    })

    it('C-2 对照:status 改成 1(启用)⇒ 200 且**不调用**吊销(防反向)', async () => {
      state.writeRows = [{ id: USER_ID, status: 1 }]
      const res = await appAdmin.inject({
        method: 'PUT',
        url: `/admin/users/${USER_ID}`,
        payload: { status: 1 },
      })
      expect(res.statusCode).toBe(200)
      expect(m.revokeAllUserRefreshTokens).not.toHaveBeenCalled()
    })

    it('C-3 对照:body 不含 status(改昵称)⇒ 不误吊销', async () => {
      state.writeRows = [{ id: USER_ID, status: 1, nickname: 'N' }]
      const res = await appAdmin.inject({
        method: 'PUT',
        url: `/admin/users/${USER_ID}`,
        payload: { nickname: 'N' },
      })
      expect(res.statusCode).toBe(200)
      expect(m.revokeAllUserRefreshTokens).not.toHaveBeenCalled()
    })
  })

  // ───────── D. PUT /auth/profile/password 改密即吊销 ─────────
  describe('D · PUT /auth/profile/password — 改密成功吊销全量;旧密码错则不改不吊', () => {
    const putPassword = (body: Record<string, string>) =>
      appExt.inject({ method: 'PUT', url: '/auth/profile/password', payload: body })

    it('D-1 旧密码正确 ⇒ 改密成功且 revokeAllUserRefreshTokens(userId) 恰好一次', async () => {
      const res = await putPassword({ oldPassword: 'old-secret', newPassword: 'new-secret-123' })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.updated).toBe(true)
      expect(m.updateUser).toHaveBeenCalledTimes(1)
      expect(m.revokeAllUserRefreshTokens).toHaveBeenCalledTimes(1)
      expect(m.revokeAllUserRefreshTokens).toHaveBeenCalledWith(USER_ID)
    })

    it('D-2 对照:旧密码错误 ⇒ 400,不改密(无 UPDATE)且不吊销', async () => {
      m.verifyPassword.mockResolvedValue(false)
      const res = await putPassword({ oldPassword: 'wrong', newPassword: 'new-secret-123' })
      expect(res.statusCode).toBe(400)
      expect(m.updateUser).not.toHaveBeenCalled()
      expect(m.revokeAllUserRefreshTokens).not.toHaveBeenCalled()
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
