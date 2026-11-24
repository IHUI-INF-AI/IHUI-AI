// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 认证运行时跨「模块副本」单例回归(2026-11-23 立)。
 *
 * 病灶:Next/Turbopack 会把 @ihui/api-client 打进多个 chunk,每个 chunk 各求值一次
 * client.ts。`setTokenProvider` 注册在 A 份、业务请求走 B 份时,所有请求都不带
 * Authorization → 每个 401 各触发一次 /auth/refresh;按 10s 复用窗口轮转 refresh token,
 * 最终被服务端判 reuse 并吊销整族,桌面端表现为「登录态突然没了」。
 *
 * 判据:同一 realm 里第二次求值模块(copyB)必须看到 copyA 注入的 token、共享同一次
 * in-flight 刷新、共享刷新成功复用窗口。窗口条件用 `typeof window !== 'undefined'`
 * 判定,故本文件在 node 环境里显式挂一个最小的 window 再 import。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const GLOBAL_KEY = '__IHUI_API_AUTH_RUNTIME_V1__'
const originalFetch = globalThis.fetch
const hadWindow = 'window' in globalThis
const originalWindow = (globalThis as { window?: unknown }).window

function installBrowserRealm(): void {
  ;(globalThis as { window?: unknown }).window = {}
  delete (globalThis as Record<string, unknown>)[GLOBAL_KEY]
}

function restoreRealm(): void {
  delete (globalThis as Record<string, unknown>)[GLOBAL_KEY]
  if (hadWindow) {
    ;(globalThis as { window?: unknown }).window = originalWindow
  } else {
    delete (globalThis as { window?: unknown }).window
  }
}

async function loadFreshCopy() {
  vi.resetModules()
  return await import('../src/client.js')
}

describe('api-client 认证运行时跨模块副本单例', () => {
  beforeEach(() => {
    installBrowserRealm()
    globalThis.fetch = originalFetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    restoreRealm()
  })

  it('copyB 的请求会带上 copyA 注入的 token', async () => {
    const copyA = await loadFreshCopy()
    copyA.setBaseUrl('http://api.test')
    copyA.setTokenProvider({ getToken: () => 'tok-shared' })

    const calls: Array<{ url: string; init: RequestInit }> = []
    globalThis.fetch = vi.fn(async (input: unknown, init?: RequestInit) => {
      calls.push({ url: String(input), init: init ?? {} })
      return new Response(JSON.stringify({ code: 0, message: 'ok', data: {} }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as unknown as typeof fetch

    const copyB = await loadFreshCopy()
    await copyB.fetchApi('/ping')

    const headers = new Headers(calls[0]?.init.headers)
    expect(headers.get('authorization')).toBe('Bearer tok-shared')
  })

  it('copyB 发起的刷新复用 copyA 的 in-flight,只调用一次 refresh 实现', async () => {
    let token = 'old-token'
    let releaseRefresh: ((value: string) => void) | undefined
    const refreshImpl = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          releaseRefresh = (value) => {
            token = value
            resolve(value)
          }
        }),
    )

    const copyA = await loadFreshCopy()
    copyA.setTokenProvider({ getToken: () => token, refreshAccessToken: refreshImpl })

    const copyB = await loadFreshCopy()
    const fromA = copyA.refreshAccessTokenOnce()
    const fromB = copyB.refreshAccessTokenOnce()
    // refreshAccessTokenOnce 内部经 Promise.resolve().then(...) 起跑,等一拍再断言
    await Promise.resolve()
    await Promise.resolve()
    expect(refreshImpl).toHaveBeenCalledTimes(1)

    releaseRefresh?.('new-token')
    await expect(fromA).resolves.toBe('new-token')
    await expect(fromB).resolves.toBe('new-token')
  })

  it('copyB 在成功复用窗口内直接拿到 copyA 刚换到的 token,不再发起刷新', async () => {
    let token = 'old-token'
    const refreshImpl = vi.fn(async () => {
      token = 'new-token'
      return 'new-token'
    })

    const copyA = await loadFreshCopy()
    copyA.setTokenProvider({ getToken: () => token, refreshAccessToken: refreshImpl })
    await expect(copyA.refreshAccessTokenOnce()).resolves.toBe('new-token')

    const copyB = await loadFreshCopy()
    await expect(copyB.refreshAccessTokenOnce()).resolves.toBe('new-token')
    expect(refreshImpl).toHaveBeenCalledTimes(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
