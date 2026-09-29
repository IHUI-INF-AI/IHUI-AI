// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 台账号 G-814420 —— fetch deadline 必须罩住「响应体消费」的回归测试。
//
// 立因(上游证据,已整读到体):
//   .ihui-agent/tmp/zcode-study/zcode/packages/services/src/bots/providers/providerRequest.ts:34-40 / :53-57
//   原文写明:fetch() 在**响应头到达时**就 resolve,若此时 clearTimeout 并返回裸 Response,
//   服务端「headers 之后停滞」这条请求会永久占住串行队列(没有 deadline、没有 abort、永不结束)。
//
// 本套件用可控 fake fetch + fake body(模拟 undici 语义:signal 触发 abort 时,
// 尚未完成的 body 读取以 signal.reason 拒绝),配合 vitest 假计时器推进,钉四件事:
//   ① headers 已到、body 停滞 ⇒ deadline 仍在计时,body 读必须被 abort(不永挂)
//   ② 正常路径 ⇒ body 读完后不留未 clear 的定时器
//   ③ 传输层抛错路径 ⇒ 同样不留定时器(不得只在成功分支 clear)
//   ④ withBody() 显式出口 ⇒ 收完即解除 deadline
// 纯单元,不发网络请求、不连库(§5 测试隔离铁律)。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchWithinDeadline, withBody } from '../src/utils/fetch-deadline.js'

/** fake body 停滞的响应:json()/text() 返回「只在 abort 时拒绝、否则永不 resolve」的 Promise(逐字模拟 undici)。 */
function makeStallingResponse(signal: AbortSignal | undefined): Response {
  const stall = (): Promise<never> =>
    new Promise<never>((_resolve, reject) => {
      if (!signal) return
      if (signal.aborted) {
        reject(signal.reason)
        return
      }
      signal.addEventListener('abort', () => reject(signal.reason), { once: true })
      // 故意不 resolve:模拟服务端发完 headers 后不再吐 body 字节
    })
  return {
    ok: true,
    status: 200,
    json: stall,
    text: stall,
    arrayBuffer: stall,
  } as unknown as Response
}

/** 正常响应:headers 与 body 都立即可得。 */
function makeOkResponse(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  } as unknown as Response
}

const asFetch = (fn: (input: string | URL | Request, init?: RequestInit) => Promise<Response>) =>
  fn as unknown as typeof fetch

describe('fetchWithinDeadline:deadline 覆盖到响应体消费结束', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('① headers 已到、body 停滞 ⇒ deadline 不因 headers 解除,且 body 读被 abort(不永挂)', async () => {
    const timeoutMs = 1_000
    const fetchImpl = asFetch(async (_input, init) => makeStallingResponse(init?.signal ?? undefined))

    const res = await fetchWithinDeadline('https://vendor.example/stalled', {}, {
      timeoutMs,
      label: '停滞源',
      fetchImpl,
    })

    // headers 已返回:此刻定时器必须**还在**(旧写法在这里就已经 clearTimeout 了)
    expect(vi.getTimerCount()).toBe(1)

    // 开始读 body,并确认它在 deadline 之前不会自行结束
    const pending = res.json()
    let pendingSettled = false
    void pending.then(
      () => {
        pendingSettled = true
      },
      () => {
        pendingSettled = true
      },
    )
    await vi.advanceTimersByTimeAsync(timeoutMs - 1)
    expect(pendingSettled).toBe(false)

    // 推进到 deadline:停滞的 body 读必须被 abort,而不是永久占住调用方
    await vi.advanceTimersByTimeAsync(1)
    await expect(pending).rejects.toThrow(/停滞源/)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('② 正常路径 ⇒ body 读完后不留下未 clear 的定时器', async () => {
    const fetchImpl = asFetch(async () => makeOkResponse({ ok: true }))

    const res = await fetchWithinDeadline('https://vendor.example/ok', {}, {
      timeoutMs: 5_000,
      label: '正常源',
      fetchImpl,
    })
    expect(vi.getTimerCount()).toBe(1) // 尚未读 body:deadline 仍生效

    await expect(res.json()).resolves.toEqual({ ok: true })
    expect(vi.getTimerCount()).toBe(0) // 收完即解除,不留挂起定时器
  })

  it('③ 传输层抛错路径 ⇒ 同样不留定时器(异常分支也必须 clear)', async () => {
    const fetchImpl = asFetch(async () => {
      throw new Error('socket hang up')
    })

    await expect(
      fetchWithinDeadline('https://vendor.example/boom', {}, { timeoutMs: 5_000, fetchImpl }),
    ).rejects.toThrow('socket hang up')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('④ withBody() 显式出口 ⇒ 消费函数返回即收口(含抛错路径)', async () => {
    const fetchImpl = asFetch(async () => makeOkResponse({ items: [1, 2] }))

    const res = await fetchWithinDeadline('https://vendor.example/with-body', {}, {
      timeoutMs: 3_000,
      label: 'withBody',
      fetchImpl,
    })
    const payload = await withBody(res, async (r) => (await r.json()) as { items: number[] })
    expect(payload).toEqual({ items: [1, 2] })
    expect(vi.getTimerCount()).toBe(0)

    // body 读抛错同样收口(否则失败路径又把定时器留在队列里)
    const stalling = asFetch(async (_input, init) => makeStallingResponse(init?.signal ?? undefined))
    const res2 = await fetchWithinDeadline('https://vendor.example/with-body-fail', {}, {
      timeoutMs: 1_000,
      label: 'withBody 失败',
      fetchImpl: stalling,
    })
    const reading = withBody(res2, (r) => r.text())
    // 立刻挂 handler:否则「reject 发生在推进计时器那一刻、断言在之后」会被 Node 记成
    // unhandledRejection(vitest 据此判整个套件红,即使 4 条断言全过)。
    let readSettled = false
    void reading.then(
      () => {
        readSettled = true
      },
      () => {
        readSettled = true
      },
    )
    await vi.advanceTimersByTimeAsync(1_000)
    await expect(reading).rejects.toThrow(/withBody 失败/)
    expect(readSettled).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
