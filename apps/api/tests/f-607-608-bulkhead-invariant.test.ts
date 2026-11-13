// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-607 / F-608 回归锁(2026-11-13)。
 *
 * F-607 病灶:满并发时请求入队 `await new Promise(resolve => queue.push(resolve))`,
 * 唤醒后无条件 `active++`,而唤醒与占位不是原子的 ⇒ 释放方 `active--` 与等待者
 * `active++` 之间可插入新请求,`active` 冲破 max,隔离器形同虚设。
 * F-608 病灶:`reset()` 直接 `queue = []`,丢弃 resolve 句柄 ⇒ 排队请求的
 * `await` 永不落地,复位熔断反而制造永久悬挂。
 *
 * 本文件锁:
 *   ① 50 并发时 active 峰值不超过 max;
 *   ② 释放方移交名额后排队者被唤醒,且 active 始终不超上限(FIFO 不饥饿);
 *   ③ reset 时排队者全部 reject,不悬挂,执行中的任务不受影响;
 *   ④ reset 后被拒绝的排队者没有占位,active 归零且隔离器可继续接活(不会误减)。
 *
 * 全部用手工 deferred 控制节奏,不依赖真实计时/网络。
 */

import { describe, expect, it } from 'vitest'
import { Bulkhead } from '../src/plugins/resilience-extended.js'

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (err: unknown) => void
}

function deferred<T = void>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (err: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** 排空当前所有微任务链(宏任务边界),让被唤醒的 execute 走到位。 */
function flush(): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, 0))
}

describe('Bulkhead F-607/F-608 不变量', () => {
  it('F-607: 并发 50 个请求时 active 峰值不超过 max', async () => {
    const bh = new Bulkhead(3, 100)
    const gate = deferred()
    let running = 0
    let peak = 0

    const tasks = Array.from({ length: 50 }, (_, index) =>
      bh.execute(async () => {
        running++
        peak = Math.max(peak, running)
        await gate.promise
        running--
        return index
      }),
    )

    await flush()
    expect(bh.stats.active).toBe(3)
    expect(bh.stats.queued).toBe(47)
    expect(peak).toBe(3)

    gate.resolve()
    const results = await Promise.all(tasks)
    expect(results).toHaveLength(50)
    expect(peak).toBe(3)
    expect(bh.stats.active).toBe(0)
    expect(bh.stats.queued).toBe(0)
  })

  it('F-607: 新请求插入移交窗口时 active 仍不超上限', async () => {
    const bh = new Bulkhead(2, 10)
    const gates = [deferred(), deferred()]
    const hold = deferred()
    let running = 0
    let peak = 0
    const order: string[] = []

    const enter = (name: string) => {
      running++
      peak = Math.max(peak, running)
      order.push(name)
    }

    const active = gates.map((gate, index) =>
      bh.execute(async () => {
        enter(`active-${index}`)
        await gate.promise
        running--
      }),
    )
    const waiters = [0, 1].map((index) =>
      bh.execute(async () => {
        enter(`waiting-${index}`)
        await hold.promise
        running--
      }),
    )

    await flush()
    expect(bh.stats.active).toBe(2)
    expect(bh.stats.queued).toBe(2)

    // active-0 结束并唤醒 waiting-0,但 waiting-0 尚未恢复
    gates[0].resolve()
    await Promise.resolve()
    // 在自己的名额被移交出去前插入一个新请求:修复前它会抢走刚释放的名额
    const intruder = Promise.resolve().then(() =>
      bh.execute(async () => {
        enter('intruder')
        await hold.promise
        running--
      }),
    )

    await flush()
    expect(bh.stats.active).toBeLessThanOrEqual(2)
    expect(peak).toBeLessThanOrEqual(2)

    gates[1].resolve()
    hold.resolve()
    await Promise.all([...active, ...waiters, intruder])
    expect(peak).toBe(2)
    expect(order).toHaveLength(5)
    expect(bh.stats.active).toBe(0)
  })

  it('F-607: 释放后移交名额唤醒排队者,active 不超上限且不饥饿', async () => {
    const bh = new Bulkhead(2, 10)
    const gates = [deferred(), deferred(), deferred()]
    const started: number[] = []
    let running = 0
    let peak = 0

    const tasks = gates.map((gate, index) =>
      bh.execute(async () => {
        started.push(index)
        running++
        peak = Math.max(peak, running)
        await gate.promise
        running--
        return index
      }),
    )

    await flush()
    expect(started).toEqual([0, 1])
    expect(bh.stats.active).toBe(2)
    expect(bh.stats.queued).toBe(1)

    gates[0].resolve()
    await flush()
    expect(started).toEqual([0, 1, 2])
    expect(bh.stats.active).toBe(2)
    expect(bh.stats.queued).toBe(0)
    expect(peak).toBe(2)

    gates[1].resolve()
    gates[2].resolve()
    await expect(Promise.all(tasks)).resolves.toEqual([0, 1, 2])
    expect(bh.stats.active).toBe(0)
  })

  it('F-608: reset 时排队者全部 reject,不永久悬挂', async () => {
    const bh = new Bulkhead(1, 10)
    const gate = deferred()
    const running = bh.execute(async () => {
      await gate.promise
      return 'running'
    })
    const queued = Array.from({ length: 5 }, (_, index) => bh.execute(async () => index))

    await flush()
    expect(bh.stats.active).toBe(1)
    expect(bh.stats.queued).toBe(5)

    bh.reset()
    const settled = await Promise.allSettled(queued)
    expect(settled).toHaveLength(5)
    for (const entry of settled) {
      expect(entry.status).toBe('rejected')
      if (entry.status === 'rejected') {
        expect(String(entry.reason)).toContain('Bulkhead reset')
      }
    }
    expect(bh.stats.queued).toBe(0)
    // 执行中的任务不受 reset 影响,名额仍被占用
    expect(bh.stats.active).toBe(1)

    gate.resolve()
    await expect(running).resolves.toBe('running')
    expect(bh.stats.active).toBe(0)
  })

  it('F-608: reset 后 active 归零,隔离器可继续接受请求', async () => {
    const bh = new Bulkhead(1, 10)
    const gate = deferred()
    const running = bh.execute(async () => {
      await gate.promise
      return 'first'
    })
    const queued = [bh.execute(async () => 'queued-1'), bh.execute(async () => 'queued-2')]

    await flush()
    bh.reset()
    await Promise.allSettled(queued)
    gate.resolve()
    await expect(running).resolves.toBe('first')
    // 被 reset 拒绝的请求从未占位 ⇒ 不得把 active 误减成负数
    expect(bh.stats.active).toBe(0)

    await expect(bh.execute(async () => 'after-reset')).resolves.toBe('after-reset')
    expect(bh.stats.active).toBe(0)
    expect(bh.stats.queued).toBe(0)
  })
})
