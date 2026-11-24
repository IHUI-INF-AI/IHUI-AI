// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * fetchApi 请求超时(2026-10-12 立,根治"生产 PG 退化时前端干等 18s+")。
 *
 * 背景:2026-10-12 桌面端 SSO 授权故障的完整根因链里,最后一环是"PG 半死 →
 * 查询 18s+ 不返回 → web 端 auth/refresh 与守卫探测裸 fetch 零超时 →
 * 整条 401 续期链路陪等 → 用户点了没反应"。超时机制本身早已在 client.ts 里
 * (2026-07-22 P0 Round 4),本票把它的**契约**钉死,防止被后人"顺手优化"掉:
 *
 *  1. 默认 30s:不传 timeoutMs 时,挂起请求 30s 后必须返回失败,绝不允许无限等;
 *  2. 自定义 timeoutMs(N):文案按**实际**超时值生成 —— 硬编码 '30s' 会对
 *     自定义调用方说谎(2026-10-12 去硬编码,apps/web 的 auth/refresh 传 10s);
 *  3. timeoutMs <= 0 回退默认 30s(0/-1/NaN 都不得把超时打成"立即失败"或"永不超时");
 *  4. 用户 signal 与超时 signal 合并语义:用户主动取消 ⇒ '请求已取消';
 *     超时触发 ⇒ '请求超时(Ns)' —— 两者不得互相顶掉(合并而不是二选一);
 *  5. 超时是终态:不重试(与网络异常不同 —— 网络异常才重试一次)。
 *
 * 手法:setTransport 注入"挂起等 abort"的 transport + vi.useFakeTimers 推进时间,
 * 不依赖任何真实时钟等待(整组用例毫秒级完成)。
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { fetchApi, setTokenProvider } from '../src/client.js'
import { setTransport, type Transport } from '../src/transport.js'

/** 与浏览器/Node fetch 同形态的 abort 错误(isAbortError 要求 instanceof DOMException) */
function abortError(): DOMException {
  return new DOMException('The operation was aborted', 'AbortError')
}

/** 挂起型 transport:直到 init.signal 被 abort 才以 AbortError 拒绝(模拟请求永不返回) */
function hangingTransport(onCall?: (init: { signal?: AbortSignal }) => void): Transport {
  return (_url, init) =>
    new Promise((_resolve, reject) => {
      onCall?.(init)
      const signal = init.signal
      if (signal?.aborted) {
        reject(abortError())
        return
      }
      signal?.addEventListener('abort', () => reject(abortError()))
    })
}

function okTransport(): Transport {
  return async () =>
    ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => JSON.stringify({ code: 0, message: 'ok', data: null }),
      json: async () => ({ code: 0, message: 'ok', data: null }),
    }) as unknown as Awaited<ReturnType<Transport>>
}

describe('fetchApi 请求超时', () => {
  afterEach(() => {
    setTransport(undefined as unknown as Transport)
    setTokenProvider({ getToken: () => null })
    vi.useRealTimers()
  })

  it('默认 30s:挂起请求超时后返回"请求超时(30s)",且不重试', async () => {
    vi.useFakeTimers()
    let calls = 0
    setTransport(
      hangingTransport(() => {
        calls++
      }),
    )

    const promise = fetchApi('/things')
    await vi.advanceTimersByTimeAsync(30_000)
    const r = await promise

    expect(r).toEqual({ success: false, error: '请求超时(30s)' })
    expect(calls).toBe(1) // 超时是终态:不像网络异常那样重试一次
  })

  it('自定义 timeoutMs=5s:超时文案按实际值生成,不硬编码 30s', async () => {
    vi.useFakeTimers()
    setTransport(hangingTransport())

    const promise = fetchApi('/things', { timeoutMs: 5_000 })
    await vi.advanceTimersByTimeAsync(4_999)
    // 差 1ms 未到点:请求仍挂起(promise 未决),证明计时器真的挂在 5s 上
    let settled = false
    void promise.then(() => {
      settled = true
    })
    await vi.advanceTimersByTimeAsync(1)
    expect(settled).toBe(true)

    const r = await promise
    expect(r).toEqual({ success: false, error: '请求超时(5s)' })
  })

  it.each([0, -1, Number.NaN])('timeoutMs=%s 回退默认 30s(不得立即失败或永不超时)', async (bad) => {
    vi.useFakeTimers()
    setTransport(hangingTransport())

    const promise = fetchApi('/things', { timeoutMs: bad })
    await vi.advanceTimersByTimeAsync(29_000)
    let settled = false
    void promise.then(() => {
      settled = true
    })
    await vi.advanceTimersByTimeAsync(1)
    expect(settled).toBe(false) // 29s 处仍未超时 ⇒ 没有被打成"立即失败"

    await vi.advanceTimersByTimeAsync(1_000)
    const r = await promise
    expect(r).toEqual({ success: false, error: '请求超时(30s)' })
  })

  it('用户主动取消(signal)判"请求已取消",不吃超时文案', async () => {
    // 本用例不需要假计时器:取消发生在超时之前
    const controller = new AbortController()
    setTransport(hangingTransport())

    const promise = fetchApi('/things', { signal: controller.signal })
    controller.abort()

    const r = await promise
    expect(r).toEqual({ success: false, error: '请求已取消' })
  })

  it('用户 signal 在场时超时仍生效(合并语义:两者不互相顶掉)', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    let receivedSignal: AbortSignal | undefined
    setTransport(hangingTransport((init) => {
      receivedSignal = init.signal
    }))

    const promise = fetchApi('/things', { signal: controller.signal, timeoutMs: 5_000 })
    await vi.advanceTimersByTimeAsync(4_000)
    expect(receivedSignal).toBeInstanceOf(AbortSignal)
    expect(receivedSignal).not.toBe(controller.signal) // 是合并出的新 signal,不是用户原对象
    expect(receivedSignal?.aborted).toBe(false)

    await vi.advanceTimersByTimeAsync(1_000)
    const r = await promise
    expect(r).toEqual({ success: false, error: '请求超时(5s)' })
  })

  it('正常响应不受超时机制影响(计时器到点前已完成)', async () => {
    vi.useFakeTimers()
    setTransport(okTransport())

    const r = await fetchApi('/things')
    expect(r.success).toBe(true)
  })
})
