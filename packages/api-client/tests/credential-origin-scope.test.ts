// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 安全强化第 20 批:本站凭据只发往本站域集合。
 *
 * 病灶(共享层,五个端共用一份实现):`normalizeUrl` 对绝对 URL 直通,而挂 Authorization
 * 那一步只看"有没有 token"。于是任何能让 `fetchApi/apiOrThrow/fetchWithAuthRefresh`
 * 拿到外链 path 的通道,都会**带着本站长期凭据请求第三方域**并把响应带回 ——
 * 现读到的具体入口是浏览器扩展的 api.proxy(后台代持 accessToken,调用方给 path)。
 *
 * 判据口径:相对 URL 同源照挂;绝对 URL 只有 origin 命中"本端已注入基址 / 宿主的同源 /
 * 调用方在代码里显式声明的服务基址"才挂。集合里没有的外链一律不挂(fail-closed)。
 *
 * 用例:
 *  A 纯函数:相对 / 命中 / 未命中 / 集合空 四态
 *  B 端到端:fetchApi 打外链 ⇒ 请求头**没有** Authorization(核心)
 *  C 端到端:fetchApi 打相对路径 ⇒ 照常带 Authorization(证明不是全掐)
 *  D 端到端:fetchWithAuthRefresh 显式声明 serviceBaseUrl ⇒ 该域照挂(代码声明可信)
 *  E 变异自证:摘掉判据(直接照旧挂)时 B 会翻红 —— 本文件 B 就是它的反例
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { apiOrThrow, setBaseUrl, setTokenProvider } from '../src/index'
import {
  credentialAllowedOrigins,
  fetchWithAuthRefresh,
  shouldAttachCredential,
} from '../src/client'

const TOKEN = 'tok-live'
const originalFetch = globalThis.fetch

type Call = { url: string; auth: string | undefined }
let calls: Call[] = []

beforeEach(() => {
  setBaseUrl('')
  setTokenProvider({ getToken: () => TOKEN })
  calls = []
  globalThis.fetch = vi.fn(async (input: unknown, init?: RequestInit) => {
    const h = new Headers(init?.headers as HeadersInit | undefined)
    calls.push({ url: String(input), auth: h.get('authorization') ?? undefined })
    return new Response(JSON.stringify({ code: 0, message: 'ok', data: {} }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as unknown as typeof fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
  setTokenProvider({ getToken: () => null })
})

describe('A 判据纯函数', () => {
  const allowed = credentialAllowedOrigins(['https://aizhs.top'])

  it('相对路径 ⇒ 允许(同源)', () => {
    expect(shouldAttachCredential('/api/x', allowed)).toBe(true)
  })

  it('绝对 URL 命中集合 ⇒ 允许', () => {
    expect(shouldAttachCredential('https://aizhs.top/api/x', allowed)).toBe(true)
  })

  it('绝对 URL 未命中 ⇒ 拒绝', () => {
    expect(shouldAttachCredential('https://evil.example/api/x', allowed)).toBe(false)
    expect(shouldAttachCredential('http://169.254.169.254/latest/meta-data/', allowed)).toBe(false)
  })

  it('集合为空且目标是绝对 URL ⇒ 拒绝(fail-closed)', () => {
    expect(shouldAttachCredential('https://evil.example/x', credentialAllowedOrigins([]))).toBe(
      false,
    )
  })

  it('非法 URL ⇒ 拒绝(解析不了就不发凭据)', () => {
    expect(shouldAttachCredential('http://[bad', allowed)).toBe(false)
  })
})

describe('B/C 端到端:fetchApi', () => {
  it('外链目标不带 Authorization(核心)', async () => {
    await apiOrThrow('https://evil.example/steal', { method: 'GET' }).catch(() => {})
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://evil.example/steal')
    expect(calls[0].auth).toBeUndefined()
  })

  it('相对路径照常带 Authorization(不是全掐)', async () => {
    await apiOrThrow('/notifications/unread-count', { method: 'GET' }).catch(() => {})
    expect(calls).toHaveLength(1)
    expect(calls[0].auth).toBe(`Bearer ${TOKEN}`)
  })
})

describe('D 调用方在代码里显式声明的服务基址可信', () => {
  it('serviceBaseUrl 命中的域照挂凭据', async () => {
    await fetchWithAuthRefresh('http://ai.test/api/voice/stt', { method: 'POST' }, {
      serviceBaseUrl: 'http://ai.test',
    })
    expect(calls).toHaveLength(1)
    expect(calls[0].auth).toBe(`Bearer ${TOKEN}`)
  })

  it('未声明的外链仍不挂(声明不等于放开一切)', async () => {
    await fetchWithAuthRefresh('http://other.test/x', { method: 'POST' }, {
      serviceBaseUrl: 'http://ai.test',
    })
    expect(calls).toHaveLength(1)
    expect(calls[0].auth).toBeUndefined()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
