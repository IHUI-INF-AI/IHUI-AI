// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, afterEach } from 'vitest'

import { fetchRaw, fetchText } from '../src/client.js'
import { setTransport, type Transport } from '../src/transport.js'

/**
 * HTTP 失败必须携带 status / errorCode 元信息(2026-09-24 立)。
 *
 * 原实现只 `throw new Error("<status>: <raw body>")`。调用方把 e.message 交给
 * `toUserFriendlyMessage` 时,该函数取不到 status/errorCode,会退到"原样返回正文"
 * 那一步 —— nginx 429 的整页 HTML 有机会直接出现在用户 toast 里(实测 TTS 路径)。
 *
 * 这里只验"元信息挂上了、message 形态没变"(向后兼容);
 * "挂上之后文案确实不再泄漏正文"由 apps/mobile-rn 侧的用例覆盖
 * —— `toUserFriendlyMessage` 在 @ihui/shared,而本包只依赖 @ihui/types,不得反向依赖。
 */

function failingTransport(status: number, body: string) {
  return vi.fn(async () => ({
    ok: false,
    status,
    headers: { get: () => null },
    text: async () => body,
    json: async () => {
      throw new Error('not json')
    },
    blob: async () => new Blob([body]),
  }))
}

async function rejection(fn: () => Promise<unknown>): Promise<Error> {
  try {
    await fn()
  } catch (e) {
    return e as Error
  }
  throw new Error('预期 reject,实际 resolve')
}

describe('fetchRaw / fetchText 的 HTTP 失败携带元信息', () => {
  afterEach(() => {
    setTransport(undefined as unknown as Transport)
  })

  it('fetchRaw 非 2xx → Error.status = HTTP 状态码', async () => {
    setTransport(failingTransport(429, '<html><body>Too Many Requests</body></html>') as unknown as Transport)
    const err = await rejection(() => fetchRaw('https://example.test/api/tts'))
    expect((err as Error & { status?: number }).status).toBe(429)
  })

  it('fetchText 非 2xx → 同样带 status', async () => {
    setTransport(failingTransport(503, 'upstream unavailable') as unknown as Transport)
    const err = await rejection(() => fetchText('https://example.test/api/export'))
    expect((err as Error & { status?: number }).status).toBe(503)
  })

  it('正文是 JSON 时提取 errorCode(code / error_code / errorCode 三种拼法)', async () => {
    for (const [key, body] of [
      ['code', '{"code":"BUDGET_EXHAUSTED","message":"额度用尽"}'],
      ['error_code', '{"error_code":"RATE_LIMITED"}'],
      ['errorCode', '{"errorCode":"UNAUTHORIZED"}'],
    ] as const) {
      setTransport(failingTransport(429, body) as unknown as Transport)
      const err = await rejection(() => fetchText(`https://example.test/api/x?k=${key}`))
      expect((err as Error & { errorCode?: string }).errorCode, `key=${key}`).toBe(
        key === 'code' ? 'BUDGET_EXHAUSTED' : key === 'error_code' ? 'RATE_LIMITED' : 'UNAUTHORIZED',
      )
    }
  })

  it('正文不是 JSON → 不炸,只有 status(典型 nginx 错误页)', async () => {
    setTransport(failingTransport(429, '<html>rate limited</html>') as unknown as Transport)
    const err = await rejection(() => fetchText('https://example.test/api/y'))
    const meta = err as Error & { status?: number; errorCode?: string }
    expect(meta.status).toBe(429)
    expect(meta.errorCode).toBeUndefined()
  })

  it('向后兼容:message 仍是 "<status>: <body>" 形态,不破坏按字符串解析的旧调用方', async () => {
    setTransport(failingTransport(404, 'not found') as unknown as Transport)
    const err = await rejection(() => fetchText('https://example.test/api/z'))
    expect(err.message).toBe('404: not found')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
