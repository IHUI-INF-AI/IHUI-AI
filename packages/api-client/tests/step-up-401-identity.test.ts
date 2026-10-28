// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 2FA step-up 拒绝的 401 分型(2026-10-29 立)。
 *
 * 病灶(现读代码核对):服务端对敏感操作(提现 / 签发 Key / 创建分享等)在账号开了 2FA
 * 且窗内无二次验证时回 **HTTP 401 + errorCode=STEP_UP_REQUIRED**。共享传输层的通用 401
 * 出口把它当成"凭据失效":先触发一次无谓的 token 续期,续期成功再打一发仍是 401,
 * 最后走 notifyUnauthorized —— 给一个已登录的人弹「登录已过期」。真用户看到的后果是
 * "我点了提现,系统说我登录过期",而他实际只需要输一次验证码。
 *
 * 本文件钉住成对语义(两条都必须实跑):
 *   ① step-up 型 401 ⇒ 不续期、不通知登出、status 被剥掉、errorCode 原样交给调用方;
 *   ② 普通会话过期 401 ⇒ 行为逐字不变(不为修①把②改坏)。
 *
 * 与 G-1121553(验证码型 401)同一处置模式,判据各自独立 —— 两型都不得靠"端点在 /auth/ 下"识别。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import {
  __resetRefreshStateForTest,
  fetchApi,
  formatSSEError,
  isStepUpRejection,
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

/** 生产实测形态:路由用 error(401, msg, code) ⇒ 包里是 errorCode 字段 */
const STEP_UP_401_BODY = {
  code: 401,
  errorCode: 'STEP_UP_REQUIRED',
  message: '提现需要二次验证：请先调用 POST /auth/2fa/step-up 提交当前验证码',
}
const ACCOUNT_UNJUDGED_401_BODY = {
  code: 401,
  errorCode: 'ACCOUNT_UNJUDGED',
  message: '暂时无法确认该账号的两步验证状态，请稍后重试',
}
/** 对照面:普通会话过期(既有行为一个字都不许动) */
const SESSION_EXPIRED_401_BODY = { code: 401, message: 'Invalid or expired token' }

describe('step-up 型 401:不是凭据失效', () => {
  let refreshCalls = 0
  const contexts: UnauthorizedContext[] = []

  beforeEach(() => {
    refreshCalls = 0
    contexts.length = 0
    setTokenProvider({
      getToken: () => 'alive-token',
      refreshAccessToken: async () => {
        refreshCalls += 1
        return null
      },
    })
    setUnauthorizedHandler((ctx) => {
      contexts.push(ctx)
    })
  })

  afterEach(() => {
    setTransport(undefined as unknown as Transport)
    setTokenProvider({ getToken: () => null })
    setUnauthorizedHandler(null)
    setCircuitBreaker(null)
    __resetRefreshStateForTest()
  })

  it('敏感端点:不触发续期、不弹登录框、status 被剥掉、errorCode 原样返回', async () => {
    setTransport(always(401, STEP_UP_401_BODY))

    const res = await fetchApi('/api/finance/agent-withdrawal/apply', {
      method: 'POST',
      body: JSON.stringify({ amount: 10 }),
    })

    expect(res.success).toBe(false)
    if (res.success) throw new Error('unreachable')
    // 三件都不能发生:续期一次都不该发、登出不该通知、status 不该被判成 401
    expect(refreshCalls).toBe(0)
    expect(contexts).toHaveLength(0)
    expect(res.status).toBeUndefined()
    // errorCode 必须原样交给调用方(前端据此拉二次验证面板)
    expect(res.errorCode).toBe('STEP_UP_REQUIRED')
    expect(res.error).toContain('二次验证')
  })

  it('账号 2FA 状态判不出(ACCOUNT_UNJUDGED):同样不登出、不续期', async () => {
    setTransport(always(401, ACCOUNT_UNJUDGED_401_BODY))

    const res = await fetchApi('/api/developer/api-keys', { method: 'POST', body: '{}' })

    expect(res.success).toBe(false)
    if (res.success) throw new Error('unreachable')
    expect(refreshCalls).toBe(0)
    expect(contexts).toHaveLength(0)
    expect(res.errorCode).toBe('ACCOUNT_UNJUDGED')
    expect(res.status).toBeUndefined()
  })

  it('错误对象:severity 不取 auth、requireReauth=false(重登救不了"缺一次验证")', () => {
    const f = formatSSEError({ code: 401, ...STEP_UP_401_BODY })

    expect(f.severity).not.toBe('auth')
    expect(f.requireReauth).toBe(false)
    expect(f.title).toBe('需要二次验证')
    expect(f.rawMessage).toContain('二次验证')
  })

  it('变异自证:普通会话过期仍走原出口(status 401 / severity=auth / 续期链照旧)', async () => {
    setTransport(always(401, SESSION_EXPIRED_401_BODY))

    const res = await fetchApi('/api/user/me', { method: 'GET' })

    expect(res.success).toBe(false)
    if (res.success) throw new Error('unreachable')
    // 这一格钉住"判据是分型的"而不是"401 一律放过"
    expect(res.status).toBe(401)
    expect(res.errorCode).toBeUndefined()

    const f = formatSSEError({ code: 401, message: 'Invalid or expired token' })
    expect(f.severity).toBe('auth')
    expect(f.requireReauth).toBe(true)
    expect(f.title).toBe('登录已过期')
  })

  it('判据本身:只认这两个 errorCode,其余一律不算 step-up', () => {
    expect(isStepUpRejection('STEP_UP_REQUIRED')).toBe(true)
    expect(isStepUpRejection('ACCOUNT_UNJUDGED')).toBe(true)
    expect(isStepUpRejection('UNAUTHORIZED')).toBe(false)
    expect(isStepUpRejection('SMS_CODE_INVALID')).toBe(false)
    expect(isStepUpRejection(undefined)).toBe(false)
    // 反向:文案里出现"二次验证"不构成判据(判据是 errorCode,不是中文)
    expect(isStepUpRejection('')).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
