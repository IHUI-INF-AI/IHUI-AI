// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 小程序运行时没有 AbortController 时,请求腿必须还能跑(2026-10-23 立)。
 *
 * 立因(真机取证,微信开发者工具 Stable 2.02.2608080):点登录页「微信登录」当场弹
 * `AbortController is not defined`,请求根本没发出。传输适配器其实早就注入了
 * (`setTransport(createTaroTransport())`),坏的是 client.ts 四条请求腿在进 transport **之前**
 * 无条件 `new AbortController()` —— 它假设了 Web API 存在。
 *
 * 这一族用例判的不是"有没有报错",而是**超时这一保护有没有在两端各自落地**:
 * 有中止能力的运行时走 signal,没有的走 transport 的 timeoutMs。哪一条断了都得红。
 */
import { describe, it, expect, afterEach, vi } from 'vitest'

import { fetchApi, fetchRaw } from '../src/client.js'
import { setTransport, type Transport, type TransportInit } from '../src/transport.js'

type Captured = { url: string; init: TransportInit }

/**
 * 中止错误。**两种运行时各有自己的形状**,这里跟着真实介质走,不跟着测试方便走:
 * - web/desktop/RN/Node:`fetch` 抛的是 `DOMException(name='AbortError')`,而 `isAbortError`
 *   在有 DOMException 的环境**只认这个形状**(普通 Error 会被读成网络异常,这是有意的);
 * - 微信小程序:运行时没有 DOMException,`isAbortError` 退到 `name === 'AbortError'` 那一支,
 *   所以端内 Taro 适配器抛普通 Error 是对的。
 * 本轮差点把这条判据改错:在 Node 里用普通 Error 当桩,测出"超时被报成 Aborted",
 * 而那只是测试环境与真实介质不同形 —— 判据本身没坏。
 */
function abortError(): Error {
  if (typeof DOMException !== 'undefined') return new DOMException('Aborted', 'AbortError')
  const e = new Error('Aborted')
  e.name = 'AbortError'
  return e
}

/** 装一个只记录入参、立即回 200 的 transport。 */
function stubTransport(seen: Captured[], delayMs = 0): Transport {
  return async (url, init) => {
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs))
    if (init.signal?.aborted) throw abortError()
    seen.push({ url, init })
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => '{"success":true,"data":{"ok":1}}',
      json: async () => ({ success: true, data: { ok: 1 } }),
    }
  }
}

/** 在"本运行时没有 AbortController"这一形下跑一段代码(模拟微信小程序)。 */
async function withoutAbortController<T>(run: () => Promise<T>): Promise<T> {
  const real = globalThis.AbortController
  // @ts-expect-error 故意摘掉,测的就是 typeof === 'undefined' 那一支
  delete globalThis.AbortController
  try {
    return await run()
  } finally {
    globalThis.AbortController = real
  }
}

const originalTransport = vi.fn<Parameters<Transport>, ReturnType<Transport>>()

afterEach(() => {
  setTransport(originalTransport)
})

describe('没有 AbortController 的运行时(微信小程序)', () => {
  it('W1 fetchApi 不再当场抛,且把 timeoutMs 透到 transport(超时改由那一端兑现)', async () => {
    const seen: Captured[] = []
    setTransport(stubTransport(seen))

    const result = await withoutAbortController(() =>
      fetchApi<{ ok: number }>('/api/auth/wechat/mini/one-tap-login', { method: 'POST' }),
    )

    expect(seen).toHaveLength(1)
    expect(result.success).toBe(true)
    // 这一条就是本轮修的东西:没有 signal 可用时,超时必须以 timeoutMs 落到 transport
    expect(seen[0].init.timeoutMs).toBe(30_000)
    expect(seen[0].init.signal ?? null).toBeNull()
  })

  it('W2 自定义 timeoutMs 不被写死的 30s 吃掉', async () => {
    const seen: Captured[] = []
    setTransport(stubTransport(seen))

    await withoutAbortController(() =>
      fetchApi<{ ok: number }>('/api/x', { method: 'GET', timeoutMs: 4500 } as never),
    )
    expect(seen[0].init.timeoutMs).toBe(4500)
  })

  it('W3 fetchRaw 没有可中止手段时当场喊响,不静默变成永久挂起', async () => {
    const seen: Captured[] = []
    setTransport(stubTransport(seen))
    await expect(withoutAbortController(() => fetchRaw('/api/screenshot.png'))).rejects.toThrow(
      /AbortController|原生下载/,
    )
    expect(seen).toHaveLength(0)
  })
})

describe('有 AbortController 的运行时(web/desktop/RN)行为零变化', () => {
  it('W4 依旧给出可中止的 signal,并把 timeoutMs 一并透下去', async () => {
    const seen: Captured[] = []
    setTransport(stubTransport(seen))

    await fetchApi<{ ok: number }>('/api/x', { method: 'GET' })

    expect(seen[0].init.signal).toBeTruthy()
    expect(typeof seen[0].init.signal?.addEventListener).toBe('function')
    expect(seen[0].init.timeoutMs).toBe(30_000)
  })

  it('W5 到点真的掐,并如实报"请求超时(1s)"而不是"请求已取消"', async () => {
    const seen: Captured[] = []
    // 让 transport 挂到超时之后仍未回,由 signal 触发 AbortError
    setTransport(async (url, init) => {
      seen.push({ url, init })
      // 真 fetch/Taro 都是这个形状:**进来就已中止的 signal 立刻抛中止错误**,不会再等一次事件。
      // 漏了这一手,桩会在超时后的那条重试腿上永久挂住(本轮实测到过),而那与真实介质不符。
      if (init.signal?.aborted) throw abortError()
      await new Promise<void>((resolveDone) => {
        if (init.signal) init.signal.addEventListener('abort', () => resolveDone(), { once: true })
      })
      throw abortError()
    })

    const result = await fetchApi<{ ok: number }>('/api/slow', {
      method: 'GET',
      timeoutMs: 1000,
    } as never)

    expect(result.success).toBe(false)
    expect(result.error).toBe('请求超时(1s)')
    // 一条已经 abort 的 signal 被复用在重试腿上 ⇒ 第二次不可能成功。这里只如实记下发生了几次,
    // 不据此改判据(那是另一张票:超时后该重置看门狗还是放弃重试)。
    expect(seen.length).toBeGreaterThanOrEqual(1)
  })
})

// W6/W7(读 client.ts 源码文本的两条"判据单源"锁)自本文件搬到
// `scripts/tests/api-client-request-leg-wiring.test.mjs`,判据一字未改。搬的理由不是洁癖:
// 端包测试 import 仓库工具 `scripts/lib/code-mask.mjs` 会坐实 api-client(rank 20)→ repo-tooling
// (rank 90)的反向依赖与 shared→api-client→repo-tooling→shared 的成环,而架构契约门的
// D4(module-cycle)既不登记表级 exceptions 也不认行内 arch-exempt ⇒ 除环只有搬文件这一条路。
// 本文件留 W1–W5:那是端包该测的行为(超时保护在两种运行时各自怎么落地)。
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
