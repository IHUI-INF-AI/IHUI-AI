// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//
// XUI-003 夹具:GET /api/vip/my 真实响应是 { vip: user_vips行 },且行字段名
// (levelValue/levelName/endTime)与 MembershipInfo(level/levelName/isActive)不同。
// 改前必红:旧实现把包络当 MembershipInfo,res.data.isActive === undefined。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getMembershipInfo } from '../src/endpoints/vip.js'

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ code: 0, message: 'ok', data }),
    text: async () => JSON.stringify({ code: 0, message: 'ok', data }),
    body: null,
  } as unknown as Response
}

describe('XUI-003 会员包络拆解与字段归一', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('生效中的会员:拆包后 isActive=true 且字段归一', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        vip: {
          userId: 'u1',
          levelValue: 2,
          levelName: '黄金会员',
          startTime: '2026-01-01T00:00:00.000Z',
          endTime: '2099-01-01T00:00:00.000Z',
          status: 1,
        },
      }),
    )

    const res = await getMembershipInfo()

    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.data).not.toBeNull()
    expect(res.data?.level).toBe(2)
    expect(res.data?.levelName).toBe('黄金会员')
    expect(res.data?.isActive).toBe(true)
    expect(res.data?.daysRemaining).toBeGreaterThan(0)
    expect((res.data as unknown as { vip?: unknown }).vip).toBeUndefined()
  })

  it('已过期的会员:isActive=false', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        vip: {
          userId: 'u1',
          levelValue: 1,
          levelName: '普通会员',
          startTime: '2020-01-01T00:00:00.000Z',
          endTime: '2020-02-01T00:00:00.000Z',
          status: 1,
        },
      }),
    )

    const res = await getMembershipInfo()

    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.data?.isActive).toBe(false)
    expect(res.data?.daysRemaining).toBe(0)
  })

  it('无会员记录返回 null,不返回空包络', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ vip: null }))

    const res = await getMembershipInfo()

    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.data).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
