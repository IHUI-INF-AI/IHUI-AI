// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-652 回归锁(2026-11-13)。
 *
 * 病灶:算法备案同步每 6h 触发,但抓取 fetch 无 signal(只吃 undici 默认 300s),
 * 页数/批次数无上限,定时器也不等待上一轮完成 ⇒ 单轮可跑数小时,6h 后并发叠加,
 * 重复下载/upsert、内存翻倍。
 *
 * 本文件锁:
 *   ① 慢响应在注入超时后被 AbortSignal 中止,且默认超时常量为 20s;
 *   ② 上一轮未结束时并发第二次调用直接跳过,只抓取一次(单飞);
 *   ③ 失败后 finally 释放守卫,下一轮可正常再跑;
 *   ④ 分页/批次上限常量可导出。
 *
 * 只 mock db 与全局 fetch,不触达真实 cac.gov.cn / PG。
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/db/index.js', () => ({
  db: { insert: vi.fn() },
  dbRead: {},
  dbClient: {},
}))

import {
  ALGORITHM_RECOMMEND_KIND,
  ALGORITHM_SYNC_DEFAULT_TIMEOUT_MS,
  ALGORITHM_SYNC_MAX_ATTACHMENTS_PER_PAGE,
  ALGORITHM_SYNC_MAX_DISCOVERY_PAGES,
  syncAlgorithmRecords,
} from '../src/services/algorithm-record-service.js'

const fetchMock = vi.fn<typeof fetch>()

function fakeHtmlResponse(html: string): Response {
  return { ok: true, status: 200, text: async () => html } as unknown as Response
}

function makeLog() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}

interface PendingFetch {
  url: string
  init?: RequestInit
  resolve: (r: Response) => void
}

/**
 * 桩 fetch:永不主动 resolve(模拟慢响应/挂死),只在 signal abort 或兜底计时器
 * 到期时 reject。若实现移除了 AbortSignal.timeout,兜底计时器会让用例快速变红,
 * 而不是把测试一直挂到 vitest 超时。
 */
function stubSlowFetch(fallbackRejectMs = 300): {
  pending: PendingFetch[]
  all: PendingFetch[]
} {
  const pending: PendingFetch[] = []
  const all: PendingFetch[] = []
  fetchMock.mockImplementation(
    (input, init) =>
      new Promise<Response>((resolve, reject) => {
        const entry: PendingFetch = {
          url: String(input),
          init,
          resolve: () => {},
        }
        pending.push(entry)
        all.push(entry)
        const fallback = setTimeout(() => {
          const i = pending.indexOf(entry)
          if (i >= 0) pending.splice(i, 1)
          reject(new Error('stub-slow-fetch: 未在预期时间内完成'))
        }, fallbackRejectMs)
        init?.signal?.addEventListener('abort', () => {
          clearTimeout(fallback)
          const i = pending.indexOf(entry)
          if (i >= 0) pending.splice(i, 1)
          reject(new DOMException('The operation was aborted.', 'AbortError'))
        })
        entry.resolve = (r: Response) => {
          clearTimeout(fallback)
          const i = pending.indexOf(entry)
          if (i >= 0) pending.splice(i, 1)
          resolve(r)
        }
      }),
  )
  return { pending, all }
}

describe('F-652 算法备案同步:超时中止 + 单飞守卫', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it('① 慢响应在注入超时后被 AbortSignal 中止', async () => {
    expect(ALGORITHM_SYNC_DEFAULT_TIMEOUT_MS).toBe(20_000)
    const stub = stubSlowFetch()
    const log = makeLog()

    const startedAt = Date.now()
    const out = await syncAlgorithmRecords({
      log,
      kinds: [ALGORITHM_RECOMMEND_KIND],
      timeoutMs: 30,
    })
    const elapsedMs = Date.now() - startedAt

    expect(out).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(stub.pending).toHaveLength(0)
    expect(stub.all).toHaveLength(1)
    expect(stub.all[0]?.init?.signal).toBeInstanceOf(AbortSignal)
    expect(stub.all[0]?.init?.signal?.aborted).toBe(true)
    expect(elapsedMs).toBeGreaterThanOrEqual(20)
    expect(elapsedMs).toBeLessThan(300)
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining('算法推荐同步失败'))
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining('aborted'))
  })

  it('② 上一轮未结束时并发第二次调用被跳过,只抓取一次', async () => {
    const stub = stubSlowFetch()
    const log = makeLog()

    const first = syncAlgorithmRecords({
      log,
      kinds: [ALGORITHM_RECOMMEND_KIND],
      timeoutMs: 5_000,
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const second = await syncAlgorithmRecords({
      log,
      kinds: [ALGORITHM_RECOMMEND_KIND],
      timeoutMs: 5_000,
    })

    expect(second).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(log.debug).toHaveBeenCalledWith(expect.stringContaining('跳过本轮'))
    expect(stub.pending).toHaveLength(1)

    stub.pending[0]?.resolve(fakeHtmlResponse('<html><body>无附件</body></html>'))
    await expect(first).resolves.toEqual([])
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('未发现 downloadfile 附件'))
  })

  it('③ 失败后 finally 释放守卫,下一轮可正常再跑', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(fakeHtmlResponse('<html></html>'))
    const log = makeLog()

    const first = await syncAlgorithmRecords({
      log,
      kinds: [ALGORITHM_RECOMMEND_KIND],
      timeoutMs: 1_000,
    })
    expect(first).toEqual([])
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining('network down'))

    const second = await syncAlgorithmRecords({
      log,
      kinds: [ALGORITHM_RECOMMEND_KIND],
      timeoutMs: 1_000,
    })
    expect(second).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('未发现 downloadfile 附件'))
  })

  it('④ 分页/批次上限常量可导出且有限', () => {
    expect(ALGORITHM_SYNC_MAX_ATTACHMENTS_PER_PAGE).toBe(50)
    expect(ALGORITHM_SYNC_MAX_DISCOVERY_PAGES).toBe(50)
  })
})
