// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-978074:github-adapter 死 token 闩装车证明。
// 判据:① 带 token 请求 401 ⇒ 记住该值、当场匿名重试成功、此后不再携带 Authorization;
//      ② 无 token 的 401 不进闩,照旧按原语义抛错;③ 403 仍按限流语义抛错(不与凭据失效混淆)。
import { afterEach, describe, expect, it, vi } from 'vitest'

function jsonResponse(status: number, body: unknown = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('github-adapter 死 token 降级(G-978074)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('带 token 401 ⇒ 闩住并匿名重试成功;后续请求不再携带该 Authorization', async () => {
    const authz: (string | undefined)[] = []
    let first = true
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string | URL, init?: RequestInit) => {
        const h = (init?.headers ?? {}) as Record<string, string>
        authz.push(h.Authorization)
        if (first) {
          first = false
          return jsonResponse(401, { message: 'Bad credentials' })
        }
        return jsonResponse(200, [])
      }),
    )
    const { githubAdapter } = await import('../src/services/registry-sync/github-adapter.js')
    const items = await githubAdapter.fetch('mcp', { githubToken: 'dead-token' })
    expect(items).toEqual([])
    expect(authz[0]).toBe('Bearer dead-token') // 首请求仍带 token(死了才知道死)
    expect(authz[1]).toBeUndefined() // 当场匿名重试
    expect(authz.indexOf('Bearer dead-token')).toBe(0) // 死 token 只出现在首请求
    expect(authz.lastIndexOf('Bearer dead-token')).toBe(0) // 闩后永不复活
  })

  it('无 token 的 401 不进闩,照旧抛 contents API 错误', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(401)),
    )
    const { githubAdapter } = await import('../src/services/registry-sync/github-adapter.js')
    await expect(githubAdapter.fetch('mcp')).rejects.toThrow(/GitHub contents API returned 401/)
  })

  it('403 仍按限流语义抛错(不与凭据失效混淆)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(403)),
    )
    const { githubAdapter } = await import('../src/services/registry-sync/github-adapter.js')
    await expect(githubAdapter.fetch('mcp', { githubToken: 'some-token' })).rejects.toThrow(
      /rate limit/,
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
