// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-695 关闭事件「晚订阅者补发 + 单次 fire」的验收。
 *
 * 票面两条断言必须**能互相区分**:
 *  - 断言①(补发):先 fire(0) 后 subscribe ⇒ 微任务内收到 0。
 *  - 断言②(单次):再 fire(1) 不再分发。
 * 只留①就证不了「不重放旧的 / 不第二次分发」;只留②就证不了「晚到的人拿得到」。
 * 因此 A 组与 B 组分开设,并在 B 组里同时观察「在途订阅者」与「又一个晚订阅者」两类人。
 *
 * 消费者接线证据在最后一组:未接补发器时,`spawnIsolated` 的成功路径会白等满一整段
 * reap 预算(close 已被前一个监听者消费,晚挂的 once('close') 永不触发)——
 * 现测改动前一次 `node -e void 0` 耗时 2073ms(reap 默认 2000ms),正是票面那句"必永久挂"的形态。
 */

import { describe, it, expect } from 'vitest'
import { createCloseEventController } from '../src/util/close-event.js'
import { spawnIsolated } from '../src/util/spawn-isolated.js'

/** 只推进微任务、绝不给事件循环让出 macrotask 的 flush。 */
async function flushMicrotasks(ticks = 2): Promise<void> {
  for (let i = 0; i < ticks; i++) {
    await Promise.resolve()
  }
}

describe('G-695 断言①:晚订阅者补发 —— 先 fire(0) 后 subscribe ⇒ 微任务内收到 0', () => {
  it('补发住在微任务里:同步不得分发,一个微任务后拿到 0,且未经过任何定时器', async () => {
    const close = createCloseEventController<number>()
    close.fire(0)

    const seen: number[] = []
    close.event((value) => {
      seen.push(value)
    })
    // 同步帧内还没跑(补发刻意不伪装成"同步已结算",否则持有者会在自己没写完状态时被回调)
    expect(seen).toEqual([])

    // macrotask 哨兵:如果下面收到的值来自定时器,它一定先被置位
    let timerRan = false
    setTimeout(() => {
      timerRan = true
    }, 0)

    await flushMicrotasks()
    expect(seen).toEqual([0])
    expect(timerRan).toBe(false) // 「微任务内」是判据,不是措辞
  })

  it('已结算之后再订阅的人同样拿得到(补发不限一次)', async () => {
    const close = createCloseEventController<number | null>()
    close.fire(137)
    const late: Array<number | null> = []
    close.event((v) => late.push(v))
    close.event((v) => late.push(v))
    await flushMicrotasks()
    expect(late).toEqual([137, 137])
  })
})

describe('G-695 断言②:单次 fire —— 再 fire(1) 不再分发', () => {
  it('第二次 fire 对在途订阅者与新晚订阅者都不产生任何分发,补发的仍是第一次的值', async () => {
    const close = createCloseEventController<number>()
    const inFlight: number[] = []
    close.event((value) => {
      inFlight.push(value)
    })

    close.fire(0)
    expect(inFlight).toEqual([0]) // 在途监听者:同步收到一次

    close.fire(1) // 票面判据:不再分发
    expect(inFlight).toEqual([0])

    // 晚来的人补发的也只会是「最近一次已结算的值」0,而不是被第二次 fire 改写的 1
    const late: number[] = []
    close.event((value) => {
      late.push(value)
    })
    await flushMicrotasks()
    expect(late).toEqual([0])
    expect(inFlight).toEqual([0]) // 且同一个人绝不会被补发第二次
  })

  it('在途订阅者收到一次后,后续 fire 与自身都不再被调用(不重放旧的)', () => {
    const close = createCloseEventController<number>()
    let calls = 0
    close.event(() => {
      calls += 1
    })
    close.fire(0)
    close.fire(0)
    close.fire(1)
    expect(calls).toBe(1)
  })
})

describe('G-695 配套语义(补发器不能比原生 once 更弱)', () => {
  it('dispose 撤销尚未执行的补发微任务', async () => {
    const close = createCloseEventController<number>()
    close.fire(0)
    const seen: number[] = []
    const sub = close.event((value) => {
      seen.push(value)
    })
    sub.dispose()
    await flushMicrotasks()
    expect(seen).toEqual([])
  })

  it('dispose 撤销尚未发生的在途分发', () => {
    const close = createCloseEventController<number>()
    const seen: number[] = []
    const sub = close.event((value) => {
      seen.push(value)
    })
    sub.dispose()
    close.fire(0)
    expect(seen).toEqual([])
  })

  it('closed 只读位随首次 fire 翻真,且不影响分发次数', () => {
    const close = createCloseEventController<number>()
    expect(close.closed).toBe(false)
    close.fire(0)
    expect(close.closed).toBe(true)
    close.fire(1)
    expect(close.closed).toBe(true)
  })
})

describe('G-695 消费者接线:apps/cli/src/util/spawn-isolated.ts 的「等 close」站点', () => {
  it('成功路径不再白等满 reap 预算(晚订阅的 awaitReap 由补发器立即结算)', async () => {
    const reapTimeoutMs = 4_000
    const started = Date.now()
    const r = await spawnIsolated(process.execPath, ['-e', 'void 0'], {
      timeoutMs: 5_000,
      reapTimeoutMs,
    })
    const elapsed = Date.now() - started
    expect(r.exitCode).toBe(0)
    // 未接补发器时:elapsed ≈ reapTimeoutMs + 真实 spawn 开销 ⇒ 这条必红(改动前实测 2073ms / 默认 2000ms 预算)
    expect(elapsed).toBeLessThan(reapTimeoutMs / 2)
    expect(r.durationMs).toBeLessThan(reapTimeoutMs / 2)
  })

  it('超时路径行为不变:close 尚未发生时不得提前结算,仍按真实退出报 timeout', async () => {
    const started = Date.now()
    try {
      await spawnIsolated(process.execPath, ['-e', 'setTimeout(() => {}, 30_000)'], {
        timeoutMs: 300,
        reapTimeoutMs: 1_500,
      })
      throw new Error('should have thrown')
    } catch (e) {
      const err = e as { reason?: string }
      expect(err.reason).toBe('timeout')
    }
    const elapsed = Date.now() - started
    // 至少真等过了 timeout 预算(补发器不得把"还没发生的 close"当成已结算)
    expect(elapsed).toBeGreaterThanOrEqual(300)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
