// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-707 回归锁(2026-11-13)。
 *
 * 病灶:downloadFileFromUrl 先 `ensureSafeFetchUrl(url)` 再裸 `fetch(url, { redirect:'follow' })`
 * —— 校验器只看首跳,传输层却会把 302 落点(例:`http://169.254.169.254/latest/meta-data/`)
 * 直接连过去,首跳合规即可打内网/元数据(DNS rebinding 同理)。
 *
 * 本文件锁:
 *   ① 302 落点指向内网 ⇒ 落点一次请求都不发,函数按既有语义返回 null;
 *   ② 重定向超过 safeFetch 上限(5 跳)⇒ 拒绝,返回 null;
 *   ③ 正常 200 ⇒ 原样返回内容/大小/Content-Type(修复不破坏正常链路)。
 *
 * 注入方式:同时替换 undici fetch(修复后走 ssrf-guard.safeFetch 的真实出口)与
 * globalThis.fetch(修复前裸 fetch 的出口);后者的桩**模拟 redirect:'follow' 的自动跟随**,
 * 因此把实现改回 redirect:'follow' 时用例①会红。全程不发真实网络。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const undiciMock = vi.hoisted(() => ({ fetch: vi.fn() }))
const globalFetchMock = vi.hoisted(() => ({ fetch: vi.fn() }))

vi.mock('undici', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, fetch: undiciMock.fetch }
})

import { downloadFileFromUrl } from '../src/utils/file-transfer.js'

interface StubHop {
  status: number
  location?: string
  body?: string
  headers?: Record<string, string>
}

/** 本次用例真实"发出"的 URL(两种 fetch 出口共用,用于断言内网落点零请求)。 */
let requested: string[] = []

function stubResponse(hop: StubHop): Response {
  return new Response(hop.body ?? null, {
    status: hop.status,
    headers: hop.headers ?? (hop.location ? { location: hop.location } : {}),
  })
}

/**
 * 统一桩:按 init.redirect 模拟传输层行为 —— 'follow' 时自动跟到 Location
 * (旧实现的形态),'manual' 时把 3xx 原样交回(safeFetch 的形态)。
 */
function installStub(routes: Record<string, StubHop>): void {
  const dispatch = async (input: unknown, init?: RequestInit): Promise<Response> => {
    let url = typeof input === 'string' ? input : String(input)
    const mode = init?.redirect ?? 'follow'
    for (let depth = 0; depth < 10; depth++) {
      requested.push(url)
      const hop = routes[url] ?? { status: 404 }
      if (hop.status >= 300 && hop.status < 400 && hop.location) {
        if (mode === 'follow') {
          url = new URL(hop.location, url).toString()
          continue
        }
        return stubResponse(hop)
      }
      return stubResponse(hop)
    }
    return stubResponse({ status: 508 })
  }
  undiciMock.fetch.mockImplementation(dispatch)
  globalFetchMock.fetch.mockImplementation(dispatch)
  globalThis.fetch = dispatch as typeof fetch
}

const originalFetch = globalThis.fetch

beforeEach(() => {
  requested = []
  undiciMock.fetch.mockReset()
  globalFetchMock.fetch.mockReset()
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('F-707 downloadFileFromUrl 重定向逐跳复检', () => {
  it('302 跳到内网(云元数据)⇒ 拒绝,内网地址一次请求都不发', async () => {
    const internal = 'http://169.254.169.254/latest/meta-data/'
    installStub({
      'http://93.184.216.34/file.bin': { status: 302, location: internal },
      [internal]: { status: 200, body: 'SECRET' },
    })

    const result = await downloadFileFromUrl('http://93.184.216.34/file.bin')

    expect(result).toBeNull()
    expect(requested).toEqual(['http://93.184.216.34/file.bin'])
    expect(requested).not.toContain(internal)
  })

  it('重定向超过最大跳数(5)⇒ 拒绝,返回 null', async () => {
    const routes: Record<string, StubHop> = {}
    const chain: string[] = []
    for (let i = 0; i < 8; i++) chain.push(`http://93.184.216.${10 + i}/f${i}`)
    chain.forEach((url, i) => {
      routes[url] = i === chain.length - 1 ? { status: 200, body: 'tail' } : { status: 302, location: chain[i + 1] as string }
    })
    installStub(routes)

    const result = await downloadFileFromUrl(chain[0] as string)

    expect(result).toBeNull()
    // 首跳 + 5 跳跟随 = 6 次;第 7 次前判定超限
    expect(requested).toHaveLength(6)
    expect(requested).not.toContain(chain[6] as string)
  })

  it('正常 200 ⇒ 直接返回内容/大小/Content-Type(修复不破坏正常链路)', async () => {
    installStub({
      'http://93.184.216.34/ok.bin': {
        status: 200,
        body: 'payload',
        headers: { 'content-type': 'application/x-test' },
      },
    })

    const result = await downloadFileFromUrl('http://93.184.216.34/ok.bin')

    expect(result).not.toBeNull()
    expect(result?.content.toString()).toBe('payload')
    expect(result?.size).toBe(7)
    expect(result?.contentType).toBe('application/x-test')
    expect(requested).toEqual(['http://93.184.216.34/ok.bin'])
  })
})
