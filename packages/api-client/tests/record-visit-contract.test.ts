// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, afterEach } from 'vitest'

import { setTransport, type Transport } from '../src/transport.js'
import { recordVisit } from '../src/endpoints/system.js'

/**
 * recordVisit 的出站形状锁(2026-10-23 立)。
 *
 * 立因:这个函数此前把入参原样 JSON 化发出去(`{page, referrer, duration}`),
 * 而服务端 `apps/api/src/routes/visit-tracking.ts` 的 `pageRecordSchema` 要的是
 * `url`(必填)/ `sessionId`(可选)/ `referer`(可选)⇒ **url 缺失 ⇒ 恒 400**,
 * 一次也没成功过。它全仓零调用方,所以从不报错、也从不生效 —— 属于"账面有接口,
 * 事实上一发就死"的那一型。
 *
 * 本文件只锁客户端这一面发什么;服务端那一面由它自己的 zod schema 锁。
 * 两边一旦漂开,这里会红。
 */

let captured: { url: string; body?: string } | null = null

function stubTransport(): void {
  const transport = vi.fn(async (url: string, init?: { body?: string }) => {
    captured = { url, body: init?.body }
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => '',
      json: async () => ({ code: 0, message: 'success', data: { success: true } }),
    }
  })
  setTransport(transport as unknown as Transport)
}

function sentBody(): Record<string, unknown> {
  if (!captured?.body) throw new Error('没有捕获到请求体')
  return JSON.parse(captured.body) as Record<string, unknown>
}

describe('recordVisit 出站形状', () => {
  afterEach(() => {
    captured = null
    setTransport(undefined as unknown as Transport)
  })

  it('page → url(服务端必填键),且不再出现 page 这个旧键', async () => {
    stubTransport()
    await recordVisit({ page: '/courses/42' })
    expect(captured?.url).toBe('/api/visit-tracking/page/record')
    const body = sentBody()
    expect(body.url).toBe('/courses/42')
    expect('page' in body).toBe(false)
  })

  it('referrer → referer(单个 r),与服务端列名一致', async () => {
    stubTransport()
    await recordVisit({ page: '/p', referrer: 'https://aizhs.top/x' })
    const body = sentBody()
    expect(body.referer).toBe('https://aizhs.top/x')
    expect('referrer' in body).toBe(false)
  })

  it('sessionId 原样透传', async () => {
    stubTransport()
    await recordVisit({ page: '/p', sessionId: 's-123' })
    expect(sentBody().sessionId).toBe('s-123')
  })

  it('可选键缺省时**不出现空串键**(服务端 min(1) 会把空串判 400)', async () => {
    stubTransport()
    await recordVisit({ page: '/p' })
    const body = sentBody()
    expect('referer' in body).toBe(false)
    expect('sessionId' in body).toBe(false)
  })

  it('duration 不再出站(服务端无对应列,发了也是被剥掉的谎)', async () => {
    stubTransport()
    await recordVisit({ page: '/p' })
    expect('duration' in sentBody()).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
