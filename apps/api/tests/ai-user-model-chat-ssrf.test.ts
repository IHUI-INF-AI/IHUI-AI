// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * BYOK 自定义端点 SSRF 回归锁(2026-10-28 立)。
 *
 * 背景:该路由的 `callLLM` 原本三处各自 `await fetch(endpoint)`,endpoint 由**用户填的**
 * baseUrl 拼出 —— 任意登录用户存一个 `http://127.0.0.1:8802` 或 `http://169.254.169.254`
 * 就能让服务端替他发请求;错误分支还把上游响应体拼进 Error.message 再经 502 回显,
 * 属半盲可读 SSRF。本文件守三件事:
 *   1) 内网/回环/云元数据地址在发请求**之前**就被拒(失败用例必须断言副作用没发生);
 *   2) 上游报错只回状态码,响应体不得进 message(它可能是内网页面原文);
 *   3) 接线锁:本文件不得再长出裸 `await fetch(`,守卫只能从 ssrf-guard 单一出口进。
 *
 * 判据不在本文件复制:端口/IP 段白名单全部来自 `utils/ssrf-guard.ts`(AGENTS.md §0.6)。
 */
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'

// callLLM 只做出站,不碰库/鉴权;把这几条依赖链截断,测试零连库、零 env 依赖。
vi.mock('../src/db/index.js', () => ({ db: {} }))
vi.mock('../src/plugins/auth.js', () => ({ checkAuth: vi.fn(async () => true) }))
vi.mock('../src/plugins/ai-cost.js', () => ({ recordAiCost: vi.fn() }))
vi.mock('../src/routes/v1-shared.js', () => ({ maskKey: (k: string) => k }))

import { callLLM, fetchUpstream } from '../src/routes/ai-user-model-chat.js'

const baseParams = {
  vendor: 'openai',
  modelId: 'gpt-4o-mini',
  apiKey: 'sk-test',
  messages: [{ role: 'user', content: 'hi' }],
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('callLLM:用户可控 baseUrl 必须过 SSRF 守卫', () => {
  it('回环地址(本机 API 8802)⇒ 拒,且一次请求都没发', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(callLLM({ ...baseParams, baseUrl: 'http://127.0.0.1:8802' })).rejects.toThrow(
      /SSRF blocked/,
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('云元数据地址(169.254.169.254)⇒ 拒,且一次请求都没发', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(callLLM({ ...baseParams, baseUrl: 'http://169.254.169.254' })).rejects.toThrow(
      /SSRF blocked/,
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('私网段(10.0.0.7)⇒ 拒,且一次请求都没发', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(callLLM({ ...baseParams, baseUrl: 'http://10.0.0.7' })).rejects.toThrow(
      /SSRF blocked/,
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('非标准端口 ⇒ 拒(端口白名单来自 ssrf-guard,不在本文件复算)', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(callLLM({ ...baseParams, baseUrl: 'http://1.1.1.1:8080' })).rejects.toThrow(
      /SSRF blocked/,
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('fetchUpstream:上游报错不得回显响应体', () => {
  it('500 时 message 只含状态码,原文只挂 upstreamBody 供服务端取证', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('INTERNAL_SECRET_PAGE', { status: 500 })),
    )

    const err = (await fetchUpstream('http://1.1.1.1/v1/chat/completions', {
      method: 'POST',
    }).catch((e: unknown) => e)) as Error & { statusCode?: number; upstreamBody?: string }

    expect(err.message).not.toContain('INTERNAL_SECRET_PAGE')
    expect(err.message).toContain('500')
    expect(err.statusCode).toBe(502)
    expect(err.upstreamBody).toContain('INTERNAL_SECRET_PAGE')
  })
})

describe('接线锁:出站只能从 ssrf-guard 单一出口进', () => {
  const src = readFileSync(new URL('../src/routes/ai-user-model-chat.ts', import.meta.url), 'utf8')

  it('本文件不得出现裸 await fetch( —— 否则 redirect:follow 会绕过守卫', () => {
    expect(src).not.toMatch(/await\s+fetch\(/)
  })

  it('必须从 utils/ssrf-guard 引入 safeFetch(判据单源)', () => {
    expect(src).toMatch(/from '\.\.\/utils\/ssrf-guard\.js'/)
    expect(src).toMatch(/safeFetch/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
