// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { createSign, generateKeyPairSync } from 'node:crypto'

const { safeFetchMock } = vi.hoisted(() => ({ safeFetchMock: vi.fn() }))

vi.mock('../../utils/ssrf-guard.js', () => ({ safeFetch: safeFetchMock }))
vi.mock('../../plugins/business-metrics.js', () => ({ recordOssDownloadBytes: vi.fn() }))
vi.mock('../../plugins/internal-service-token.js', () => ({ secretsEqual: vi.fn(() => false) }))

import { verifyOssCallback } from '../../services/storage-service.js'

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const PEM = publicKey.export({ type: 'spki', format: 'pem' }).toString()

/** 构造一份对 `method\npathAndQuery\nbody` 的合法 RSA-SHA1 签名。 */
function signedParams(pubKeyUrl: string) {
  const method = 'POST'
  const path = '/api/oss/callback'
  const query = ''
  const body = '{}'
  const signedString = `${method}\n${path}${query ? `?${query}` : ''}\n${body}`
  const authorization = createSign('RSA-SHA1').update(signedString).sign(privateKey, 'base64')
  return {
    method,
    path,
    query,
    body,
    authorization,
    pubKeyUrlB64: Buffer.from(pubKeyUrl).toString('base64'),
  }
}

describe('OSS 回调公钥 URL 白名单(F-69)', () => {
  beforeEach(() => {
    safeFetchMock.mockReset()
    safeFetchMock.mockResolvedValue({
      ok: true,
      headers: new Headers(),
      text: async () => PEM,
    })
    // 旧实现直接用全局 fetch;stub 成同样返回合法 PEM,确保"旧写法能验过"这个前提成立。
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, text: async () => PEM })),
    )
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it('合法 https 公钥地址仍能验签通过,且走 safeFetch', async () => {
    const url = 'https://gosspublic.alicdn.com/oss-public-key.pem'
    const ok = await verifyOssCallback(signedParams(url))
    expect(ok).toBe(true)
    expect(safeFetchMock).toHaveBeenCalledTimes(1)
    expect(safeFetchMock.mock.calls[0]?.[0]).toBe(url)
  })

  it('拒绝 http 公钥地址(旧写法会因子串正则放行并验签成功)', async () => {
    const url = 'http://gosspublic.alicdn.com/oss-public-key.pem'
    const ok = await verifyOssCallback(signedParams(url))
    expect(ok).toBe(false)
    expect(safeFetchMock).not.toHaveBeenCalled()
  })

  it('拒绝 127.0.0.1(即使 path 里带 .alicdn.com/)', async () => {
    const url = 'https://127.0.0.1/.alicdn.com/oss-public-key.pem'
    const ok = await verifyOssCallback(signedParams(url))
    expect(ok).toBe(false)
    expect(safeFetchMock).not.toHaveBeenCalled()
  })

  it('拒绝把 .alicdn.com/ 放进 path 的伪装 URL', async () => {
    const url = 'https://evil.example/.alicdn.com/oss-public-key.pem'
    const ok = await verifyOssCallback(signedParams(url))
    expect(ok).toBe(false)
    expect(safeFetchMock).not.toHaveBeenCalled()
  })

  it('拒绝把 .alicdn.com/ 放进 query 的伪装 URL', async () => {
    const url = 'https://evil.example/key.pem?next=.alicdn.com/'
    const ok = await verifyOssCallback(signedParams(url))
    expect(ok).toBe(false)
    expect(safeFetchMock).not.toHaveBeenCalled()
  })

  it('拒绝主机名标签边界外的伪装域名(alicdn.com.evil.example)', async () => {
    const url = 'https://alicdn.com.evil.example/key.pem'
    const ok = await verifyOssCallback(signedParams(url))
    expect(ok).toBe(false)
    expect(safeFetchMock).not.toHaveBeenCalled()
  })
})
