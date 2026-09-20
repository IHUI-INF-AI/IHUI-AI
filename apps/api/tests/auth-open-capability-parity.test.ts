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
import type { FastifyRequest } from 'fastify'

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
vi.mock('@ihui/auth', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, verifyAccessToken }
})
vi.mock('jose', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, decodeJwt }
})

const { authenticate, hasHumanJwtCredential } = await import('../src/plugins/auth.js')

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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
