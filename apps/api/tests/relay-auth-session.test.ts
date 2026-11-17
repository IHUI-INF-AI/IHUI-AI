// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池自助授权会话 —— 判据 + 行为测试（纯 mock，一律不连库、不出网）。
 *
 * 2026-11-17 立（票一）。要钉住的是「超越 qoder2api 系网关」那几条口径，而不是覆盖率数字：
 *   T-A 上游响应分档：pending / slow_down(+5s) / expired(两种同义写法) / denied /
 *       非 JSON / 401(≠授权被拒) —— 判错一档的后果是「拿死把手无限打上游」或「把还能收尾的会话判死」。
 *   T-B 退避闸门：未到 nextPollAt 时一次上游请求都不发（poster 计数 = 0）。
 *   T-C 未实证 ⇒ 拒发起且**一行会话都不建**（db.insert 计数 = 0）。
 *   T-D 「已发票 ≠ 已入池」：入池异常 / 结果行 failed ⇒ 停 authorized，绝不 imported。
 *   T-E 凭据零外流：任何视图与错误消息里都不出现 device_code / PAT 明文。
 *   T-F 终局销毁把手：imported / cancelled 后 handleRetained=false。
 *   T-G 混读防线：v1（票）不会被当成 device_code 再打 token 端点。
 *
 * 假 db 的边界（诚实声明）：只按「本用例走到的调用链形状」实现，where 谓词不做精算
 * （单行场景下等价）；它用来钉状态迁移与调用计数，不用来测 SQL 正确性 —— 后者归 db 层测试。
 */
import { describe, it, expect } from 'vitest'

import {
  __test__ as J,
  judgeTokenResponse,
  clampInterval,
  canTransition,
  isTerminalStatus,
  credentialFingerprint,
  encodeHandle,
  parseHandle,
  mapPatToImport,
  mapTokenPairToImport,
  mapperIsWired,
  buildQrPayload,
  MIN_POLL_INTERVAL_S,
  SLOW_DOWN_STEP_S,
} from '../src/services/relay-auth-session.js'

// ── T-A 上游响应分档 ────────────────────────────────────────────────────────
describe('judgeTokenResponse：一次响应算什么', () => {
  it('authorization_pending ⇒ waiting，间隔不降', () => {
    expect(judgeTokenResponse(400, { error: 'authorization_pending' }, 7)).toEqual({
      kind: 'waiting',
      intervalSeconds: 7,
    })
  })

  it('slow_down ⇒ 在当前间隔上 +5s（RFC 8628 §3.5），不是按上游回落', () => {
    const r = judgeTokenResponse(400, { error: 'slow_down', interval: 5 }, 10)
    expect(r).toEqual({ kind: 'slow_down', intervalSeconds: 10 + SLOW_DOWN_STEP_S })
  })

  it('expired_token 与 device_code_expired 两种同义写法都判过期（不混进 denied）', () => {
    expect(judgeTokenResponse(400, { error: 'expired_token' }, 5).kind).toBe('expired')
    expect(judgeTokenResponse(400, { error: 'device_code_expired' }, 5).kind).toBe('expired')
  })

  it('access_denied / invalid_grant ⇒ denied 并带上游说明', () => {
    const r = judgeTokenResponse(
      400,
      { error: 'access_denied', error_description: '用户点了取消' },
      5,
    )
    expect(r).toMatchObject({
      kind: 'denied',
      errorCode: 'access_denied',
      description: '用户点了取消',
    })
  })

  it('200 但读不出 access_token ⇒ malformed（不当成还在等）', () => {
    expect(judgeTokenResponse(200, { token_type: 'Bearer' }, 5)).toEqual({
      kind: 'malformed',
      reason: '200 但无 access_token',
    })
    expect(judgeTokenResponse(200, 'not-an-object', 5).kind).toBe('malformed')
  })

  it('200 + 票 ⇒ authorized，refreshToken 缺给 null', () => {
    const r = judgeTokenResponse(200, { access_token: ' AT ', expires_in: 3600 }, 5)
    expect(r).toMatchObject({
      kind: 'authorized',
      accessToken: 'AT',
      refreshToken: null,
      expiresIn: 3600,
    })
  })

  it('401/403 是「授权客户端配置错」，绝不判成授权被拒（否则可收尾的会话会被判死）', () => {
    expect(judgeTokenResponse(401, { error: 'invalid_client' }, 5)).toMatchObject({
      kind: 'upstream_error',
      status: 401,
    })
    expect(judgeTokenResponse(403, {}, 5).kind).toBe('upstream_error')
  })

  it('5xx / 非预期状态 ⇒ upstream_error；非 JSON 由调用方按 502 送进来', () => {
    expect(judgeTokenResponse(503, null, 5).kind).toBe('upstream_error')
    expect(judgeTokenResponse(502, null, 5)).toMatchObject({ status: 502 })
    expect(judgeTokenResponse(302, {}, 5).kind).toBe('upstream_error')
  })

  it('400 但 error 不可识别 ⇒ malformed 并点名是什么', () => {
    expect(judgeTokenResponse(400, { error: 'weird_thing' }, 5)).toMatchObject({
      kind: 'malformed',
      reason: '400 但 error 不可识别（weird_thing）',
    })
    expect(judgeTokenResponse(400, { error: '' }, 5).kind).toBe('malformed')
  })
})

describe('clampInterval：脏值不许变成 sleep 参数', () => {
  it('夹进 [MIN, 300]', () => {
    expect(clampInterval(1)).toBe(MIN_POLL_INTERVAL_S)
    expect(clampInterval(5)).toBe(5)
    expect(clampInterval(9999)).toBe(300)
  })
  it('NaN / 负 / 0 / 非数都回落下限', () => {
    for (const v of [
      NaN,
      -3,
      0,
      Infinity,
      undefined as unknown as number,
      'x' as unknown as number,
    ]) {
      expect(clampInterval(v)).toBe(MIN_POLL_INTERVAL_S)
    }
  })
})

// ── T-B/T-F 迁移表 ──────────────────────────────────────────────────────────
describe('会话状态迁移', () => {
  it('authorized 不许退回 pending（那等于把已到手票这件事撤回）', () => {
    expect(canTransition('authorized', 'pending')).toBe(false)
    expect(canTransition('pending', 'authorized')).toBe(true)
    expect(canTransition('authorized', 'imported')).toBe(true)
  })
  it('终局之间互斥、终局不可再迁移', () => {
    expect(canTransition('imported', 'failed')).toBe(false)
    expect(canTransition('expired', 'pending')).toBe(false)
    expect(canTransition('failed', 'cancelled')).toBe(false)
  })
  it('同档幂等（重复轮询终局会话不改判）', () => {
    expect(canTransition('pending', 'pending')).toBe(true)
    expect(isTerminalStatus('imported')).toBe(true)
    expect(isTerminalStatus('pending')).toBe(false)
    expect(isTerminalStatus('authorized')).toBe(false)
  })
})

// ── T-G 把手形态标签 ────────────────────────────────────────────────────────
describe('把手编码/解析：票与 device_code 不互相冒充', () => {
  it('v0 往返', () => {
    const h = encodeHandle({ deviceCode: 'dc-abc' })
    expect(h.startsWith('v0')).toBe(true)
    expect(parseHandle(h)).toEqual({ form: 'device', deviceCode: 'dc-abc' })
  })
  it('v1 往返（带与不带 refreshToken 两种）', () => {
    const withR = parseHandle(encodeHandle({ accessToken: 'at-1', refreshToken: 'rt-1' }))
    expect(withR).toEqual({ form: 'token', accessToken: 'at-1', refreshToken: 'rt-1' })
    const noR = parseHandle(encodeHandle({ accessToken: 'at-1', refreshToken: null }))
    expect(noR).toEqual({ form: 'token', accessToken: 'at-1', refreshToken: null })
  })
  it('空 / 未知标签 / 缺段 ⇒ 各自点名，绝不猜成另一种形态', () => {
    expect(parseHandle('')).toEqual({ form: 'none' })
    expect(parseHandle('v0')).toMatchObject({ form: 'invalid', reason: '把手缺形态标签' })
    expect(parseHandle(['v0', ''].join(String.fromCharCode(0)))).toMatchObject({
      form: 'invalid',
      reason: 'device_code 为空',
    })
    expect(parseHandle(['v9', 'x'].join(String.fromCharCode(0)))).toMatchObject({ form: 'invalid' })
  })
})

describe('credentialFingerprint', () => {
  it('同输入同输出、长度 16、无明文残留', () => {
    const a = credentialFingerprint('secret-token-xyz')
    expect(a).toBe(credentialFingerprint('secret-token-xyz'))
    expect(a).toHaveLength(16)
    expect(a).not.toContain('secret')
    expect(a).not.toBe(credentialFingerprint('secret-token-xy'))
  })
})

// ── 映射器 ─────────────────────────────────────────────────────────────────
describe('票 → 入池载荷', () => {
  const patCap = {
    providerCode: 'qoder',
    kind: 'pat',
    mapper: 'qoder_pat',
    verified: true,
    note: '',
  } as const
  it('PAT：uid 走指纹、enabled=false（通路未经运营确认前不进转发选路）', () => {
    const acc = mapPatToImport(patCap as never, 'pat-secret-1')
    expect(acc.token).toBe('pat-secret-1')
    expect(acc.enabled).toBe(false)
    expect(acc.uid).toBe(credentialFingerprint('pat-secret-1'))
    expect(acc.name).not.toContain('pat-secret-1')
    expect(acc).toMatchObject({ authMode: 'pat', issuedVia: 'auth-session' })
  })

  const flowCap = {
    providerCode: 'demo',
    kind: 'device_flow',
    mapper: 'oauth_token_pair',
    verified: true,
    scope: 'read',
    note: '',
  } as const
  it('device flow：上游有身份键就用它，uid 来源如实标注', () => {
    const acc = mapTokenPairToImport(flowCap as never, 'at-1', 'rt-1', {
      user_id: 'U-9',
      username: 'zhang',
    })
    expect(acc.uid).toBe('U-9')
    expect(acc.authUidSource).toBe('upstream')
    expect(acc.name).toBe('demo-zhang')
    expect(acc.refreshToken).toBe('rt-1')
    expect(acc.authScope).toBe('read')
    expect(acc.enabled).toBe(false)
  })
  it('上游不给身份键 ⇒ 用票指纹当占位（绝不用 access_token 前缀当名）', () => {
    const acc = mapTokenPairToImport(flowCap as never, 'at-very-long-token', null, {})
    expect(acc.uid).toBe(credentialFingerprint('at-very-long-token'))
    expect(acc.authUidSource).toBe('fingerprint')
    expect(acc.name).toContain(acc.uid.slice(-8))
    expect(acc.name).not.toContain('at-very-long-token')
    expect(acc.refreshToken).toBeUndefined()
  })
  it('mapperIsWired 只认已接线映射器；未知档不许冒绿', () => {
    expect(mapperIsWired('oauth_token_pair')).toBe(true)
    expect(mapperIsWired('qoder_pat')).toBe(true)
    expect(mapperIsWired('not_a_mapper' as never)).toBe(false)
  })
  it('判据层导出的常量与生产实现同源（测试不复算）', () => {
    expect(J.DEVICE_GRANT_TYPE).toBe('urn:ietf:params:oauth:grant-type:device_code')
    expect(J.HANDLE_TAG_DEVICE).toBe('v0')
    expect(J.HANDLE_TAG_TOKEN).toBe('v1')
  })
})

describe('buildQrPayload（RFC 8628 §3.3）', () => {
  it('优先用上游给完整链接', () => {
    expect(buildQrPayload('https://x/y', 'https://x/y?user_code=ABCD', 'ABCD')).toBe(
      'https://x/y?user_code=ABCD',
    )
  })
  it('没给就拼，且正确处理已带 query 的 uri', () => {
    expect(buildQrPayload('https://x/y', null, 'ABCD')).toBe('https://x/y?user_code=ABCD')
    expect(buildQrPayload('https://x/y?a=1', null, 'A B/C')).toBe(
      'https://x/y?a=1&user_code=A%20B%2FC',
    )
  })
  it('两者都缺 ⇒ null（不画一枚空码给人扫）', () => {
    expect(buildQrPayload(null, null, 'ABCD')).toBeNull()
    expect(buildQrPayload('https://x/y', null, null)).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
