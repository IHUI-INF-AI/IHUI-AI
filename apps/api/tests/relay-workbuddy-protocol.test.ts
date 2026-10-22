// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WorkBuddy 协议层加固单测(2026-10-22 立),与 workbuddy-upstream-adapter.test.ts 互补:
 * - parseLoginState 双格式矩阵:token JSON(驼峰/下划线/token 键)、cookie 串、裸 JWT/opaque、
 *   cookies 数组兜底;显式 refreshToken > 内嵌;embeddedRefreshToken 去重
 * - buildChatRequest 双格式建请求:Bearer 取内层 accessToken,claims 从内层 JWT 解析,红线不带 X-Refresh-Token
 * - refreshToken 回退链:主端点失败→备用端点;主凭证失败→备用凭据字段;凭证去重;全败抛最后一次错误且 message 不带凭证
 * - 错误分类矩阵:HTML 登录页 / JSON error 体 / SSE 断流帧 / 402 / 12153 / 429 / 404 / request 码 / 5xx / 406
 * - isAuthError:抛错 message 里的 "HTTP 401/403" 还原状态码判定(401 自愈依赖)
 *
 * 零网络:fetch 用 vi.stubGlobal 打桩;row 用最小形状 cast。
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import type { AiRelayAccountPool } from '@ihui/database'
import type {
  AdapterAccountContext,
  NormalizedChatRequest,
} from '../src/services/relay-upstream-adapters.js'
import { workbuddyAdapter } from '../src/services/upstream-adapters/workbuddy-adapter.js'
import {
  classifyUpstreamFailure,
  isAuthFailureCore,
  looksLikeHtmlLoginPage,
  parseCookieString,
  parseLoginState,
  REFRESH_ENDPOINT_PATHS,
} from '../src/services/upstream-adapters/workbuddy-protocol.js'

// =============================================================================
// 夹具
// =============================================================================

function jwtWith(claims: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64({ alg: 'none' })}.${b64(claims)}.sig`
}

function makeCtx(opts?: {
  rowUid?: string
  token?: string
  refreshToken?: string | null
  cookies?: Array<Record<string, unknown>>
  extraMetadata?: Record<string, unknown>
  tokenExpiresAt?: Date | null
}): AdapterAccountContext {
  const row = {
    uid: opts?.rowUid ?? 'row-uid-1',
    extraMetadata: opts?.extraMetadata ?? {},
    tokenExpiresAt: opts?.tokenExpiresAt ?? null,
  } as unknown as AiRelayAccountPool
  return {
    row,
    credentials: {
      token: opts?.token ?? 'plain-access-token',
      refreshToken: opts?.refreshToken === undefined ? 'rt-old' : opts?.refreshToken,
      cookies: opts?.cookies ?? [],
      secrets: {},
    },
  }
}

const baseReq: NormalizedChatRequest = {
  model: 'claude-sonnet-4',
  messages: [{ role: 'user', content: 'hi' }],
  stream: true,
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })
}

const PRIMARY_URL = 'https://copilot.tencent.com/v2/plugin/auth/token/refresh'
const BACKUP_URL = 'https://copilot.tencent.com/v2/auth/token/refresh'

const refreshOk = { code: 0, msg: 'ok', data: { accessToken: 'AT-new', expiresIn: 60 } }

function callUrl(call: unknown): string {
  return (call as [string, RequestInit])[0]
}
function callHeader(call: unknown, name: string): string {
  return ((call as [string, RequestInit])[1].headers as Record<string, string>)[name] ?? ''
}

afterEach(() => {
  vi.unstubAllGlobals()
})

// =============================================================================
// parseCookieString / parseLoginState 双格式矩阵
// =============================================================================

describe('parseCookieString', () => {
  it('k=v 分段;同名取首个;无 = 段忽略', () => {
    expect(parseCookieString('a=1; b=2; a=9')).toEqual({ a: '1', b: '2' })
    expect(parseCookieString('novalue; x=1')).toEqual({ x: '1' })
    expect(parseCookieString('')).toEqual({})
  })
})

describe('parseLoginState(双格式兼容)', () => {
  it('token JSON 驼峰/下划线/token 键都认', () => {
    expect(
      parseLoginState({ token: JSON.stringify({ accessToken: 'AT', refreshToken: 'RT' }) }),
    ).toEqual({
      accessToken: 'AT',
      refreshToken: 'RT',
      embeddedRefreshToken: 'RT',
    })
    expect(
      parseLoginState({ token: JSON.stringify({ access_token: 'AT2', refresh_token: 'RT2' }) }),
    ).toEqual({ accessToken: 'AT2', refreshToken: 'RT2', embeddedRefreshToken: 'RT2' })
    expect(parseLoginState({ token: JSON.stringify({ token: 'AT3' }) })).toEqual({
      accessToken: 'AT3',
      refreshToken: '',
      embeddedRefreshToken: '',
    })
  })

  it('cookie 串:已知键名才拆;裸 opaque 含 = 不误拆', () => {
    expect(parseLoginState({ token: 'token=AT; refresh_token=RT; other=x' })).toEqual({
      accessToken: 'AT',
      refreshToken: 'RT',
      embeddedRefreshToken: 'RT',
    })
    expect(parseLoginState({ token: 'abc=def' })).toEqual({
      accessToken: 'abc=def', // 无已知键名 → 原样 opaque
      refreshToken: '',
      embeddedRefreshToken: '',
    })
  })

  it('裸 JWT 原样作 accessToken;非法 JSON(以 { 开头)按 opaque', () => {
    const jwt = jwtWith({ uid: 'u' })
    expect(parseLoginState({ token: jwt })).toEqual({
      accessToken: jwt,
      refreshToken: '',
      embeddedRefreshToken: '',
    })
    expect(parseLoginState({ token: '{broken' }).accessToken).toBe('{broken')
  })

  it('显式 refreshToken 优先于内嵌;内嵌与显式同值时 embeddedRefreshToken 去重为空', () => {
    const embedded = parseLoginState({
      token: JSON.stringify({ accessToken: 'AT', refreshToken: 'RT-emb' }),
      refreshToken: 'RT-explicit',
    })
    expect(embedded.refreshToken).toBe('RT-explicit')
    expect(embedded.embeddedRefreshToken).toBe('RT-emb')
    const dedup = parseLoginState({
      token: JSON.stringify({ accessToken: 'AT', refreshToken: 'RT-same' }),
      refreshToken: 'RT-same',
    })
    expect(dedup.embeddedRefreshToken).toBe('')
  })

  it('cookies 数组兜底:token 空补 access;JSON 缺 refresh 补内嵌', () => {
    expect(
      parseLoginState({
        token: '',
        cookies: [
          { name: 'user_token', value: 'AT-arr' },
          { name: 'refreshToken', value: 'RT-arr' },
        ],
      }),
    ).toEqual({ accessToken: 'AT-arr', refreshToken: 'RT-arr', embeddedRefreshToken: 'RT-arr' })
    const filled = parseLoginState({
      token: JSON.stringify({ accessToken: 'AT' }),
      cookies: [{ name: 'refresh_token', value: 'RT2' }],
    })
    expect(filled.refreshToken).toBe('RT2')
  })

  it('空凭据 → 全空串', () => {
    expect(parseLoginState({ token: '', refreshToken: null, cookies: [] })).toEqual({
      accessToken: '',
      refreshToken: '',
      embeddedRefreshToken: '',
    })
  })
})

// =============================================================================
// buildChatRequest 双格式建请求
// =============================================================================

describe('workbuddyAdapter.buildChatRequest(双格式)', () => {
  it('token JSON 形态:Bearer 取内层 accessToken,身份 claims 从内层 JWT 解析', () => {
    const inner = jwtWith({ uid: 'jwt-uid', enterprise_id: 'jwt-ent', domain: 'codebuddy.cn' })
    const http = workbuddyAdapter.buildChatRequest(
      makeCtx({ token: JSON.stringify({ accessToken: inner }) }),
      baseReq,
    )
    expect(http.headers['Authorization']).toBe(`Bearer ${inner}`)
    expect(http.headers['X-User-Id']).toBe('jwt-uid')
    expect(http.headers['X-Enterprise-Id']).toBe('jwt-ent')
    expect(http.headers['X-Domain']).toBe('codebuddy.cn')
    expect(http.headers['X-Refresh-Token']).toBeUndefined() // 红线
  })

  it('cookie 串形态:Bearer 取 token 键值', () => {
    const http = workbuddyAdapter.buildChatRequest(
      makeCtx({ token: 'token=AT-ck; refresh_token=RT-ck' }),
      baseReq,
    )
    expect(http.headers['Authorization']).toBe('Bearer AT-ck')
    expect(http.headers['X-Refresh-Token']).toBeUndefined()
  })

  it('cookies 数组形态:Bearer 取 user_token', () => {
    const http = workbuddyAdapter.buildChatRequest(
      makeCtx({ token: '', cookies: [{ name: 'user_token', value: 'AT-arr' }] }),
      baseReq,
    )
    expect(http.headers['Authorization']).toBe('Bearer AT-arr')
  })

  it('global realm cookie 串(domain=workbuddy.ai)走 www.workbuddy.ai 端点', () => {
    const http = workbuddyAdapter.buildChatRequest(
      makeCtx({ token: 'accessToken=AT', extraMetadata: { domain: 'workbuddy.ai' } }),
      baseReq,
    )
    expect(http.url).toBe('https://www.workbuddy.ai/v2/chat/completions')
    expect(http.headers['Authorization']).toBe('Bearer AT')
  })
})

// =============================================================================
// refreshToken 回退链
// =============================================================================

describe('workbuddyAdapter.refreshToken(回退路径)', () => {
  it('主端点 401 → 备用端点成功(两次调用按序,凭证不变)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ code: 1, msg: 'x' }, 401))
      .mockResolvedValueOnce(jsonResponse(refreshOk))
    vi.stubGlobal('fetch', fetchMock)
    const res = await workbuddyAdapter.refreshToken!(makeCtx({ refreshToken: 'rt-a' }))
    expect(res?.token).toBe('AT-new')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(callUrl(fetchMock.mock.calls[0])).toBe(PRIMARY_URL)
    expect(callUrl(fetchMock.mock.calls[1])).toBe(BACKUP_URL)
    expect(callHeader(fetchMock.mock.calls[1], 'X-Refresh-Token')).toBe('rt-a')
  })

  it('主凭证两端点全败 → 备用凭据字段(内嵌 refresh)成功', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ code: 1, msg: 'x' }, 401))
      .mockResolvedValueOnce(jsonResponse({ code: 2, msg: 'x' }, 403))
      .mockResolvedValueOnce(jsonResponse(refreshOk))
    vi.stubGlobal('fetch', fetchMock)
    const ctx = makeCtx({
      refreshToken: 'rt-a',
      token: JSON.stringify({ accessToken: 'AT', refreshToken: 'rt-b' }),
    })
    const res = await workbuddyAdapter.refreshToken!(ctx)
    expect(res?.token).toBe('AT-new')
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(callUrl(fetchMock.mock.calls[2])).toBe(PRIMARY_URL)
    expect(callHeader(fetchMock.mock.calls[2], 'X-Refresh-Token')).toBe('rt-b')
  })

  it('显式 refreshToken 缺失时直接用登录态内嵌 refresh', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(refreshOk))
    vi.stubGlobal('fetch', fetchMock)
    const ctx = makeCtx({
      refreshToken: null,
      token: JSON.stringify({ accessToken: 'AT', refreshToken: 'RT-emb' }),
    })
    const res = await workbuddyAdapter.refreshToken!(ctx)
    expect(res?.token).toBe('AT-new')
    expect(callHeader(fetchMock.mock.calls[0], 'X-Refresh-Token')).toBe('RT-emb')
  })

  it('显式与内嵌同值 → 凭证去重,只尝试两端点(2 次调用)', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ code: 1, msg: 'x' }, 401))
    vi.stubGlobal('fetch', fetchMock)
    const ctx = makeCtx({
      refreshToken: 'rt-same',
      token: JSON.stringify({ accessToken: 'AT', refreshToken: 'rt-same' }),
    })
    await expect(workbuddyAdapter.refreshToken!(ctx)).rejects.toThrow(/HTTP 401/)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('全部回退失败 → 抛最后一次错误,message 不带任何凭证', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ code: 12153, msg: 'x' }))
    vi.stubGlobal('fetch', fetchMock)
    const ctx = makeCtx({
      refreshToken: 'rt-a',
      token: JSON.stringify({ accessToken: 'AT', refreshToken: 'rt-b' }),
    })
    const err = await workbuddyAdapter.refreshToken!(ctx).catch((e) => e)
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect((err as Error).message).toBe('workbuddy refresh 失败: code=12153')
    expect((err as Error).message).not.toContain('rt-a')
    expect((err as Error).message).not.toContain('rt-b')
  })

  it('两种形态都无刷新凭证 → 直接抛缺少 refreshToken', async () => {
    await expect(
      workbuddyAdapter.refreshToken!(makeCtx({ refreshToken: null, token: 'opaque' })),
    ).rejects.toThrow(/refreshToken/)
  })

  it('REFRESH_ENDPOINT_PATHS 主备顺序锁定', () => {
    expect(REFRESH_ENDPOINT_PATHS).toEqual([
      '/v2/plugin/auth/token/refresh',
      '/v2/auth/token/refresh',
    ])
  })
})

// =============================================================================
// 错误分类矩阵(HTML 登录页 / JSON error 体 / SSE 断流帧)
// =============================================================================

describe('looksLikeHtmlLoginPage', () => {
  it('HTML 骨架 + 登录语义同现才算', () => {
    expect(looksLikeHtmlLoginPage('<html><body>Please Sign In</body></html>')).toBe(true)
    expect(looksLikeHtmlLoginPage('<!DOCTYPE html><html>登录已失效</html>')).toBe(true)
    expect(looksLikeHtmlLoginPage('<html><body>Product marketing page</body></html>')).toBe(false)
    expect(looksLikeHtmlLoginPage('plain text error')).toBe(false)
  })
})

describe('isAuthFailureCore(上游错误形态)', () => {
  it('401/403 → true', () => {
    expect(isAuthFailureCore(401, '')).toBe(true)
    expect(isAuthFailureCore(403, '')).toBe(true)
  })
  it('JSON error 体 unauthorized → true', () => {
    expect(isAuthFailureCore(200, '{"error":{"code":"unauthorized"}}')).toBe(true)
  })
  it('SSE 中途断流帧 token invalid → true', () => {
    expect(isAuthFailureCore(200, 'data: {"error":{"message":"token is invalid"}}')).toBe(true)
  })
  it('HTML 登录墙 → true;12153 / Offline user session → true', () => {
    expect(isAuthFailureCore(200, '<!doctype html><html>请登录</html>')).toBe(true)
    expect(isAuthFailureCore(400, '{"code":12153,"msg":"x"}')).toBe(true)
    expect(isAuthFailureCore(200, 'Offline user session not found')).toBe(true)
  })
  it('普通 5xx / 429 无鉴权语义 → false', () => {
    expect(isAuthFailureCore(500, 'server error')).toBe(false)
    expect(isAuthFailureCore(429, 'Too Many Requests')).toBe(false)
  })
})

describe('workbuddyAdapter.isAuthError(HTTP 状态码还原)', () => {
  const isAuthError = workbuddyAdapter.isAuthError!
  it('message 带 HTTP 401/403 → true(401 自愈依赖)', () => {
    expect(isAuthError(new Error('workbuddy refresh 失败: HTTP 401'))).toBe(true)
    expect(isAuthError(new Error('workbuddy refresh 失败: HTTP 403'))).toBe(true)
  })
  it('HTTP 429/500 或无状态码 → false', () => {
    expect(isAuthError(new Error('workbuddy refresh 失败: HTTP 429'))).toBe(false)
    expect(isAuthError(new Error('workbuddy refresh 失败: HTTP 500'))).toBe(false)
    expect(isAuthError(new Error('network timeout'))).toBe(false)
  })
  it('信封 code 12153 → true(会话死)', () => {
    expect(isAuthError(new Error('workbuddy refresh 失败: code=12153'))).toBe(true)
  })
})

describe('classifyUpstreamFailure 映射表逐条', () => {
  const classify = classifyUpstreamFailure
  it('credit:402 / 积分不足 / Quota exceeded', () => {
    expect(classify(402, '{}')).toBe('credit')
    expect(classify(200, '{"code":1,"msg":"积分不足","data":null}')).toBe('credit')
    expect(classify(200, 'Quota exceeded for this account')).toBe('credit')
  })
  it('session_dead:Offline user session / 12153', () => {
    expect(classify(200, 'Offline user session not found')).toBe('session_dead')
    expect(classify(400, '{"code":12153,"msg":"x"}')).toBe('session_dead')
  })
  it('auth:401/403 / token expired / JSON 体 unauthorized / HTML 登录墙', () => {
    expect(classify(401, '')).toBe('auth')
    expect(classify(403, '')).toBe('auth')
    expect(classify(200, 'the token has expired')).toBe('auth')
    expect(classify(200, '{"error":{"code":"unauthorized"}}')).toBe('auth')
    expect(classify(200, '<!doctype html><html>登录已过期</html>')).toBe('auth')
  })
  it('rate:429 / 限流文案 / code 11140', () => {
    expect(classify(429, '')).toBe('rate')
    expect(classify(200, '请求过于频繁')).toBe('rate')
    expect(
      classify(200, JSON.stringify({ code: 11140, msg: 'The model provider is rate-limiting' })),
    ).toBe('rate')
  })
  it('not_found:404', () => {
    expect(classify(404, '')).toBe('not_found')
  })
  it('request:400+文案 / 业务 code(不罚号)', () => {
    expect(classify(400, 'Unmarshal chat params failed')).toBe('request')
    expect(classify(200, '{"code":11101,"msg":"bad tool_choice"}')).toBe('request')
  })
  it('server/client 兜底', () => {
    expect(classify(500, '')).toBe('server')
    expect(classify(503, '')).toBe('server')
    expect(classify(406, '')).toBe('client')
  })
  it('适配器成员返回 {kind}', () => {
    expect(workbuddyAdapter.classifyUpstreamFailure?.(401, '')).toEqual({ kind: 'auth' })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
