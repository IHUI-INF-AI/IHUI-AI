// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it, vi } from 'vitest'
import { createRefreshQueue } from '@/lib/refresh-queue'

describe('refresh-queue(b75-1#3)', () => {
  it('飞行中触发 3 次只尾随重跑 1 次且用最新输入', async () => {
    const calls: number[] = []
    const resolvers: Array<() => void> = []
    const fetcher = vi.fn(
      (n: number) =>
        new Promise<void>((r) => {
          calls.push(n)
          resolvers.push(r)
        }),
    )
    const key = 'ws-1'
    const q = createRefreshQueue({
      fetcher,
      getKey: () => key,
    })

    // 第一次起飞
    const p1 = q.refresh(1)
    expect(calls).toEqual([1])
    expect(q.isInFlight()).toBe(true)

    // 飞行中再触发 3 次 → 只记录 latest,不并发
    await q.refresh(2)
    await q.refresh(3)
    await q.refresh(4)
    expect(fetcher).toHaveBeenCalledTimes(1)

    // 完成第一次 → do-while 内应尾随重跑一次(用最新 input=4)
    resolvers[0]!()
    // 让出主线程,让 do-while 推进到第二次 fetcher(挂起)
    await new Promise((r) => setTimeout(r, 0))
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(calls[1]).toBe(4)
    // 完成第二次 → do-while 退出 → p1 resolve
    resolvers[1]!()
    await p1
    expect(q.isInFlight()).toBe(false)
  })

  it('guard 命中时 manual 走留痕、auto 静默', async () => {
    const fetcher = vi.fn(async () => {})
    const onSkip = vi.fn()
    const q = createRefreshQueue({
      fetcher,
      getKey: () => 'ws-1',
      skipReason: () => 'workspace-not-aligned',
      onSkip,
    })

    await q.refresh(1, { manual: true })
    expect(onSkip).toHaveBeenCalledWith('workspace-not-aligned', 'manual')
    expect(fetcher).not.toHaveBeenCalled()

    onSkip.mockClear()
    await q.refresh(1) // auto
    expect(onSkip).not.toHaveBeenCalled()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('请求返回时 key 已变(stale-workspace)则丢弃不尾随', async () => {
    let resolve: (() => void) | null = null
    const fetcher = vi.fn(
      () =>
        new Promise<void>((r) => {
          resolve = r
        }),
    )
    let key = 'ws-1'
    const q = createRefreshQueue({ fetcher, getKey: () => key })

    const p1 = q.refresh(1)
    // 飞行中触发一次尾随请求
    await q.refresh(2)
    // key 切换
    key = 'ws-2'
    resolve!()
    await p1
    await Promise.resolve()

    // stale:不尾随,不丢到 ws-2
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('无 guard 时正常单次执行', async () => {
    const fetcher = vi.fn(async () => 'ok')
    const q = createRefreshQueue({ fetcher, getKey: () => 'k' })
    await q.refresh('x')
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(q.isInFlight()).toBe(false)
  })
})