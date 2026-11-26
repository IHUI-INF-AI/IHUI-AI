// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * L15 验收面:回环放行、非回环三条件逐条拒、明文 Basic 禁组合不可豁免、
 * production 抛错 vs 非 production 只告警。
 */

import { describe, expect, it } from 'vitest'

import {
  ListenSurfaceViolation,
  assessListenSurface,
  assertListenSurface,
  isLoopbackHost,
} from '../src/config/listen-surface-policy.js'

describe('L15 监听面组合策略', () => {
  it('缺省与回环族放行', () => {
    expect(assessListenSurface({}).ok).toBe(true)
    for (const host of ['127.0.0.1', '::1', 'localhost', '[::1]', ' LocalHost ']) {
      expect(isLoopbackHost(host)).toBe(true)
      expect(assessListenSurface({ HOST: host }).ok).toBe(true)
    }
  })

  it('非回环未 opt-in ⇒ 拒,码为 requires-opt-in', () => {
    const d = assessListenSurface({ HOST: '0.0.0.0' })
    expect(d.ok).toBe(false)
    expect(d.code).toBe('non-loopback-requires-opt-in')
  })

  it('opt-in 但无 TLS/套接字 ⇒ 拒,码为 requires-tls-or-socket', () => {
    const d = assessListenSurface({ HOST: '0.0.0.0', IHUI_ALLOW_NON_LOOPBACK: '1' })
    expect(d.ok).toBe(false)
    expect(d.code).toBe('non-loopback-requires-tls-or-socket')
  })

  it('明文 Basic + 全网卡 ⇒ 禁组合,opt-in/TLS 都不豁免', () => {
    const d = assessListenSurface({
      HOST: '0.0.0.0',
      IHUI_ALLOW_NON_LOOPBACK: '1',
      IHUI_TLS_CERT_PATH: 'C:/certs/a.pem',
      IHUI_TLS_KEY_PATH: 'C:/certs/a.key',
      IHUI_BASIC_AUTH: '1',
    })
    expect(d.ok).toBe(false)
    expect(d.code).toBe('plaintext-basic-auth-on-public-bind')
  })

  it('opt-in + TLS 对 ⇒ 放行;套接字形态同样放行(TLS 非必需)', () => {
    expect(
      assessListenSurface({
        HOST: '0.0.0.0',
        IHUI_ALLOW_NON_LOOPBACK: 'true',
        IHUI_TLS_CERT_PATH: 'C:/certs/a.pem',
        IHUI_TLS_KEY_PATH: 'C:/certs/a.key',
      }).ok,
    ).toBe(true)
    expect(
      assessListenSurface({
        HOST: '0.0.0.0',
        IHUI_ALLOW_NON_LOOPBACK: '1',
        IHUI_LISTEN_SOCKET: '1',
      }).ok,
    ).toBe(true)
  })

  it('production 抛 ListenSurfaceViolation;development 只回决策', () => {
    const env = { HOST: '0.0.0.0' }
    expect(() => assertListenSurface(env, { isProduction: true })).toThrow(ListenSurfaceViolation)
    const dev = assertListenSurface(env, { isProduction: false })
    expect(dev?.code).toBe('non-loopback-requires-opt-in')
    expect(assertListenSurface({}, { isProduction: true })).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
