// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * GitHub 星标数取数回归测试。
 *
 * 钉住两条:成功时只认 `stargazers_count` 数字字段;HTTP/字段/网络异常一律 null ——
 * 按钮宁可不显示数字,也不许用兜底数字冒充"实时"。
 */
import { describe, expect, it, vi } from 'vitest'

import { fetchGithubStarCount } from '../github-stars'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('fetchGithubStarCount', () => {
  it('正常读取 stargazers_count', async () => {
    const impl = vi.fn(async () => jsonResponse({ stargazers_count: 1234 }))
    await expect(fetchGithubStarCount(impl)).resolves.toBe(1234)
  })

  it('非 2xx(限流/不可达代理)⇒ null', async () => {
    const impl = vi.fn(async () => jsonResponse({ message: 'rate limited' }, 403))
    await expect(fetchGithubStarCount(impl)).resolves.toBeNull()
  })

  it('字段缺失或非数字 ⇒ null', async () => {
    const impl = vi.fn(async () => jsonResponse({ stargazers_count: '32' }))
    await expect(fetchGithubStarCount(impl)).resolves.toBeNull()
  })

  it('网络异常 ⇒ null,不抛出', async () => {
    const impl = vi.fn(async () => {
      throw new TypeError('fetch failed')
    })
    await expect(fetchGithubStarCount(impl)).resolves.toBeNull()
  })
})
