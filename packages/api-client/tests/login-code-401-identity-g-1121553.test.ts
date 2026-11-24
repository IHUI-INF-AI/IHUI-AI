// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 登录 / 换验证码端点 401 的独立分型(台账票 G-1121553)。
 *
 * 背景(真机实录,2026-10-13):`POST /api/auth/login/sms` 在验证码错 / 过期时同样回
 * HTTP 401(实测 `{"code":401,"message":"验证码错误或已过期"}`),而通用 401 出口把它
 * 上屏成「登录已过期,请重新登录」—— 复验时连按"会话被踢 / 服务端限流"方向查了三轮
 * (还为此重启 App、清 token)才定位到"码打错了"。
 *
 * 本文件钉住成对语义(两条都必须实跑):
 *   ① 验证码型 401 ⇒ 页面身份与错误对象都点名「验证码」,不得出现「登录已过期」;
 *   ② 普通会话过期 401 ⇒ 文案**逐字不变**(不为消①把②改坏)。
 *
 * "页面文案"的判据来源:登录页(mobile-rn LoginScreen 六站)把 ApiResult 失败分支整份
 * 交给共享层 `apiFailureToText`,其判序是 errorCode → status → message(中文原话直接上屏)。
 * 本文件在测试侧**复刻**这条判序(见 `pageText`),断言的是"喂给它的错误身份是哪一型";
 * 生产判序的真相在 @ihui/shared/utils,本包不得养第二份生产实现 —— 复刻只活在测试里。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import {
  __resetRefreshStateForTest,
  fetchApi,
  formatSSEError,
  isVerificationCodeFailure,
  setCircuitBreaker,
  setTokenProvider,
  setUnauthorizedHandler,
  type UnauthorizedContext,
} from '../src/client.js'
import { setTransport, type Transport, type TransportResponse } from '../src/transport.js'

function jsonResponse(status: number, body: unknown): TransportResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    text: async () => JSON.stringify(body),
    json: async () => body,
  } as unknown as TransportResponse
}

function always(status: number, body: unknown): Transport {
  return (async () => jsonResponse(status, body)) as unknown as Transport
}

/** 生产实测响应体:验证码错 / 过期时的 401(票面引用的原话) */
const VERIFY_CODE_401_BODY = { code: 401, message: '验证码错误或已过期' }
/** 普通会话过期的 401(对照面:既有文案一个字都不许动) */
const SESSION_EXPIRED_401_BODY = { code: 401, message: 'Invalid or expired token' }

/**
 * 镜像共享层 `apiFailureToText` 的判序(errorCode → status → message 原样上屏)。
 * 只在测试里复刻,不进生产代码 —— 生产真相在 @ihui/shared/utils。
 */
function pageText(res: { error?: string; status?: number; errorCode?: string }): string {
  const ERROR_CODE_TO_ZH: Record<string, string> = { UNAUTHORIZED: '登录已过期,请重新登录' }
  const STATUS_TO_ZH: Record<number, string> = { 401: '登录已过期,请重新登录' }
  if (res.errorCode && ERROR_CODE_TO_ZH[res.errorCode]) return ERROR_CODE_TO_ZH[res.errorCode]!
  if (res.status && STATUS_TO_ZH[res.status]) return STATUS_TO_ZH[res.status]!
  return res.error ?? '操作失败,请稍后重试'
}

describe('G-1121553 ①:验证码型 401 不得被通用会话过期出口吞掉', () => {
  beforeEach(() => {
    setTokenProvider({ getToken: () => null })
  })

  afterEach(() => {
    setTransport(undefined as unknown as Transport)
    setTokenProvider({ getToken: () => null })
    setUnauthorizedHandler(null)
    setCircuitBreaker(null)
    __resetRefreshStateForTest()
  })

  it('登录站 fetchApi:实测响应体 ⇒ 上屏身份点名「验证码」,且不含「登录已过期」', async () => {
    setTransport(always(401, VERIFY_CODE_401_BODY))

    const res = await fetchApi('/api/auth/login/sms', {
      method: 'POST',
      body: JSON.stringify({ phone: '13800000000', code: '000000' }),
    })

    expect(res.success).toBe(false)
    if (res.success) throw new Error('unreachable')
    // 服务端点名原话保留为 error(共享层 message 档据此上屏)
    expect(res.error).toBe('验证码错误或已过期')
    const text = pageText(res)
    expect(text).toContain('验证码')
    expect(text).not.toContain('登录已过期')
  })

  it('换验证码站(验旧码,不在 AUTH_ENDPOINT_RE 覆盖面):同样分型,且不触发端内登出通知', async () => {
    const contexts: UnauthorizedContext[] = []
    setTransport(always(401, VERIFY_CODE_401_BODY))
    setTokenProvider({ getToken: () => 'alive-token', refreshAccessToken: async () => null })
    setUnauthorizedHandler((ctx) => {
      contexts.push(ctx)
    })

    const res = await fetchApi('/api/auth/change-phone/verify-old-code', {
      method: 'POST',
      body: JSON.stringify({ code: '123456' }),
    })

    expect(res.success).toBe(false)
    if (res.success) throw new Error('unreachable')
    // 打错验证码不是会话死亡:不得进续期 / notifyUnauthorized 链(真机"会话被踢"方向的误报口)
    expect(contexts).toHaveLength(0)
    expect(res.status).toBeUndefined()
    expect(pageText(res)).toContain('验证码')
    expect(pageText(res)).not.toContain('登录已过期')
  })

  it('错误对象 formatSSEError:message 前缀点名验证码 ⇒ 点名上屏,requireReauth=false', () => {
    const f = formatSSEError({ code: 401, message: '验证码错误或已过期' })

    expect(f.title).toContain('验证码')
    expect(f.message).toContain('验证码')
    expect(f.message).not.toContain('登录已过期')
    expect(f.requireReauth).toBe(false)
    // severity 不取 'auth':消费方按 auth 档开重新登录,在登录页上弹登录框是二重误导
    expect(f.severity).not.toBe('auth')
    expect(f.rawMessage).toBe('验证码错误或已过期')
  })

  it('错误对象:errorCode 点名验证码(后端不发文案前缀时的第二判据)', () => {
    const err = new Error('verification failed') as Error & { code: number; errorCode: string }
    err.code = 401
    err.errorCode = 'SMS_CODE_EXPIRED'

    const f = formatSSEError(err)

    expect(f.errorCode).toBe('SMS_CODE_EXPIRED')
    expect(f.title).toContain('验证码')
    expect(f.message).toContain('验证码')
    expect(f.message).not.toContain('登录已过期')
  })

  it('判据反向对照:会话过期句式哪怕文末带"验证码"也不误吞(判据是前缀 + errorCode,不是包含)', () => {
    expect(isVerificationCodeFailure(undefined, '验证码错误或已过期')).toBe(true)
    expect(isVerificationCodeFailure('SMS_CODE_INVALID', undefined)).toBe(true)
    expect(isVerificationCodeFailure(undefined, '登录已过期,请重新登录')).toBe(false)
    expect(isVerificationCodeFailure(undefined, '会话已过期,请重新获取验证码')).toBe(false)
    expect(isVerificationCodeFailure('UNAUTHORIZED', undefined)).toBe(false)
  })
})

describe('G-1121553 ②:普通会话过期 401 的文案逐字不变', () => {
  beforeEach(() => {
    setTokenProvider({ getToken: () => null })
  })

  afterEach(() => {
    setTransport(undefined as unknown as Transport)
    setTokenProvider({ getToken: () => null })
    setUnauthorizedHandler(null)
    setCircuitBreaker(null)
    __resetRefreshStateForTest()
  })

  it('普通端点 fetchApi:status 401 原样保留,页面身份仍是「登录已过期,请重新登录」', async () => {
    setTransport(always(401, SESSION_EXPIRED_401_BODY))

    const res = await fetchApi('/api/user/me', { method: 'GET' })

    expect(res).toEqual({
      success: false,
      error: 'Invalid or expired token',
      status: 401,
      errorCode: undefined,
      retryAfter: undefined,
    })
    expect(pageText(res)).toBe('登录已过期,请重新登录')
  })

  it('错误对象:severity auth / requireReauth true / title+message 逐字不变', () => {
    const f = formatSSEError({ code: 401, message: 'Invalid or expired token' })

    expect(f.severity).toBe('auth')
    expect(f.requireReauth).toBe(true)
    expect(f.title).toBe('登录已过期')
    expect(f.message).toBe('登录已过期,请重新登录')
    expect(f.rawMessage).toBe('Invalid or expired token')
  })

  it('认证端点的会话型 401 同样保留 status:401(分型只吃验证码,不吃"端点在 /auth/ 下"这件事)', async () => {
    setTransport(always(401, { code: 401, message: '登录已过期' }))

    const res = await fetchApi('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ account: 'x', password: 'y' }),
    })

    expect(res.success).toBe(false)
    if (res.success) throw new Error('unreachable')
    expect(res.status).toBe(401)
    expect(res.error).toBe('登录已过期')
  })
})
