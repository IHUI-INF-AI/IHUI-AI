// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 出站请求 SSRF 回归锁:守卫不只在首跳生效,重定向落点也必须逐跳复检。
 *
 * 背景:多个消费方原本是 `ensureSafeFetchUrl(url)` + 裸 fetch(redirect:'follow'),
 * 传输层会替我们把已校验的公网地址换成未校验的落点(302 → 内网即可跳过守卫)。
 * 现统一改走 ssrf-guard 的 safeFetch。本文件守三件事:
 *   1) 私网 IP / localhost 首跳即拒,且一次请求都不发(失败用例必须断言副作用没发生);
 *   2) 302 落点指向私网 ⇒ 落点发出前被拒,首跳只发一次;
 *   3) 消费方(crew-tools、clawdbot browser)确实接到了这个出口上。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

// crew-tools 的另外两个工具依赖 DB / LLM 侧装配;本文件只守 browser_fetch 的出站闸,
// 故截断这两条依赖链(不连库、不出网)。
vi.mock('../src/services/knowledge-rag-service.js', () => ({
  knowledgeRagService: { search: vi.fn() },
}))
vi.mock('../src/services/crew-llm-adapter.js', () => ({ callRealLlm: vi.fn() }))

import { safeFetch } from '../src/utils/ssrf-guard.js'
import { executeCrewTool } from '../src/services/crew-tools.js'
import { BrowserAutomation } from '../src/services/clawdbot/browser.js'

const redirectTo = (location: string, status = 302): Response =>
  ({
    ok: false,
    status,
    url: '',
    headers: new Headers({ location }),
    body: null,
    text: async () => '',
  }) as unknown as Response

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('safeFetch:每一次实际请求(含重定向落点)前都过守卫', () => {
  it('私网 IPv4 首跳即拒,且一次请求都没发', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(safeFetch('http://192.168.1.10/admin')).rejects.toThrow(/SSRF blocked/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('localhost 拒,且一次请求都没发(DNS 失败同样 fail-closed)', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(safeFetch('http://localhost/')).rejects.toThrow(/SSRF blocked/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('302 落点指向私网 ⇒ 落点发出前被拒,只发出首跳', async () => {
    const fetchMock = vi.fn(async () => redirectTo('http://10.0.0.7/secret'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(safeFetch('http://8.8.8.8/page')).rejects.toThrow(/SSRF blocked/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('http://8.8.8.8/page')
  })
})

describe('消费方接线(用户可控 URL 的服务端 fetch)', () => {
  it('crew-tools browser_fetch 私网 URL 被拒,不发请求', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await executeCrewTool('browser_fetch', { url: 'http://10.0.0.5/' })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/SSRF blocked/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('clawdbot navigate 私网 URL 被拒,不发请求', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(new BrowserAutomation().navigate('http://127.0.0.1:80/')).rejects.toThrow(
      /SSRF blocked/,
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
