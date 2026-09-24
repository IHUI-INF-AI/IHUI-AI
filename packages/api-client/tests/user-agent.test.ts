// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, afterEach } from 'vitest'

import { setUserAgent, getUserAgent, fetchApi } from '../src/client.js'
import { setTransport, type Transport } from '../src/transport.js'

/**
 * 首方 User-Agent 注入(2026-09-24 立)。
 *
 * 起因是实测事故:RN 的 fetch 由 okhttp 实现、CLI 由 undici 实现,而后端
 * `apps/api/src/utils/bot-detection.ts` 的 CURL_LIKE_KEYWORDS 含 'okhttp' /
 * 'node-fetch'。api-client 从不设 User-Agent ⇒ 自家 App 的**每个**请求都被判为
 * 爬虫:越过挑战阈值后 429 带 `X-Challenge-Type: bot` 并要求一个客户端根本无法
 * 完成的 CAPTCHA,同时每请求 `recordBadEvent(ip,'automation-ua')` 拉低出口 IP 信誉。
 *
 * 本文件只验"头有没有正确落到线上";"这个 UA 不会被判成爬虫"那条断言放在
 * apps/api 侧(关键字表的真相源所在处),避免在此复制一份词表。
 */

async function captureHeaders(init: { headers?: Record<string, string> } = {}) {
  const transport = vi.fn(async () => ({
    ok: true,
    status: 200,
    headers: { get: () => null },
    text: async () => '',
    json: async () => ({ code: 0, message: 'success', data: {} }),
  }))
  setTransport(transport as unknown as Transport)
  await fetchApi<Record<string, never>>('/api/ua-probe', init)
  const [, sent] = transport.mock.calls[0] as [string, { headers?: Record<string, string> }]
  return sent.headers ?? {}
}

describe('setUserAgent 出站头注入', () => {
  afterEach(() => {
    setUserAgent('')
    // 恢复默认 transport,避免污染其他用例
    setTransport(undefined as unknown as Transport)
  })

  it('设了 UA → 请求头带 User-Agent', async () => {
    setUserAgent('IHUIAI-App/0.0.5 (android/34)')
    const headers = await captureHeaders({})
    expect(headers['User-Agent']).toBe('IHUIAI-App/0.0.5 (android/34)')
  })

  it('未设 UA(默认空串)→ 完全不出现 User-Agent 键,浏览器端零影响', async () => {
    setUserAgent('')
    expect(getUserAgent()).toBe('')
    const headers = await captureHeaders({})
    expect('User-Agent' in headers).toBe(false)
  })

  it('调用方自带 User-Agent 时不被覆盖', async () => {
    setUserAgent('IHUIAI-App/0.0.5 (android/34)')
    const headers = await captureHeaders({ headers: { 'User-Agent': 'custom/1' } })
    expect(headers['User-Agent']).toBe('custom/1')
  })

  it('setter 两端去空白,空串等价于关闭', async () => {
    setUserAgent('   ')
    expect(getUserAgent()).toBe('')
    const headers = await captureHeaders({})
    expect('User-Agent' in headers).toBe(false)
  })

  it('X-Requested-With 仍然在位(本次改动不得动掉 CSRF 头)', async () => {
    setUserAgent('IHUIAI-App/0.0.5 (android/34)')
    const headers = await captureHeaders({})
    expect(headers['X-Requested-With']).toBe('XMLHttpRequest')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
