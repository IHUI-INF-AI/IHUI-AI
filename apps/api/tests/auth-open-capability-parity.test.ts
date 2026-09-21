// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * O6 回归锁:`plugins/auth.ts` 的 `authenticate()` 对**纯 JWT 调用方逐字节不变**。
 *
 * 本批为 `authenticate()` 加了唯一一条新分支(函数体首行的 `request.openCapability`
 * 判定)。该字段只由 `utils/open-capability-gate.ts` 注入,全站存量调用点形如
 * `authenticate(request)` 且不带该字段 —— 本文件把「不带标记时九种场景的返回/抛错
 * 完全等于既有实现」钉成断言表(状态码 + 消息 + 注入字段),任何一种偏差即红。
 *
 * 禁连生产:verifyAccessToken / getUserStatus / API Key 鉴权全部 mock,不触 DB、Redis。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { FastifyReply, FastifyRequest } from 'fastify'

const { getUserStatus, verifyAccessToken, decodeJwt } = vi.hoisted(() => ({
  getUserStatus: vi.fn<(id: string) => Promise<number | undefined>>(),
  verifyAccessToken: vi.fn<(t: string) => Promise<unknown>>(),
  decodeJwt: vi.fn<(t: string) => Record<string, unknown>>(),
}))

vi.mock('../src/db/usercenter-queries.js', () => ({ getUserStatus }))
vi.mock('../src/db/index.js', () => ({ db: {}, dbRead: {} }))
vi.mock('../src/plugins/api-key-auth.js', () => ({
  authenticateApiKey: vi.fn(),
  requireApiKeyAuth: vi.fn(),
  requireApiKeyPermission: vi.fn(),
  requireApiKeyQuota: vi.fn(),
}))
// O13b(2026-09-21)提权面自证需要:require-permission 的 checkAnyPermission 走 spy,
// 机器分支下"不得有管理员通配豁免、只准落 RBAC 归属人校验"才可断言。
const mockCheckAnyPermission = vi.hoisted(() =>
  vi.fn<(userId: string, perms: string[]) => Promise<boolean>>(),
)
vi.mock('../src/db/rbac-queries.js', () => ({ checkAnyPermission: mockCheckAnyPermission }))

vi.mock('@ihui/auth', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, verifyAccessToken }
})
vi.mock('jose', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, decodeJwt }
})

const { authenticate, hasHumanJwtCredential } = await import('../src/plugins/auth.js')
const { requireAdmin, requireAnyPermission } = await import('../src/plugins/require-permission.js')
const { requireCapability } = await import('../src/utils/capability-guard.js')

function makeRequest(overrides: {
  authorization?: string
  method?: string
  xRequestedWith?: string
  cookieToken?: string
  openCapability?: { key: 'v1-tools-directory'; scope: 'tools:read'; dataClass: 'compute' }
  apiKeyUserId?: string
}): FastifyRequest {
  const headers: Record<string, string> = {}
  if (overrides.authorization) headers.authorization = overrides.authorization
  if (overrides.xRequestedWith) headers['x-requested-with'] = overrides.xRequestedWith
  return {
    method: overrides.method ?? 'GET',
    headers,
    cookies: overrides.cookieToken ? { auth_token: overrides.cookieToken } : {},
    userId: undefined,
    jwtPayload: undefined,
    openCapability: overrides.openCapability,
    apiKey: overrides.apiKeyUserId
      ? ({ id: 'k1', userId: overrides.apiKeyUserId } as unknown as FastifyRequest['apiKey'])
      : undefined,
  } as unknown as FastifyRequest
}

/** 把一次 authenticate() 调用压成可比较的结果快照(抛错 → {code,message};成功 → payload + 注入字段)。 */
async function settle(request: FastifyRequest): Promise<Record<string, unknown>> {
  try {
    const payload = await authenticate(request)
    return {
      ok: true,
      payload,
      userId: request.userId,
      jwtPayload: request.jwtPayload,
      openCapability: request.openCapability,
    }
  } catch (e) {
    const err = e as Error & { statusCode?: number }
    return { ok: false, statusCode: err.statusCode, message: err.message }
  }
}

const SCENARIOS: Record<string, Parameters<typeof makeRequest>[0]> = {
  '无凭据': {},
  'Bearer 验签失败': { authorization: 'Bearer garbage' },
  'challenge token 拒绝': { authorization: 'Bearer challenge.jwt' },
  '用户不存在': { authorization: 'Bearer unknown.user' },
  '账号已封禁': { authorization: 'Bearer banned.user' },
  '账号已注销': { authorization: 'Bearer gone.user' },
  '正常 access token': { authorization: 'Bearer ok.user' },
  'cookie 兜底 + 状态变更缺 CSRF 头': { method: 'POST', cookieToken: 'ok.user' },
  'cookie 兜底 + CSRF 头齐备': { method: 'POST', cookieToken: 'ok.user', xRequestedWith: 'XMLHttpRequest' },
  'cookie 兜底 GET': { cookieToken: 'ok.user' },
}

beforeEach(() => {
  vi.clearAllMocks()
  verifyAccessToken.mockImplementation(async (token: string) => {
    if (token === 'garbage') throw new Error('bad signature')
    return { userId: token.replace(/\.user$/, ''), phone: '', familyId: 'f1', roleId: 0 }
  })
  decodeJwt.mockImplementation((token: string) => ({
    type: token.startsWith('challenge') ? 'challenge' : 'access',
  }))
  // 用户状态按 userId 判定:未知 → undefined,封禁 → 0,注销 → 3,其余正常
  getUserStatus.mockImplementation(async (id: string) => {
    if (id === 'unknown') return undefined
    if (id === 'banned') return 0
    if (id === 'gone') return 3
    return 1
  })
})

describe('authenticate() 纯 JWT 行为逐字节不变', () => {
  const expected: Record<string, unknown> = {
    无凭据: { ok: false, statusCode: 401, message: 'Authentication required' },
    'Bearer 验签失败': { ok: false, statusCode: 401, message: 'Invalid or expired token' },
    'challenge token 拒绝': {
      ok: false,
      statusCode: 401,
      message: 'Challenge token cannot be used for this endpoint',
    },
    用户不存在: { ok: false, statusCode: 401, message: '用户不存在' },
    账号已封禁: { ok: false, statusCode: 403, message: '账号已被封禁' },
    账号已注销: { ok: false, statusCode: 401, message: '账号已注销' },
    'cookie 兜底 + 状态变更缺 CSRF 头': { ok: false, statusCode: 403, message: 'CSRF 校验失败' },
  }

  for (const [name, init] of Object.entries(SCENARIOS)) {
    it(`${name} → 与既有实现一致`, async () => {
      const request = makeRequest(init)
      const credential = init.authorization ?? init.cookieToken
      // authenticate() 从 Bearer 头里剥掉 'Bearer ' 才是送进 verifyAccessToken 的 token
      const token = credential?.replace(/^Bearer /, '')
      const result = await settle(request)

      if (expected[name]) {
        expect(result).toEqual(expected[name])
        // 失败路径不得注入任何身份
        expect(request.userId).toBeUndefined()
        expect(request.jwtPayload).toBeUndefined()
        return
      }
      // 成功路径:userId / jwtPayload 均取自 JWT payload,且不带开放标记
      expect(result.ok).toBe(true)
      expect(result.userId).toBe(token!.replace('.user', ''))
      expect(result.jwtPayload).toBeDefined()
      expect(result.openCapability).toBeUndefined()
    })
  }

  it('人凭据在场时,即使另带 API Key 也仍按 JWT 链路走(不触机器分支)', async () => {
    const request = makeRequest({ authorization: 'Bearer ok.user' })
    const withKey = makeRequest({ authorization: 'Bearer ok.user' })
    withKey.apiKey = { id: 'k1', userId: 'owner-9' } as unknown as FastifyRequest['apiKey']
    expect(await settle(withKey)).toEqual(await settle(request))
  })
})

describe('authenticate() 的开放能力分支仅在显式打标时生效', () => {
  it('带标记:直接按机器归属人放行,不再验 JWT、不再查用户状态', async () => {
    const request = makeRequest({
      openCapability: { key: 'v1-tools-directory', scope: 'tools:read', dataClass: 'compute' },
      apiKeyUserId: 'owner-7',
    })
    const result = await settle(request)
    expect(result).toMatchObject({
      ok: true,
      payload: { userId: 'owner-7', roleId: 0, familyId: 'open-capability:v1-tools-directory' },
      userId: 'owner-7',
    })
    // 刻意不写 jwtPayload:避免 O4 buildPrincipal 把机器调用误判成人调用
    expect(request.jwtPayload).toBeUndefined()
    expect(verifyAccessToken).not.toHaveBeenCalled()
    expect(getUserStatus).not.toHaveBeenCalled()
  })

  it('带标记但查不到归属人:防御性 401,绝不按匿名放行', async () => {
    const request = makeRequest({
      openCapability: { key: 'v1-tools-directory', scope: 'tools:read', dataClass: 'compute' },
    })
    expect(await settle(request)).toEqual({
      ok: false,
      statusCode: 401,
      message: 'Open capability grant missing owning principal',
    })
  })
})

describe('hasHumanJwtCredential', () => {
  it('Bearer 人 token / auth_token cookie 判为人;Bearer ihui_ 与 x-api-key 判为机器', () => {
    expect(hasHumanJwtCredential(makeRequest({ authorization: 'Bearer ok.user' }))).toBe(true)
    expect(hasHumanJwtCredential(makeRequest({ cookieToken: 'ok.user' }))).toBe(true)
    expect(hasHumanJwtCredential(makeRequest({ authorization: 'Bearer ihui_key' }))).toBe(false)
    expect(hasHumanJwtCredential(makeRequest({}))).toBe(false)
  })
})

/**
 * O13b 提权面自证(2026-09-21):机器凭据(API Key)在任何 roleId>=1 判定形态下拿不到特权。
 *
 * B.1 authenticate() open-capability 分支返回值 roleId 恒 0 —— 结构性证明:该分支
 *     **从不读取**归属人的角色(authenticate 在此路径不查 DB、不验 JWT),故"归属人
 *     是管理员(roleId>=1)"在代码路径上无法传播到判定;断言 roleId===0 且
 *     jwtPayload 未被注入(所有 `request.jwtPayload?.roleId` 读点对机器请求恒得
 *     undefined ⇒ ?? 0)。
 * B.2 受 requireAdmin 保护的端点用 API Key(归属人为管理员)打 ⇒ 拒绝,不得 200。
 *     两种形态都测:① 带开放能力标记(模拟 admin 路由被误登记进能力表)⇒ 403;
 *     ② 纯 API Key 无标记(admin 面真实形态)⇒ authenticate 抛 401。
 *     附:requireAnyPermission 机器分支不得走"管理员直接放行",必须落 RBAC 归属人校验。
 * B.3 requireCapability 闸对 platform 域 scope 恒 403(M2M_FORBIDDEN)。
 *     既有引用:open-capability-registry.test.ts:82(登记表不变量)与 :88(编译期字面量
 *     联合护栏);此处补**运行期 HTTP 层**一条,证明即便接线也拿不到放行。
 * 全部 mock(§5 隔离铁律):不触 DB / Redis / 任何服务。
 */
describe('O13b 机器凭据提权闸 — roleId>=1 判定对 API Key 恒关闭', () => {
  const OPEN_MARK = {
    key: 'v1-tools-directory',
    scope: 'tools:read',
    dataClass: 'compute',
  } as const

  /** 最小 FastifyReply 替身:捕获 status + send 负载(requireAdmin/requireCapability 只用这两个方法)。 */
  function captureReply(): {
    reply: FastifyReply
    sent: { status?: number; body?: Record<string, unknown> }
  } {
    const sent: { status?: number; body?: Record<string, unknown> } = {}
    const reply = {
      status(code: number) {
        sent.status = code
        return reply
      },
      send(body: Record<string, unknown>) {
        sent.body = body
        return reply
      },
    } as unknown as FastifyReply
    return { reply, sent }
  }

  it('B.1 归属人是管理员:open-capability 分支返回 roleId 恒 0,且不查 DB/JWT', async () => {
    // 归属人 user id 命名为 admin-owner:即便其 users.roleId >= 1,本分支也无任何代码
    // 路径把它读进 payload —— getUserStatus/verifyAccessToken 均未被调用即为证明。
    const request = makeRequest({ openCapability: OPEN_MARK, apiKeyUserId: 'admin-owner' })
    const payload = await authenticate(request)
    expect(payload.roleId).toBe(0)
    expect(payload.userId).toBe('admin-owner')
    expect(request.jwtPayload).toBeUndefined()
    expect(verifyAccessToken).not.toHaveBeenCalled()
    expect(getUserStatus).not.toHaveBeenCalled()
  })

  it('B.2a requireAdmin + 能力标记的 API Key(归属人管理员)⇒ 403,不得 200', async () => {
    const request = makeRequest({ openCapability: OPEN_MARK, apiKeyUserId: 'admin-owner' })
    const { reply, sent } = captureReply()
    await requireAdmin(request, reply)
    expect(sent.status).toBe(403)
    expect(sent.body?.code).toBe(403)
  })

  it('B.2b requireAdmin + 纯 API Key(admin 路由真实形态,无标记无 JWT)⇒ 401', async () => {
    const request = makeRequest({})
    request.apiKey = { id: 'k9', userId: 'admin-owner' } as unknown as FastifyRequest['apiKey']
    const { reply, sent } = captureReply()
    await requireAdmin(request, reply)
    expect(sent.status).toBe(401)
  })

  it('B.2c requireAnyPermission 机器分支:无管理员通配豁免,必须落 RBAC 归属人校验', async () => {
    mockCheckAnyPermission.mockResolvedValue(false)
    const request = makeRequest({ openCapability: OPEN_MARK, apiKeyUserId: 'admin-owner' })
    const { reply, sent } = captureReply()
    await requireAnyPermission(['edu:manage'])(request, reply)
    expect(mockCheckAnyPermission).toHaveBeenCalledWith('admin-owner', ['edu:manage'])
    expect(sent.status).toBe(403)
  })

  it('B.3 requireCapability 对 platform 域 scope(publish:operate)恒 403 M2M_FORBIDDEN', async () => {
    const gate = requireCapability('publish:operate' as never)
    const request = makeRequest({})
    request.apiKey = {
      id: 'k1',
      userId: 'owner-1',
      permissions: ['*'],
    } as unknown as FastifyRequest['apiKey']
    const { reply, sent } = captureReply()
    await gate(request, reply)
    expect(sent.status).toBe(403)
    expect(sent.body?.errorCode).toBe('M2M_FORBIDDEN')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
