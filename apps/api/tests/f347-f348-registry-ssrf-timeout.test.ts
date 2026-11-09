// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-347:自定义 registry 的 SSRF 防护要认 IPv6 方括号形态,且 302 必须逐跳复检。
 * F-348:fetchWithTimeout 的定时器要覆盖到正文消费,而不是响应头一到就清掉。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.hoisted(() => {
  delete process.env.IHUI_REGISTRY_EGRESS_PROXY
})

import { customRegistryAdapter } from '../src/services/registry-sync/custom-registry-adapter.js'
import { fetchWithTimeout } from '../src/services/registry-sync/types.js'

function stubFetch(mock: ReturnType<typeof vi.fn>): void {
  vi.stubGlobal('fetch', mock)
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('F-347 自定义 registry SSRF', () => {
  it.each([
    ['http://[::1]:8080'],
    ['http://[fd00:ec2::254]/'],
    ['http://[fe80::1]/'],
    ['http://[::ffff:127.0.0.1]/'],
    ['http://169.254.169.254/latest/meta-data'],
  ])('%s 被拦截且不发起请求', async (url) => {
    const fetchMock = vi.fn()
    stubFetch(fetchMock)
    await expect(
      customRegistryAdapter.fetch('mcp', { customRegistryUrl: url }),
    ).rejects.toThrow(/blocked/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('302 到内网地址被拦截(只请求第一跳且 redirect=manual)', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: 'http://169.254.169.254/latest/meta-data' },
        }),
    )
    stubFetch(fetchMock)
    await expect(
      customRegistryAdapter.fetch('mcp', { customRegistryUrl: 'https://registry.example.com' }),
    ).rejects.toThrow(/blocked/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect((fetchMock.mock.calls[0]![1] as RequestInit).redirect).toBe('manual')
  })

  it('公网 302 到公网地址逐跳跟随并返回 items', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: 'https://cdn.example.com/data.json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ items: [{ payload: { name: 'demo' }, tags: [], meta: {} }] }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
    stubFetch(fetchMock)
    const items = await customRegistryAdapter.fetch('mcp', {
      customRegistryUrl: 'https://registry.example.com',
    })
    expect(items).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[1]![0])).toContain('cdn.example.com/data.json')
  })
})

describe('F-348 正文读取受同一个超时约束', () => {
  it('响应头到达后正文迟迟不来 ⇒ 超时并中断读取', async () => {
    const fetchMock = vi.fn(async (_url: string, opts?: RequestInit) => {
      const signal = opts?.signal as AbortSignal
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          // 永不 enqueue/close;只有 abort 时让读取失败
          signal.addEventListener('abort', () =>
            controller.error(new DOMException('aborted', 'AbortError')),
          )
        },
      })
      return new Response(body, { status: 200 })
    })
    stubFetch(fetchMock)

    const res = await fetchWithTimeout('https://example.com', {}, 60)
    await expect(res.json()).rejects.toThrow()
  })

  it('正文在时限内读完 ⇒ 正常返回', async () => {
    stubFetch(
      vi.fn(
        async () =>
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
      ),
    )
    const res = await fetchWithTimeout('https://example.com', {}, 60)
    await expect(res.json()).resolves.toEqual({ ok: true })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
