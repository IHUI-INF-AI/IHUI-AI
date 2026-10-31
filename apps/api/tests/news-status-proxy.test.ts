// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 安全强化第 31 批:资讯统计代理的契约锁。
 *
 * 背景:web 的 `/api/admin/news/:path*` rewrite 曾整段直连 ai-service 8803 —— 浏览器
 * 请求绕过 apps/api,连 adminNewsRoutes 的 requireAdmin 都不经过;同一条 rewrite 还把
 * apps/api 已实现的 categories/articles/information 全吞成 404。
 *
 * 根因修法:删 rewrite,由 apps/api 统一出口。status 是 marketing 首页的公开统计,
 * 保持"登录可见"(newsRoutes 里挂 requireAuth),代理逻辑收敛到
 * `services/news-status-proxy.ts` 单一实现。本文件钉住它的四条外部行为:
 *   A 上游 200 JSON ⇒ 原样保真(多字段不丢)
 *   B 上游 200 非 JSON / JSON 坏 ⇒ 原始正文
 *   C 上游非 2xx ⇒ 状态透传 + 可读消息
 *   D 上游异常 ⇒ 502 且**不泄漏异常正文**
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }))

vi.mock('../src/utils/ai-service-fetch.js', () => ({ aiServiceFetch: mockFetch }))

import { fetchNewsStatus } from '../src/services/news-status-proxy.js'

function fakeUpstream(status: number, body: string, contentType = 'application/json') {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => (k.toLowerCase() === 'content-type' ? contentType : null) },
    text: async () => body,
  }
}

const _req = {} as Parameters<typeof fetchNewsStatus>[0]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fetchNewsStatus', () => {
  it('A: 上游 200 JSON 字段保真', async () => {
    const payload = {
      lastGeneratedAt: '2026-10-31T00:00:00+00:00',
      draftLast24h: 3,
      publishedLast24h: 1,
    }
    mockFetch.mockResolvedValue(fakeUpstream(200, JSON.stringify(payload)))
    const r = await fetchNewsStatus(_req)
    expect(r).toEqual({ ok: true, status: 200, payload })
    expect(mockFetch).toHaveBeenCalledWith(_req, '/api/admin/news/status', { method: 'GET' })
  })

  it('B1: 非 JSON 正文原样进 payload', async () => {
    mockFetch.mockResolvedValue(fakeUpstream(200, 'plain text', 'text/plain'))
    const r = await fetchNewsStatus(_req)
    expect(r).toEqual({ ok: true, status: 200, payload: 'plain text' })
  })

  it('B2: 声明 JSON 但解析失败 ⇒ 原始正文', async () => {
    mockFetch.mockResolvedValue(fakeUpstream(200, '{broken'))
    const r = await fetchNewsStatus(_req)
    expect(r).toEqual({ ok: true, status: 200, payload: '{broken' })
  })

  it('C: 上游非 2xx 透传状态', async () => {
    mockFetch.mockResolvedValue(fakeUpstream(503, '{"detail":"down"}'))
    const r = await fetchNewsStatus(_req)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.status).toBe(503)
      expect(r.message).toContain('503')
    }
  })

  it('D: 上游异常 ⇒ 502 且不泄漏异常正文', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:8803 secret-internal-path'))
    const r = await fetchNewsStatus(_req)
    expect(r).toEqual({ ok: false, status: 502, message: 'ai-service unavailable' })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
